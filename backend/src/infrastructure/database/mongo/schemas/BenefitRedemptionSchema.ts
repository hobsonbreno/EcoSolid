import { Schema } from 'mongoose';

export const BenefitRedemptionSchema = new Schema({
  citizenId: { type: String, required: true },
  partnerName: { type: String, required: true },
  partnerIcon: { type: String },
  solidCost: { type: Number, required: true },
  benefitDescription: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'used', 'expired'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
