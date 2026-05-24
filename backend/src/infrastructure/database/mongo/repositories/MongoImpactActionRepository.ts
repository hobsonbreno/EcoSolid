import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IImpactActionRepository } from '../../../../domain/repositories/IImpactActionRepository';
import { ImpactAction } from '../../../../domain/entities/ImpactAction';
import { ImpactActionDocument } from '../schemas/ImpactActionSchema';
@Injectable()
export class MongoImpactActionRepository implements IImpactActionRepository {
  constructor(@InjectModel('ImpactAction') private readonly impactModel: Model<ImpactActionDocument>) {}
  async save(action: ImpactAction): Promise<void> {
    const newAction = new this.impactModel({ _id: action.id, citizenId: action.citizenId, actionType: action.actionType, pointsEarned: action.pointsEarned, validatorId: action.validatorId, evidenceUrl: action.evidenceUrl, latitude: action.latitude, longitude: action.longitude, locationAddress: action.locationAddress, bloodType: action.bloodType, txHash: action.txHash, status: action.status, timestamp: action.timestamp });
    await newAction.save();
  }
  async findByCitizenId(citizenId: string): Promise<ImpactAction[]> {
    const docs = await this.impactModel.find({ citizenId }).exec();
    return docs.map(doc => new ImpactAction(doc._id, doc.citizenId, doc.actionType, doc.pointsEarned, doc.validatorId, doc.evidenceUrl, doc.latitude, doc.longitude, doc.locationAddress, doc.bloodType, doc.txHash, doc.status, doc.timestamp));
  }
}
