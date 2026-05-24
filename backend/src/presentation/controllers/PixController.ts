import { Controller, Post, Body, Get, Param } from '@nestjs/common';

@Controller('pix')
export class PixController {
  @Post('cobranca')
  async createCharge(@Body() body: { valor: number; descricao: string }) {
    try {
      const useSandbox = process.env.EFI_SANDBOX === 'true';
      // Simula cobrança PIX (MVP — Efí Bank SDK opcional no ambiente)
      const txid = 'pix_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      return {
        success: true,
        data: {
          txid,
          valor: body.valor,
          descricao: body.descricao,
          qrcode: `https://pix.efi.com.br/qr/${txid}`,
          pixCopiaECola: `00020126580014br.gov.bcb.pix0136${txid}5204000053039865405${body.valor.toFixed(2)}5802BR5925EcoSolid6009Fortaleza62070503***6304A3B2`,
          status: 'pending',
          sandbox: useSandbox,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('status/:txid')
  async checkStatus(@Param('txid') txid: string) {
    try {
      // Simula status (MVP)
      return {
        success: true,
        data: { txid, status: 'pending', message: 'Pagamento não confirmado' },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('webhook')
  async webhook(@Body() body: any) {
    try {
      console.log('Webhook PIX recebido:', body);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
