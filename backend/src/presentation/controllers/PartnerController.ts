import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('partners')
export class PartnerController {
  constructor(@InjectModel('PartnerInterest') private readonly interestModel: Model<any>) {}

  @Post('interest')
  async registerInterest(@Body() body: {
    nomeEstabelecimento: string; cnpj: string; segmento: string;
    nomeResponsavel: string; email: string; whatsapp: string; cidade?: string;
  }) {
    try {
      const interest = await this.interestModel.create({
        ...body,
        cidade: body.cidade || 'Fortaleza',
        status: 'pendente',
      });

      // Tenta enviar email de confirmação
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: body.email,
          subject: 'Recebemos seu interesse — EcoSolid Parceiros',
          text: `Olá ${body.nomeResponsavel},\n\nRecebemos seu cadastro de interesse como parceiro EcoSolid!\n\nEstabelecimento: ${body.nomeEstabelecimento}\nCNPJ: ${body.cnpj}\nSegmento: ${body.segmento}\n\nNossa equipe entrará em contato em até 48h.\n\n🌱 EcoSolid — Cidadania tokenizada em Fortaleza`,
        });
      } catch (emailErr) { console.warn('Email não enviado:', emailErr); }

      return { success: true, data: interest, message: 'Cadastro recebido! Entraremos em contato.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('admin/interests')
  async listInterests() {
    try {
      const interests = await this.interestModel.find().sort({ createdAt: -1 }).lean().exec();
      return { success: true, data: interests };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('admin/approve')
  async approveInterest(@Body() body: { id: string }) {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const interest = await this.interestModel.findByIdAndUpdate(
        body.id,
        { status: 'aprovado', partnerCode: code },
        { new: true },
      );

      if (!interest) return { success: false, error: 'Interesse não encontrado' };

      // Envia acesso por email
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: interest.email,
          subject: 'Parabéns! Seu parceiro EcoSolid foi aprovado 🎉',
          text: `Olá ${interest.nomeResponsavel},\n\nSeu estabelecimento "${interest.nomeEstabelecimento}" foi aprovado como parceiro EcoSolid!\n\nCódigo de acesso ao painel: ${code}\nPainel: https://eco-solid.vercel.app/parceiro\n\nUse este código para fazer login e começar a validar resgates.\n\n🌱 EcoSolid — Cidadania tokenizada em Fortaleza`,
        });
      } catch (emailErr) { console.warn('Email não enviado:', emailErr); }

      return { success: true, data: interest };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
