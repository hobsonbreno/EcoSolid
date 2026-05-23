import { Citizen } from '../../domain/entities/Citizen';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';

export class GetCitizenUseCase {
  constructor(private readonly citizenRepository: ICitizenRepository) {}

  async execute(walletAddress: string): Promise<Citizen | null> {
    return await this.citizenRepository.findByWallet(walletAddress);
  }
}
