import { Schema } from 'mongoose';

export const CryptoTransactionSchema = new Schema({
  cnpjParceiro: { type: String, required: true },
  tipo: { type: String, default: 'crypto' },
  direcao: { type: String, enum: ['entrada', 'saida'], required: true },
  valor: { type: Number, required: true },
  moeda: { type: String, default: 'ETH' },
  hash: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  bloco: { type: Number },
  status: { type: String, enum: ['confirmado', 'pendente', 'falhou'], default: 'confirmado' },
  createdAt: { type: Date, default: Date.now },
});
