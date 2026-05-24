import { Schema } from 'mongoose';

export const PartnerInterestSchema = new Schema({
  nomeEstabelecimento: { type: String, required: true },
  cnpj: { type: String, required: true },
  segmento: { type: String, required: true },
  nomeResponsavel: { type: String, required: true },
  email: { type: String, required: true },
  whatsapp: { type: String, required: true },
  cidade: { type: String, default: 'Fortaleza' },
  status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado'], default: 'pendente' },
  partnerCode: { type: String },
  createdAt: { type: Date, default: Date.now },
});
