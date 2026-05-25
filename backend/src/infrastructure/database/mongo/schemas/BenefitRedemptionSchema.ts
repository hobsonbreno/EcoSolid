import { Schema } from 'mongoose';

export const BenefitRedemptionSchema = new Schema({
  citizenId: { type: String, required: true },
  partnerName: { type: String, required: true },
  partnerOrgao: { type: String },
  partnerSegmento: { type: String },
  partnerIcon: { type: String },
  solidCost: { type: Number, required: true },
  maintenanceFee: { type: Number, default: 0 },
  benefitDescription: { type: String, required: true },
  duracaoMinutos: { type: Number, default: 0 },
  code: { type: String, required: true, unique: true },
  status: { type: String, enum: ['PENDENTE', 'CONFIRMADO', 'EXPIRADO', 'pending', 'validated', 'used', 'expired'], default: 'PENDENTE' },
  timerStatus: { type: String, enum: ['aguardando', 'ativo', 'encerrado', 'expirado'], default: 'aguardando' },
  validatedAt: { type: Date },
  expiresAt: { type: Date },
  txHash: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  locationAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
});
