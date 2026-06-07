import { Schema } from 'mongoose';

export const PixTransactionSchema = new Schema({
  cnpjParceiro: { type: String, required: true },
  tipo: { type: String, default: 'pix' },
  direcao: { type: String, enum: ['entrada', 'saida'], required: true },
  valor: { type: Number, required: true },
  moeda: { type: String, default: 'BRL' },
  chave: { type: String },
  nomePagador: { type: String },
  nomeRecebedor: { type: String },
  status: {
    type: String,
    enum: ['concluido', 'pendente', 'estornado'],
    default: 'concluido',
  },
  idTransacao: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
