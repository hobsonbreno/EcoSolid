import { Controller, Post, Body } from '@nestjs/common';
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
      // Gera código alfanumérico de 8 dígitos
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const redemption = await this.redemptionModel.create({
        citizenId: body.citizenId,
        partnerName: body.partnerName,
        partnerIcon: body.partnerIcon || '🎁',
        solidCost: body.solidCost,
        benefitDescription: body.benefitDescription,
        code,
        status: 'pending',
      });

      return { success: true, data: { ...redemption.toObject(), code }, message: 'Benefício resgatado com sucesso!' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
