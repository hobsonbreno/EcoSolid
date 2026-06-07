import { Schema } from 'mongoose';

export const PartnerSchema = new Schema({
  cnpj: { type: String, required: true, unique: true },
  nomeFantasia: { type: String, required: true },
  razaoSocial: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  bairro: { type: String },
  municipio: { type: String },
  uf: { type: String },
  cep: { type: String },
  telefone: { type: String },
  responsavel: { type: String },
  segmento: {
    type: String,
    enum: [
      'Hospital',
      'Estacionamento',
      'Restaurante',
      'Farmacia',
      'Energia',
      'Outro',
    ],
    required: true,
  },
  codigoAcesso: { type: String, unique: true, sparse: true },
  ativo: { type: Boolean, default: true },
  latitude: { type: Number },
  longitude: { type: Number },
  createdAt: { type: Date, default: Date.now },
});
