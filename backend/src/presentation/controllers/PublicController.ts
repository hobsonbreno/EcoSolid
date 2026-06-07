import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('public')
export class PublicController {
  constructor(
    @InjectModel('ImpactAction') private readonly impactModel: Model<any>,
    @InjectModel('Citizen') private readonly citizenModel: Model<any>,
  ) {}

  @Get('stats')
  async stats() {
    try {
      const [totalActions, totalCitizens, points, recent] = await Promise.all([
        this.impactModel.countDocuments(),
        this.citizenModel.countDocuments(),
        this.impactModel.aggregate([
          { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
        ]),
        this.impactModel.find().sort({ timestamp: -1 }).limit(10).lean().exec(),
      ]);

      const anon = recent.map((a: any) => ({
        actionType: a.actionType,
        pointsEarned: a.pointsEarned,
        locationAddress: a.locationAddress || 'Fortaleza/CE',
        bloodType: a.bloodType || undefined,
        timestamp: a.timestamp,
        initial: (a.citizenId || '???').substring(0, 4) + '***',
      }));

      return {
        success: true,
        data: {
          totalActions,
          totalCitizens,
          solidDistributed: points[0]?.total || 0,
          recentActions: anon,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
