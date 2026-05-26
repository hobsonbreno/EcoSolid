import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('extrato')
export class CitizenExtratoController {
  constructor(
    @InjectModel('CitizenPixTransaction') private readonly pixModel: Model<any>,
    @InjectModel('CryptoTransaction') private readonly cryptoModel: Model<any>,
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

  @Get()
  async getExtrato(
    @Query('usuarioId') usuarioId: string,
    @Query('walletAddress') walletAddress?: string,
    @Query('periodo') periodo?: string,
    @Query('tipo') tipo?: string,
    @Query('direcao') direcao?: string,
    @Query('busca') busca?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    try {
      if (!usuarioId) return { success: false, error: 'usuarioId é obrigatório' };
      const since = this.getDateRange(periodo || 'todos');
      const page = parseInt(pagina || '1');
      const limit = parseInt(limite || '50');

      const baseFilter: any = {};
      if (since) baseFilter.createdAt = { $gte: since };
      if (direcao && direcao !== 'todos') baseFilter.direcao = direcao;

      const buildUserFilter = (fieldOrigem: string, fieldDestino: string) => {
        const f: any = { ...baseFilter, $or: [{ [fieldOrigem]: usuarioId }, { [fieldDestino]: usuarioId }] };
        if (busca) {
          f.$and = [{ $or: [
            { nomeOrigem: { $regex: busca, $options: 'i' } },
            { nomeDestino: { $regex: busca, $options: 'i' } },
            { chaveOrigem: { $regex: busca, $options: 'i' } },
            { chaveDestino: { $regex: busca, $options: 'i' } },
            { idTransacao: { $regex: busca, $options: 'i' } },
          ]}];
        }
        return f;
      };

      const fetchPix = tipo !== 'crypto' ? this.pixModel.find(buildUserFilter('usuarioOrigemId', 'usuarioDestinoId')).lean().exec() : Promise.resolve([]);
      const cryptoFilter = buildUserFilter('from', 'to');
      if (walletAddress) cryptoFilter.$or = [{ from: walletAddress }, { to: walletAddress }];
      const fetchCrypto = tipo !== 'pix' ? this.cryptoModel.find(cryptoFilter).lean().exec() : Promise.resolve([]);

      const [pixData, cryptoData] = await Promise.all([fetchPix, fetchCrypto]);

      const pixItems = pixData.map(p => ({
        _id: p._id, tipo: 'pix', direcao: p.usuarioOrigemId === usuarioId ? 'saida' : 'entrada',
        valor: p.valor, moeda: p.moeda,
        contraparte: p.usuarioOrigemId === usuarioId ? (p.nomeDestino || p.chaveDestino) : (p.nomeOrigem || p.chaveOrigem),
        descricao: p.usuarioOrigemId === usuarioId ? 'Enviado para' : 'Recebido de',
        status: p.status, hash: p.idTransacao, createdAt: p.createdAt,
        chaveOrigem: p.chaveOrigem, chaveDestino: p.chaveDestino,
      }));

      const cryptoAddr = walletAddress || usuarioId;
      const cryptoItems = cryptoData.map(c => ({
        _id: c._id, tipo: 'crypto', direcao: c.from === cryptoAddr ? 'saida' : 'entrada',
        valor: c.valor, moeda: c.moeda,
        contraparte: c.from === cryptoAddr ? (c.to?.slice(0,10)+'...'+c.to?.slice(-6)) : (c.from?.slice(0,10)+'...'+c.from?.slice(-6)),
        descricao: c.from === cryptoAddr ? 'Enviado para' : 'Recebido de',
        status: c.status, hash: c.hash, createdAt: c.createdAt,
        from: c.from, to: c.to,
      }));

      const combined = [...pixItems, ...cryptoItems].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const total = combined.length;
      const paged = combined.slice((page-1)*limit, page*limit);

      return { success: true, data: paged, total, page, totalPages: Math.ceil(total/limit) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('resumo')
  async getResumo(@Query('usuarioId') usuarioId: string, @Query('walletAddress') walletAddress?: string, @Query('periodo') periodo?: string) {
    try {
      if (!usuarioId) return { success: false, error: 'usuarioId é obrigatório' };
      const since = this.getDateRange(periodo || 'todos');
      const baseFilter: any = {};
      if (since) baseFilter.createdAt = { $gte: since };
      const wAddr = walletAddress || usuarioId;

      const [pixData, cryptoData] = await Promise.all([
        this.pixModel.find({ ...baseFilter, $or: [{ usuarioOrigemId: usuarioId }, { usuarioDestinoId: usuarioId }] }).lean().exec(),
        this.cryptoModel.find({ ...baseFilter, $or: [{ from: wAddr }, { to: wAddr }] }).lean().exec(),
      ]);

      let totalEntradasBRL = 0, totalSaidasBRL = 0, totalEntradasETH = 0, totalSaidasETH = 0;

      for (const p of pixData) {
        if (p.usuarioDestinoId === usuarioId) totalEntradasBRL += p.valor;
        else totalSaidasBRL += p.valor;
      }
      for (const c of cryptoData) {
        if (c.to === wAddr) totalEntradasETH += c.valor;
        else totalSaidasETH += c.valor;
      }

      return {
        success: true,
        data: {
          brl: { totalEntradas: totalEntradasBRL, totalSaidas: totalSaidasBRL, saldo: totalEntradasBRL - totalSaidasBRL },
          eth: { totalEntradas: totalEntradasETH, totalSaidas: totalSaidasETH, saldo: totalEntradasETH - totalSaidasETH },
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('crypto')
  async saveCrypto(@Body() body: {
    hash: string; from: string; to: string; valor: number;
    usuarioOrigemId: string; usuarioDestinoId: string;
    nomeOrigem?: string; nomeDestino?: string;
    bloco?: number; network?: string; cnpjParceiro?: string;
  }) {
    try {
      const tx = await this.cryptoModel.create({
        tipo: 'crypto',
        direcao: 'saida',
        valor: body.valor,
        moeda: 'ETH',
        hash: body.hash,
        from: body.from,
        to: body.to,
        cnpjParceiro: body.cnpjParceiro || 'CIDADAO',
        bloco: body.bloco,
        network: body.network || 'sepolia',
        status: 'pendente',
        createdAt: new Date(),
      });
      return { success: true, data: tx, message: 'Transação crypto registrada' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('crypto/:hash/confirmar')
  async confirmarCrypto(@Body('hash') hash: string) {
    try {
      await this.cryptoModel.updateOne({ hash }, { status: 'confirmado' });
      return { success: true, message: 'Transação confirmada' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
