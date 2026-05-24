import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('benefits')
export class BenefitController {
  constructor(
    @InjectModel('BenefitRedemption') private readonly redemptionModel: Model<any>,
  ) {}

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

      const redemption = await this.redemptionModel.create({
        citizenId: body.citizenId,
        partnerName: body.partnerName,
        partnerIcon: body.partnerIcon || '🎁',
        solidCost: body.solidCost,
        maintenanceFee,
        benefitDescription: body.benefitDescription,
        code,
        status: 'pending',
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
          status: 'pending',
          createdAt: redemption.createdAt,
        },
        message: 'Benefício resgatado com sucesso!',
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

      if (redemption.status === 'validated' || redemption.status === 'used') {
        return { success: false, error: 'Este código já foi validado/ usado' };
      }

      redemption.status = 'validated';
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
        },
        message: `Resgate de ${redemption.solidCost} SOLID validado com sucesso!`,
      };
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
