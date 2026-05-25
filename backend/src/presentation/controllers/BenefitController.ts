import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('benefits')
export class BenefitController {
  constructor(
    @InjectModel('BenefitRedemption') private readonly redemptionModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  // Mapeamento completo dos benefícios fixos
  private readonly benefitMap: Record<string, { segmento: string; orgao: string; duracaoMinutos: number }> = {
    'Zona Azul Fortaleza': { segmento: 'Estacionamento', orgao: 'Prefeitura Municipal de Fortaleza - AMC', duracaoMinutos: 60 },
    'Clinica Saude+': { segmento: 'Hospital', orgao: 'Clínica Saúde+', duracaoMinutos: 0 },
    'CAGECE': { segmento: 'Energia', orgao: 'CAGECE', duracaoMinutos: 0 },
    'Enel CE': { segmento: 'Energia', orgao: 'Enel CE', duracaoMinutos: 0 },
    'Restaurante Verde': { segmento: 'Restaurante', orgao: 'Restaurante Verde', duracaoMinutos: 90 },
  };

  @Post('redeem')
  async redeem(@Body() body: {
    citizenId: string; partnerName: string; partnerIcon: string;
    solidCost: number; benefitDescription: string;
    lat?: number; lng?: number; locationAddress?: string;
  }) {
    try {
      const maintenanceFee = Math.round(body.solidCost * 0.05);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const meta = this.benefitMap[body.partnerName] || { segmento: 'Outro', orgao: body.partnerName, duracaoMinutos: 0 };
      console.log('[BenefitRedeem] Parceiro:', body.partnerName, '→ Segmento:', meta.segmento, 'Orgao:', meta.orgao);

      const redemption = await this.redemptionModel.create({
        citizenId: body.citizenId,
        partnerName: body.partnerName,
        partnerOrgao: meta.orgao,
        partnerSegmento: meta.segmento,
        partnerIcon: body.partnerIcon || '🎁',
        solidCost: body.solidCost,
        maintenanceFee,
        benefitDescription: body.benefitDescription,
        duracaoMinutos: meta.duracaoMinutos,
        code,
        status: 'PENDENTE',
        timerStatus: 'aguardando',
        lat: body.lat || null,
        lng: body.lng || null,
        locationAddress: body.locationAddress || null,
      });

      return {
        success: true,
        data: {
          id: redemption._id,
          code,
          partnerName: body.partnerName,
          partnerOrgao: meta.orgao,
          benefitDescription: body.benefitDescription,
          duracaoMinutos: meta.duracaoMinutos,
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

      const age = Date.now() - new Date(redemption.createdAt).getTime();
      if (age > 30 * 60 * 1000) {
        redemption.status = 'EXPIRADO';
        await redemption.save();
        return { success: false, error: 'Este código expirou (30 minutos)' };
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

      const now = new Date();
      redemption.status = 'CONFIRMADO';
      redemption.validatedAt = now;
      if (redemption.duracaoMinutos > 0) {
        redemption.expiresAt = new Date(now.getTime() + redemption.duracaoMinutos * 60000);
        redemption.timerStatus = 'ativo';
      } else {
        redemption.timerStatus = 'encerrado';
      }
      await redemption.save();

      return {
        success: true,
        data: {
          ...redemption.toObject(),
          validatedAt: now,
          expiresAt: redemption.expiresAt,
          duracaoMinutos: redemption.duracaoMinutos,
          status: 'CONFIRMADO',
          timerStatus: redemption.timerStatus,
        },
        message: `Resgate de ${redemption.solidCost} SOLID confirmado!${redemption.duracaoMinutos > 0 ? ` Timer de ${redemption.duracaoMinutos}min iniciado.` : ''}`,
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

      const now = new Date();
      redemption.status = 'CONFIRMADO';
      redemption.validatedAt = now;
      if (redemption.duracaoMinutos > 0) {
        redemption.expiresAt = new Date(now.getTime() + redemption.duracaoMinutos * 60000);
        redemption.timerStatus = 'ativo';
      } else {
        redemption.timerStatus = 'encerrado';
      }
      await redemption.save();

      return {
        success: true,
        data: {
          ...redemption.toObject(),
          validatedAt: now,
          expiresAt: redemption.expiresAt,
          duracaoMinutos: redemption.duracaoMinutos,
          timerStatus: redemption.timerStatus,
        },
        message: `Resgate confirmado!${redemption.duracaoMinutos > 0 ? ` Timer de ${redemption.duracaoMinutos}min iniciado.` : ''}`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Resgates ativos prestes a expirar (para notificações)
  @Get('expiring-soon')
  async expiringSoon() {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);
      const redemptions = await this.redemptionModel
        .find({
          status: 'CONFIRMADO',
          timerStatus: 'ativo',
          expiresAt: { $gte: now, $lte: fiveMinutesFromNow },
        })
        .lean()
        .exec();
      return { success: true, data: redemptions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Marcar timer como encerrado (cidadão já usou o benefício)
  @Post(':id/end-timer')
  async endTimer(@Param('id') id: string) {
    try {
      const redemption = await this.redemptionModel.findById(id);
      if (!redemption) return { success: false, error: 'Resgate não encontrado' };
      redemption.timerStatus = 'encerrado';
      await redemption.save();
      return { success: true, data: redemption, message: 'Timer encerrado.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('pending')
  async getPending(@Query('segment') segment?: string) {
    try {
      const filter: any = { status: 'PENDENTE' };
      if (segment && segment !== 'Outro') filter.partnerSegmento = segment;
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

  // Histórico por segmento (parceiro)
  @Get('partner-segment/:segmento')
  async getBySegment(@Param('segmento') segmento: string, @Query('status') status?: string) {
    try {
      const filter: any = {};
      if (segmento !== 'Outro') filter.partnerSegmento = segmento;
      if (status) filter.status = status;
      const redemptions = await this.redemptionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: redemptions, count: redemptions.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Histórico do cidadão
  // Debug: retorna todos os resgates sem filtro
  @Get('debug')
  async debugAll() {
    try {
      const all = await this.redemptionModel.find().sort({ createdAt: -1 }).limit(50).lean().exec();
      return { success: true, data: all, count: all.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('citizen/:citizenId')
  async getByCitizen(@Param('citizenId') citizenId: string) {
    try {
      const redemptions = await this.redemptionModel
        .find({ citizenId })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: redemptions, count: redemptions.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
