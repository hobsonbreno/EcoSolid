import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('benefits')
export class BenefitController {
  constructor(
    @InjectModel('BenefitRedemption') private readonly redemptionModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  // Mapeamento de segmentos por parceiro
  private readonly segmentMap: Record<string, string> = {
    'Zona Azul Fortaleza': 'Estacionamento',
    'Clinica Saude+': 'Hospital',
    'CAGECE': 'Energia',
    'Enel CE': 'Energia',
    'Restaurante Verde': 'Restaurante',
  };

  @Post('redeem')
  async redeem(@Body() body: {
    citizenId: string; partnerName: string; partnerIcon: string;
    solidCost: number; benefitDescription: string;
  }) {
    try {
      const maintenanceFee = Math.round(body.solidCost * 0.05);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const segment = this.segmentMap[body.partnerName] || 'Outro';

      const redemption = await this.redemptionModel.create({
        citizenId: body.citizenId,
        partnerName: body.partnerName,
        partnerSegmento: segment,
        partnerIcon: body.partnerIcon || '🎁',
        solidCost: body.solidCost,
        maintenanceFee,
        benefitDescription: body.benefitDescription,
        code,
        status: 'PENDENTE',
      });

      return {
        success: true,
        data: {
          id: redemption._id,
          code,
          partnerName: body.partnerName,
          benefitDescription: body.benefitDescription,
          solidCost: body.solidCost,
          maintenanceFee,
          status: 'PENDENTE',
          createdAt: redemption.createdAt,
        },
        message: 'Benefício resgatado! Aguardando validação do parceiro.',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('validate')
  async validate(@Body() body: { code: string; partnerName: string }) {
    try {
      const redemption = await this.redemptionModel.findOne({ code: body.code.toUpperCase() });
      if (!redemption) return { success: false, error: 'Código não encontrado' };

      if (redemption.status === 'CONFIRMADO' || redemption.status === 'validated' || redemption.status === 'used') {
        return { success: false, error: 'Este código já foi utilizado' };
      }

      // Verificar expiração (30 min)
      const age = Date.now() - new Date(redemption.createdAt).getTime();
      if (age > 30 * 60 * 1000) {
        redemption.status = 'EXPIRADO';
        await redemption.save();
        return { success: false, error: 'Este código expirou (30 minutos)' };
      }

      // Debitar SOLID do cidadão
      const citizen = await this.citizenModel.findById(redemption.citizenId);
      if (citizen) {
        citizen.totalPoints = Math.max(0, (citizen.totalPoints || 0) - redemption.solidCost);
        // Recalcular nível
        if (citizen.totalPoints >= 3000) citizen.level = 'FOREST';
        else if (citizen.totalPoints >= 1000) citizen.level = 'TREE';
        else if (citizen.totalPoints >= 500) citizen.level = 'SPROUT';
        else if (citizen.totalPoints >= 100) citizen.level = 'SEED';
        else citizen.level = 'SEED';
        await citizen.save();
      }

      redemption.status = 'CONFIRMADO';
      redemption.validatedAt = new Date();
      await redemption.save();

      return {
        success: true,
        data: {
          code: redemption.code,
          partnerName: redemption.partnerName,
          benefitDescription: redemption.benefitDescription,
          solidCost: redemption.solidCost,
          validatedAt: redemption.validatedAt,
          status: 'CONFIRMADO',
        },
        message: `Resgate de ${redemption.solidCost} SOLID confirmado!`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post(':id/confirm')
  async confirmRedemption(
    @Param('id') id: string,
    @Body() body: { partnerName: string },
  ) {
    try {
      const redemption = await this.redemptionModel.findById(id);
      if (!redemption) return { success: false, error: 'Resgate não encontrado' };
      if (redemption.status === 'CONFIRMADO') return { success: false, error: 'Já confirmado' };

      const age = Date.now() - new Date(redemption.createdAt).getTime();
      if (age > 30 * 60 * 1000) {
        redemption.status = 'EXPIRADO';
        await redemption.save();
        return { success: false, error: 'Resgate expirado (30 minutos)' };
      }

      const citizen = await this.citizenModel.findById(redemption.citizenId);
      if (citizen) {
        citizen.totalPoints = Math.max(0, (citizen.totalPoints || 0) - redemption.solidCost);
        if (citizen.totalPoints >= 3000) citizen.level = 'FOREST';
        else if (citizen.totalPoints >= 1000) citizen.level = 'TREE';
        else if (citizen.totalPoints >= 500) citizen.level = 'SPROUT';
        else if (citizen.totalPoints >= 100) citizen.level = 'SEED';
        else citizen.level = 'SEED';
        await citizen.save();
      }

      redemption.status = 'CONFIRMADO';
      redemption.validatedAt = new Date();
      await redemption.save();

      return { success: true, data: redemption, message: 'Resgate confirmado!' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('pending')
  async getPending(@Query('segment') segment?: string) {
    try {
      const filter: any = { status: 'PENDENTE' };
      if (segment) filter.partnerSegmento = segment;
      const redemptions = await this.redemptionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: redemptions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('partner/:partnerName')
  async partnerDashboard(@Param('partnerName') partnerName: string) {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [allRedemptions, todayRedeemed, monthRedeemed] = await Promise.all([
        this.redemptionModel.find({ partnerName }).sort({ createdAt: -1 }).lean().exec(),
        this.redemptionModel.countDocuments({ partnerName, createdAt: { $gte: today } }),
        this.redemptionModel.countDocuments({ partnerName, createdAt: { $gte: startOfMonth } }),
      ]);

      return {
        success: true,
        data: {
          partnerName,
          redemptions: allRedemptions,
          stats: { today: todayRedeemed, month: monthRedeemed, total: allRedemptions.length },
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
