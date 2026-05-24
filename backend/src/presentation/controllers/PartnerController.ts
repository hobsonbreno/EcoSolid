import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('partners')
export class PartnerController {
  constructor(
    @InjectModel('Partner') private readonly partnerModel: Model<any>,
    @InjectModel('PartnerInterest') private readonly interestModel: Model<any>,
  ) {}

  // Registrar parceiro completo (admin)
  @Post()
  async create(@Body() body: {
    cnpj: string; nomeFantasia: string; razaoSocial?: string;
    logradouro?: string; numero?: string; bairro?: string;
    municipio?: string; uf?: string; cep?: string; telefone?: string;
    responsavel?: string; segmento: string;
  }) {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const partner = await this.partnerModel.create({
        ...body,
        codigoAcesso: code,
        ativo: true,
      });

      // Geocodificar endereço via Nominatim
      try {
        const addr = [body.logradouro, body.numero, body.bairro, body.municipio, body.uf, 'Brasil']
          .filter(Boolean).join(', ');
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'EcoSolid/1.0' } },
        );
        const geoJson = await geoRes.json();
        if (geoJson?.[0]) {
          partner.latitude = parseFloat(geoJson[0].lat);
          partner.longitude = parseFloat(geoJson[0].lon);
          await partner.save();
        }
      } catch (geoErr) { console.warn('Geocodificação falhou:', geoErr); }

      return { success: true, data: partner, message: `Parceiro cadastrado! Código de acesso: ${code}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Listar todos os parceiros
  @Get()
  async listAll() {
    try {
      const partners = await this.partnerModel.find().sort({ createdAt: -1 }).lean().exec();
      return { success: true, data: partners };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Buscar por CNPJ
  @Get('cnpj/:cnpj')
  async getByCnpj(@Param('cnpj') cnpj: string) {
    try {
      const clean = cnpj.replace(/\D/g, '');
      const partner = await this.partnerModel.findOne({ cnpj: { $regex: clean } }).lean().exec();
      if (!partner) return { success: false, error: 'Parceiro não encontrado' };
      return { success: true, data: partner };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Buscar por código de acesso (login parceiro)
  @Get('by-code/:code')
  async getByCode(@Param('code') code: string) {
    try {
      const partner = await this.partnerModel.findOne({ codigoAcesso: code.toUpperCase() }).lean().exec();
      if (!partner) return { success: false, error: 'Código de acesso inválido' };
      return { success: true, data: partner };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Buscar por segmento
  @Get('by-segment/:segment')
  async getBySegment(@Param('segment') segment: string) {
    try {
      const partners = await this.partnerModel.find({ segmento: segment, ativo: true }).sort({ nomeFantasia: 1 }).lean().exec();
      return { success: true, data: partners };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Ativar/desativar parceiro
  @Patch(':id/status')
  async toggleStatus(@Param('id') id: string, @Body() body: { ativo: boolean }) {
    try {
      const partner = await this.partnerModel.findByIdAndUpdate(id, { ativo: body.ativo }, { new: true }).lean().exec();
      if (!partner) return { success: false, error: 'Parceiro não encontrado' };
      return { success: true, data: partner, message: body.ativo ? 'Parceiro ativado' : 'Parceiro desativado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Interesse (legado — mantido para compatibilidade)
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
          text: `Olá ${body.nomeResponsavel},\n\nRecebemos seu cadastro de interesse como parceiro EcoSolid!\n\nEstabelecimento: ${body.nomeEstabelecimento}\nCNPJ: ${body.cnpj}\nSegmento: ${body.segmento}\n\nNossa equipe entrará em contato em até 48h.\n\n🌱 EcoSolid`,
        });
      } catch (emailErr) { console.warn('Email não enviado:', emailErr); }
      return { success: true, data: interest, message: 'Cadastro recebido!' };
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
        body.id, { status: 'aprovado', partnerCode: code }, { new: true },
      );
      if (!interest) return { success: false, error: 'Interesse não encontrado' };
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: interest.email,
          subject: 'Parceiro EcoSolid aprovado! 🎉',
          text: `Olá ${interest.nomeResponsavel},\n\n"${interest.nomeEstabelecimento}" foi aprovado!\n\nCódigo de acesso: ${code}\nPainel: https://eco-solid.vercel.app/parceiro\n\n🌱 EcoSolid`,
        });
      } catch (emailErr) { console.warn('Email não enviado:', emailErr); }
      return { success: true, data: interest };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
