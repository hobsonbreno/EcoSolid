import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICitizenRepository } from '../../../../domain/repositories/ICitizenRepository';
import { Citizen } from '../../../../domain/entities/Citizen';
import { CitizenDocument } from '../schemas/CitizenSchema';
@Injectable()
export class MongoCitizenRepository implements ICitizenRepository {
  constructor(@InjectModel('Citizen') private readonly citizenModel: Model<CitizenDocument>) {}
  private mapToDomain(doc: CitizenDocument): Citizen {
    return new Citizen(doc._id, doc.name, doc.walletAddress, doc.cpf, doc.email, doc.phone, doc.bloodType, doc.birthDate, doc.address, doc.facePhotoUrl, doc.totalPoints, doc.level, doc.createdAt, doc.credentialId, doc.credentialPublicKey);
  }
  async save(citizen: Citizen): Promise<void> {
    await this.citizenModel.findOneAndUpdate({ _id: citizen.id }, { name: citizen.name, walletAddress: citizen.walletAddress, cpf: citizen.cpf, email: citizen.email, phone: citizen.phone, bloodType: citizen.bloodType, birthDate: citizen.birthDate, address: citizen.address, facePhotoUrl: citizen.facePhotoUrl, totalPoints: citizen.totalPoints, level: citizen.level, createdAt: citizen.createdAt, credentialId: citizen.credentialId, credentialPublicKey: citizen.credentialPublicKey }, { upsert: true, new: true }).exec();
  }
  async findById(id: string): Promise<Citizen | null> {
    const doc = await this.citizenModel.findById(id).exec();
    return doc ? this.mapToDomain(doc) : null;
  }
  async findByWallet(walletAddress: string): Promise<Citizen | null> {
    const doc = await this.citizenModel.findOne({ walletAddress }).exec();
    return doc ? this.mapToDomain(doc) : null;
  }
  async findByEmail(email: string): Promise<Citizen | null> {
    const doc = await this.citizenModel.findOne({ email }).exec();
    return doc ? this.mapToDomain(doc) : null;
  }
  async findByCredentialId(credentialId: string): Promise<Citizen | null> {
    const doc = await this.citizenModel.findOne({ credentialId }).exec();
    return doc ? this.mapToDomain(doc) : null;
  }
}
