import { Schema, Document } from 'mongoose';
import { ActionType } from '../../../../domain/enums/ActionType';

export const ImpactActionSchema = new Schema({
  _id: { type: String, required: true },
  citizenId: { type: String, required: true, ref: 'Citizen' },
  actionType: { type: String, enum: Object.values(ActionType), required: true },
  pointsEarned: { type: Number, required: true },
  validatorId: { type: String, required: true },
  evidenceUrl: { type: String, required: true }, // Vai guardar a Base64 da Imagem ou URL S3/IPFS
  latitude: { type: Number }, // GPS Lat
  longitude: { type: Number }, // GPS Lng
  locationAddress: { type: String }, // Endereço legível (geocodificação reversa)
  bloodType: { type: String }, // Tipo sanguíneo do doador (ações de doação)
  txHash: { type: String }, // Hash da transação blockchain
  timestamp: { type: Date, default: Date.now },
});

export interface ImpactActionDocument extends Omit<Document, '_id'> {
  _id: string;
  citizenId: string;
  actionType: ActionType;
  pointsEarned: number;
  validatorId: string;
  evidenceUrl: string;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  bloodType?: string;
  txHash?: string;
  timestamp: Date;
}
