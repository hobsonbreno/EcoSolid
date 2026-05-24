import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('alerts')
export class BloodAlertController {
  constructor(
    @InjectModel('BloodAlert') private readonly alertModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  private async sendWhatsApp(phone: string, message: string, apikey: string): Promise<boolean> {
    try {
      const cleanPhone = phone.replace(/^\+/, '').replace(/\D/g, '');
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(message)}&apikey=${apikey}`;
      const res = await fetch(url);
      return res.ok;
    } catch (err) {
      console.warn('[WhatsApp] Falha ao enviar mensagem:', err);
      return false;
    }
  }

  @Post('blood')
  async createAlert(@Body() body: { bloodType: string; message: string; hospital: string; location?: string }) {
    try {
      const alert = await this.alertModel.create({
        bloodType: body.bloodType.toUpperCase(),
        message: body.message,
        hospital: body.hospital,
        location: body.location || 'Fortaleza - CE',
      });

      const bloodType = body.bloodType.toUpperCase();
      const whatsappMsg = `🚨 URGENTE EcoSolid: Seu tipo sanguíneo ${bloodType} é necessário no ${body.hospital}. ${body.message} Doe agora e ganhe 1.000 SOLID! Acesse: https://eco-solid.vercel.app`;

      // Buscar cidadãos com o tipo sanguíneo
      const citizens = await this.citizenModel.find({
        bloodType: bloodType,
      }).lean().exec();

      let pushCount = 0;
      let whatsappCount = 0;

      // Dispara push notifications para quem tem pushToken
      try {
        const pushCitizens = citizens.filter(c => c.pushToken);
        if (pushCitizens.length > 0) {
          const webpush = require('web-push');
          webpush.setVapidDetails(
            'mailto:ecosolid@ecosolid.vercel.app',
            process.env.VAPID_PUBLIC_KEY || '',
            process.env.VAPID_PRIVATE_KEY || '',
          );
          const payload = JSON.stringify({
            title: `🚨 Urgente: Seu sangue ${bloodType} é necessário!`,
            body: `${body.hospital}: ${body.message}. Ganhe 1.000 SOLID doando agora!`,
            icon: '/icons/icon-192x192.png',
            data: { url: '/?action=blood_donation' },
          });
          for (const c of pushCitizens) {
            try {
              await webpush.sendNotification(c.pushToken, payload);
              pushCount++;
            } catch {}
          }
        }
      } catch (pushErr) { console.warn('Push não enviado:', pushErr); }

      // Envia WhatsApp via CallMeBot para quem tem whatsappApiKey
      for (const c of citizens) {
        if (c.whatsappApiKey && c.phone) {
          const sent = await this.sendWhatsApp(c.phone, whatsappMsg, c.whatsappApiKey);
          if (sent) whatsappCount++;
        }
      }

      return {
        success: true,
        data: alert,
        message: `Alerta criado! ${pushCount} push + ${whatsappCount} WhatsApp enviados para ${bloodType}`,
      };
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
