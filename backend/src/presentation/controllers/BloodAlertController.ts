import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('alerts')
export class BloodAlertController {
  constructor(
    @InjectModel('BloodAlert') private readonly alertModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
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

      // Dispara push notifications para todos com pushToken e tipo sanguíneo correspondente
      try {
        const citizens = await this.citizenModel.find({
          bloodType: body.bloodType.toUpperCase(),
          pushToken: { $exists: true, $ne: null },
        }).lean().exec();

        if (citizens.length > 0) {
          const webpush = require('web-push');
          webpush.setVapidDetails(
            'mailto:ecosolid@ecosolid.vercel.app',
            process.env.VAPID_PUBLIC_KEY || '',
            process.env.VAPID_PRIVATE_KEY || '',
          );
          const payload = JSON.stringify({
            title: `🚨 Urgente: Seu sangue ${body.bloodType.toUpperCase()} é necessário!`,
            body: `${body.hospital}: ${body.message}. Ganhe 1.000 SOLID doando agora!`,
            icon: '/icons/icon-192x192.png',
            data: { url: '/?action=blood_donation' },
          });
          for (const c of citizens) {
            try { await webpush.sendNotification(c.pushToken, payload); } catch {}
          }
        }
      } catch (pushErr) { console.warn('Push não enviado:', pushErr); }

      return { success: true, data: alert, message: `Alerta criado e notificações enviadas para ${body.bloodType}` };
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

  @Get('blood/active')
  async activeAlerts() {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const alerts = await this.alertModel
        .find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      return { success: true, data: alerts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
