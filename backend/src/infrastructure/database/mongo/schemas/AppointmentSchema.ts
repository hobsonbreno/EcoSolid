import { Schema } from 'mongoose';

export const AppointmentSchema = new Schema({
  citizenId: { type: String, required: true },
  citizenName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  notes: { type: String },
  location: { type: String, default: 'HemoSangue CE' },
  status: { type: String, enum: ['agendado', 'confirmado', 'realizado', 'cancelado'], default: 'agendado' },
  createdAt: { type: Date, default: Date.now },
});
