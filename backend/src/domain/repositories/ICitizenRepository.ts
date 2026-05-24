import { Citizen } from '../entities/Citizen';

export interface ICitizenRepository {
  save(citizen: Citizen): Promise<void>;
  findById(id: string): Promise<Citizen | null>;
  findByWallet(walletAddress: string): Promise<Citizen | null>;
  findByEmail(email: string): Promise<Citizen | null>;
  findByCredentialId(credentialId: string): Promise<Citizen | null>;
}
