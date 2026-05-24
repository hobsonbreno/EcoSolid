import { Schema } from 'mongoose';

export const BloodAlertSchema = new Schema({
  bloodType: { type: String, required: true },
  message: { type: String, required: true },
  hospital: { type: String, required: true },
  location: { type: String },
  createdAt: { type: Date, default: Date.now },
});
