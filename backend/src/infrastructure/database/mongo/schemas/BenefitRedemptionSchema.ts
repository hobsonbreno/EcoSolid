import { Schema } from 'mongoose';

export const BenefitRedemptionSchema = new Schema({
  citizenId: { type: String, required: true },
  partnerName: { type: String, required: true },
  partnerIcon: { type: String },
  solidCost: { type: Number, required: true },
  maintenanceFee: { type: Number, default: 0 },
  benefitDescription: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'validated', 'used', 'expired'], default: 'pending' },
  validatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
