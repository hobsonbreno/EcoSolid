import { Schema } from 'mongoose';

export const BenefitRedemptionSchema = new Schema({
  citizenId: { type: String, required: true },
  partnerName: { type: String, required: true },
  partnerSegmento: { type: String },
  partnerIcon: { type: String },
  solidCost: { type: Number, required: true },
  maintenanceFee: { type: Number, default: 0 },
  benefitDescription: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  status: { type: String, enum: ['PENDENTE', 'CONFIRMADO', 'EXPIRADO', 'pending', 'validated', 'used', 'expired'], default: 'PENDENTE' },
  validatedAt: { type: Date },
  txHash: { type: String },
  createdAt: { type: Date, default: Date.now },
});
