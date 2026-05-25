import { Schema, Document } from 'mongoose';
import { CitizenLevel } from '../../../../domain/enums/CitizenLevel';

export const CitizenSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  walletAddress: { type: String, sparse: true },
  cpf: { type: String },
  email: { type: String },
  phone: { type: String },
  bloodType: { type: String },
  birthDate: { type: String },
  address: { type: String },
  facePhotoUrl: { type: String },
  totalPoints: { type: Number, default: 0 },
  level: { type: String, enum: Object.values(CitizenLevel), default: CitizenLevel.SEED },
  createdAt: { type: Date, default: Date.now },
  credentialId: { type: String, unique: true, sparse: true },
  pushToken: { type: Object },
  credentialPublicKey: { type: String },
  pixKey: { type: String },
  pixKeyType: { type: String },
});

export interface CitizenDocument extends Omit<Document, '_id'> {
  _id: string;
  name: string;
  walletAddress: string;
  cpf?: string;
  email?: string;
  phone?: string;
  bloodType?: string;
  birthDate?: string;
  address?: string;
  facePhotoUrl?: string;
  totalPoints: number;
  level: CitizenLevel;
  createdAt: Date;
  credentialId?: string;
  credentialPublicKey?: string;
  pushToken?: any;
  pixKey?: string;
  pixKeyType?: string;
}
