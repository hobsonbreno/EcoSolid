import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('alerts')
export class BloodAlertController {
  constructor(
    @InjectModel('BloodAlert') private readonly alertModel: Model<any>,
  ) {}

  @Post('blood')
  async createAlert(@Body() body: { bloodType: string; message: string; hospital: string; location?: string }) {
    try {
      const alert = await this.alertModel.create({
        bloodType: body.bloodType.toUpperCase(),
        message: body.message,
        hospital: body.hospital,
        location: body.location || 'Fortaleza - CE',
      });
      return { success: true, data: alert, message: `Alerta enviado para doadores ${body.bloodType}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('blood')
  async listAlerts() {
    try {
      const alerts = await this.alertModel.find().sort({ createdAt: -1 }).lean().exec();
      return { success: true, data: alerts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
