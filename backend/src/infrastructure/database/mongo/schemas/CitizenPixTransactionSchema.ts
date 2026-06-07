import { Schema } from 'mongoose';

export const CitizenPixTransactionSchema = new Schema({
  tipo: { type: String, default: 'pix' },
  direcao: { type: String, enum: ['entrada', 'saida'], required: true },
  valor: { type: Number, required: true },
  moeda: { type: String, default: 'BRL' },
  chaveOrigem: { type: String },
  chaveDestino: { type: String },
  usuarioOrigemId: { type: String, required: true },
  usuarioDestinoId: { type: String, required: true },
  nomeOrigem: { type: String },
  nomeDestino: { type: String },
  status: {
    type: String,
    enum: ['concluido', 'pendente', 'estornado'],
    default: 'concluido',
  },
  idTransacao: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
