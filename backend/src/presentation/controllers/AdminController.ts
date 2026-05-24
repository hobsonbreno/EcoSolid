import { Controller, Get, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('admin')
export class AdminController {
  constructor(
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
    @InjectModel('ImpactAction') private readonly impactModel: Model<any>,
    @InjectModel('BenefitRedemption') private readonly redemptionModel: Model<any>,
  ) {}

  private checkAuth(adminKey?: string) {
    const expected = process.env.ADMIN_KEY || 'ecosolid-admin-2026';
    if (!adminKey || adminKey !== expected) {
      throw new HttpException('Não autorizado', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('metrics')
  async metrics(@Headers('x-admin-key') adminKey?: string) {
    this.checkAuth(adminKey);

    const [totalCitizens, totalActions, totalRedemptions] = await Promise.all([
      this.citizenModel.countDocuments(),
      this.impactModel.countDocuments(),
      this.redemptionModel.countDocuments(),
    ]);

    const [solidDistributed, maintenanceFees, actionsByType] = await Promise.all([
      this.impactModel.aggregate([{ $group: { _id: null, total: { $sum: '$pointsEarned' } } }]),
      this.redemptionModel.aggregate([{ $group: { _id: null, total: { $sum: '$maintenanceFee' } } }]),
      this.impactModel.aggregate([{ $group: { _id: '$actionType', count: { $sum: 1 }, points: { $sum: '$pointsEarned' } } }]),
    ]);

    return {
      success: true,
      data: {
        totalCitizens,
        totalActions,
        solidDistributed: solidDistributed[0]?.total || 0,
        maintenanceFees: maintenanceFees[0]?.total || 0,
        totalRedemptions,
        breakdown: actionsByType.reduce((acc: any, item: any) => {
          acc[item._id] = { count: item.count, points: item.points };
          return acc;
        }, {}),
      },
    };
  }

  @Get('citizens/recent')
  async recentCitizens(@Headers('x-admin-key') adminKey?: string) {
    this.checkAuth(adminKey);
    const citizens = await this.citizenModel
      .find().sort({ createdAt: -1 }).limit(10).lean().exec();
    return { success: true, data: citizens };
  }

  @Get('redemptions/recent')
  async recentRedemptions(@Headers('x-admin-key') adminKey?: string) {
    this.checkAuth(adminKey);
    const redemptions = await this.redemptionModel
      .find().sort({ createdAt: -1 }).limit(10).lean().exec();
    return { success: true, data: redemptions };
  }

  @Get('citizens/search')
  async searchCitizens(@Headers('x-admin-key') adminKey?: string, @Headers('q') query?: string) {
    this.checkAuth(adminKey);
    const q = query || '';
    const filter = q ? {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { cpf: { $regex: q, $options: 'i' } },
        { bloodType: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    } : {};
    const citizens = await this.citizenModel.find(filter).sort({ createdAt: -1 }).limit(50).lean().exec();
    return { success: true, data: citizens };
  }

  @Get('redemptions/all')
  async allRedemptions(@Headers('x-admin-key') adminKey?: string) {
    this.checkAuth(adminKey);
    const redemptions = await this.redemptionModel.find().sort({ createdAt: -1 }).limit(100).lean().exec();
    return { success: true, data: redemptions };
  }

  @Get('blood-type-stats')
  async bloodTypeStats(@Headers('x-admin-key') adminKey?: string) {
    this.checkAuth(adminKey);
    const stats = await this.citizenModel.aggregate([
      { $match: { bloodType: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$bloodType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    return { success: true, data: stats };
  }
}
