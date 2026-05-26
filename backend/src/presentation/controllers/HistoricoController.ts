import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('historico')
export class HistoricoController {
  constructor(
    @InjectModel('PixTransaction') private readonly pixModel: Model<any>,
    @InjectModel('CryptoTransaction') private readonly cryptoModel: Model<any>,
    @InjectModel('Partner') private readonly partnerModel: Model<any>,
  ) {}

  private getDateRange(periodo: string): Date | null {
    const now = new Date();
    switch (periodo) {
      case 'hoje': { const d = new Date(); d.setHours(0,0,0,0); return d; }
      case '7dias': return new Date(now.getTime() - 7*24*60*60*1000);
      case '30dias': return new Date(now.getTime() - 30*24*60*60*1000);
      default: return null;
    }
  }

  private async getCnpjByPartnerName(partnerName: string): Promise<string> {
    if (!partnerName) return '';
    const p = await this.partnerModel.findOne({ nomeFantasia: partnerName }).lean().exec();
    return p?.cnpj || '';
  }

  @Get('pix')
  async getPix(
    @Query('partnerName') partnerName: string,
    @Query('periodo') periodo?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('direcao') direcao?: string,
  ) {
    try {
      const cnpj = await this.getCnpjByPartnerName(partnerName);
      const since = this.getDateRange(periodo || 'todos');
      const page = parseInt(pagina || '1');
      const limit = parseInt(limite || '50');

      const filter: any = {};
      if (cnpj) filter.cnpjParceiro = cnpj;
      if (since) filter.createdAt = { $gte: since };
      if (direcao && direcao !== 'todos') filter.direcao = direcao;
      if (busca) {
        filter.$or = [
          { nomePagador: { $regex: busca, $options: 'i' } },
          { nomeRecebedor: { $regex: busca, $options: 'i' } },
          { chave: { $regex: busca, $options: 'i' } },
          { idTransacao: { $regex: busca, $options: 'i' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.pixModel.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean().exec(),
        this.pixModel.countDocuments(filter),
      ]);

      return { success: true, data, total, page, totalPages: Math.ceil(total/limit) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('crypto')
  async getCrypto(
    @Query('partnerName') partnerName: string,
    @Query('periodo') periodo?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('direcao') direcao?: string,
  ) {
    try {
      const cnpj = await this.getCnpjByPartnerName(partnerName);
      const since = this.getDateRange(periodo || 'todos');
      const page = parseInt(pagina || '1');
      const limit = parseInt(limite || '50');

      const filter: any = {};
      if (cnpj) filter.cnpjParceiro = cnpj;
      if (since) filter.createdAt = { $gte: since };
      if (direcao && direcao !== 'todos') filter.direcao = direcao;
      if (busca) {
        filter.$or = [
          { hash: { $regex: busca, $options: 'i' } },
          { from: { $regex: busca, $options: 'i' } },
          { to: { $regex: busca, $options: 'i' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.cryptoModel.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean().exec(),
        this.cryptoModel.countDocuments(filter),
      ]);

      return { success: true, data, total, page, totalPages: Math.ceil(total/limit) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('extrato')
  async getExtrato(
    @Query('partnerName') partnerName: string,
    @Query('periodo') periodo?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('tipo') tipo?: string,
    @Query('direcao') direcao?: string,
  ) {
    try {
      const cnpj = await this.getCnpjByPartnerName(partnerName);
      const since = this.getDateRange(periodo || 'todos');
      const page = parseInt(pagina || '1');
      const limit = parseInt(limite || '50');

      const baseFilter: any = {};
      if (cnpj) baseFilter.cnpjParceiro = cnpj;
      if (since) baseFilter.createdAt = { $gte: since };
      if (direcao && direcao !== 'todos') baseFilter.direcao = direcao;

      const buildSearch = (fields: string[]) => busca ? { $or: fields.map(f => ({ [f]: { $regex: busca, $options: 'i' } })) } : {};

      let pixFilter = { ...baseFilter };
      let cryptoFilter = { ...baseFilter };
      if (busca) {
        pixFilter = { ...pixFilter, ...buildSearch(['nomePagador','nomeRecebedor','chave','idTransacao']) };
        cryptoFilter = { ...cryptoFilter, ...buildSearch(['hash','from','to']) };
      }

      const fetchPix = tipo !== 'crypto' ? this.pixModel.find(pixFilter).lean().exec() : Promise.resolve([]);
      const fetchCrypto = tipo !== 'pix' ? this.cryptoModel.find(cryptoFilter).lean().exec() : Promise.resolve([]);

      const [pixData, cryptoData] = await Promise.all([fetchPix, fetchCrypto]);

      const pixItems = pixData.map(p => ({
        _id: p._id, tipo: 'pix', direcao: p.direcao, valor: p.valor, moeda: p.moeda,
        contraparte: p.direcao === 'entrada' ? (p.nomePagador || p.chave) : (p.nomeRecebedor || p.chave),
        descricao: p.direcao === 'entrada' ? 'Transferência PIX recebida' : 'Transferência PIX enviada',
        status: p.status, hash: p.idTransacao, createdAt: p.createdAt,
      }));

      const cryptoItems = cryptoData.map(c => ({
        _id: c._id, tipo: 'crypto', direcao: c.direcao, valor: c.valor, moeda: c.moeda,
        contraparte: c.direcao === 'entrada' ? c.from?.slice(0,10)+'...'+c.from?.slice(-6) : c.to?.slice(0,10)+'...'+c.to?.slice(-6),
        descricao: c.direcao === 'entrada' ? 'Recebimento ETH' : 'Envio ETH',
        status: c.status, hash: c.hash, createdAt: c.createdAt,
      }));

      const combined = [...pixItems, ...cryptoItems].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const total = combined.length;
      const paged = combined.slice((page-1)*limit, page*limit);

      const totalEntradas = combined.filter(i => i.direcao === 'entrada').reduce((s, i) => s + i.valor, 0);
      const totalSaidas = combined.filter(i => i.direcao === 'saida').reduce((s, i) => s + i.valor, 0);

      return {
        success: true,
        data: paged,
        total,
        page,
        totalPages: Math.ceil(total/limit),
        resumo: { totalEntradas, totalSaidas, saldoLiquido: totalEntradas - totalSaidas },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('pix')
  async savePix(@Body() body: {
    cnpjParceiro: string; direcao: string; valor: number;
    chave?: string; nomePagador?: string; nomeRecebedor?: string;
    status?: string; idTransacao: string;
  }) {
    try {
      const tx = await this.pixModel.create({ ...body, tipo: 'pix', moeda: 'BRL' });
      return { success: true, data: tx };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('crypto')
  async saveCrypto(@Body() body: {
    cnpjParceiro: string; direcao: string; valor: number;
    hash: string; from: string; to: string; bloco?: number;
    status?: string;
  }) {
    try {
      const tx = await this.cryptoModel.create({ ...body, tipo: 'crypto', moeda: 'ETH' });
      return { success: true, data: tx };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
