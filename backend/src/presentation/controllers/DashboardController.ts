import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel('BenefitRedemption')
    private readonly redemptionModel: Model<any>,
    @InjectModel('Partner') private readonly partnerModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  private getDateRange(periodo: string): Date | null {
    const now = new Date();
    switch (periodo) {
      case 'hoje': {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case '7dias':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30dias':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  @Get('metricas')
  async getMetricas(
    @Query('partnerName') partnerName: string,
    @Query('periodo') periodo?: string,
  ) {
    try {
      const since = this.getDateRange(periodo || 'hoje');
      const baseFilter: any = {};
      if (partnerName) baseFilter.partnerName = partnerName;
      if (since) baseFilter.createdAt = { $gte: since };

      const [totalResgates, aprovados, rejeitados, solidAgg] =
        await Promise.all([
          this.redemptionModel.countDocuments(baseFilter),
          this.redemptionModel.countDocuments({
            ...baseFilter,
            status: { $in: ['CONFIRMADO', 'validated'] },
          }),
          this.redemptionModel.countDocuments({
            ...baseFilter,
            status: { $in: ['EXPIRADO', 'expired'] },
          }),
          this.redemptionModel.aggregate([
            { $match: baseFilter },
            { $group: { _id: null, total: { $sum: '$solidCost' } } },
          ]),
        ]);

      const solidDistribuido = solidAgg.length > 0 ? solidAgg[0].total : 0;
      const taxaAprovacao =
        totalResgates > 0 ? Math.round((aprovados / totalResgates) * 100) : 0;

      return {
        success: true,
        data: {
          totalResgates,
          aprovados,
          rejeitados,
          solidDistribuido,
          taxaAprovacao,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('resgates-30dias')
  async getResgates30Dias(@Query('partnerName') partnerName: string) {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const baseFilter: any = { createdAt: { $gte: since } };
      if (partnerName) baseFilter.partnerName = partnerName;

      const results = await this.redemptionModel.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              data: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.data': 1 } },
      ]);

      // Build guaranteed 30-day array
      const dataMap: Record<
        string,
        { data: string; aprovados: number; rejeitados: number }
      > = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dataMap[key] = { data: key, aprovados: 0, rejeitados: 0 };
      }

      for (const r of results) {
        const key = r._id.data;
        if (dataMap[key]) {
          if (['CONFIRMADO', 'validated'].includes(r._id.status))
            dataMap[key].aprovados += r.count;
          else if (['EXPIRADO', 'expired'].includes(r._id.status))
            dataMap[key].rejeitados += r.count;
        }
      }

      return { success: true, data: Object.values(dataMap) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('top-beneficios')
  async getTopBeneficios(
    @Query('partnerName') partnerName: string,
    @Query('periodo') periodo?: string,
  ) {
    try {
      const since = this.getDateRange(periodo || 'hoje');
      const match: any = {};
      if (partnerName) match.partnerName = partnerName;
      if (since) match.createdAt = { $gte: since };

      const results = await this.redemptionModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$benefitDescription',
            quantidade: { $sum: 1 },
            solidTotal: { $sum: '$solidCost' },
          },
        },
        { $sort: { quantidade: -1 } },
        { $limit: 10 },
      ]);

      const maxQtd = results.length > 0 ? results[0].quantidade : 1;
      const data = results.map((r) => ({
        beneficio: r._id,
        quantidade: r.quantidade,
        solidTotal: r.solidTotal,
        barraPct: Math.round((r.quantidade / maxQtd) * 100),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('ultimos-resgates')
  async getUltimosResgates(@Query('partnerName') partnerName: string) {
    try {
      const filter: any = {};
      if (partnerName) filter.partnerName = partnerName;
      const data = await this.redemptionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('status-sistema')
  async getStatusSistema() {
    try {
      const [totalParceiros, totalUsuarios, solidAgg, segmentosAgg] =
        await Promise.all([
          this.partnerModel.countDocuments({ ativo: true }),
          this.citizenModel.countDocuments(),
          this.citizenModel.aggregate([
            { $group: { _id: null, total: { $sum: '$totalPoints' } } },
          ]),
          this.partnerModel.aggregate([
            { $match: { ativo: true } },
            { $group: { _id: '$segmento', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ]),
        ]);

      const solidCirculacao = solidAgg.length > 0 ? solidAgg[0].total : 0;

      return {
        success: true,
        data: {
          totalParceiros,
          totalUsuarios,
          solidCirculacao,
          segmentos: segmentosAgg.map((s) => ({ nome: s._id, count: s.count })),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
