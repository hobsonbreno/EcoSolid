import { Controller, Get, Post, Body } from '@nestjs/common';

@Controller('push')
export class PushController {
  @Get('vapid-public-key')
  async getVapidKey() {
    return {
      success: true,
      data: { publicKey: process.env.VAPID_PUBLIC_KEY || '' },
    };
  }

  @Post('test')
  async testNotification(@Body() body: { pushToken: any; title: string; message: string }) {
    try {
      const webpush = require('web-push');
      webpush.setVapidDetails(
        'mailto:ecosolid@ecosolid.vercel.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );
      await webpush.sendNotification(body.pushToken, JSON.stringify({
        title: body.title,
        body: body.message,
        icon: '/icons/icon-192x192.png',
        data: { url: '/?action=blood_donation' },
      }));
      return { success: true, message: 'Notificação enviada' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
