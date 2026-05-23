import { Citizen } from '../../domain/entities/Citizen';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';
import { RegisterCitizenDto } from '../dtos/RegisterCitizenDto';
import { randomUUID } from 'crypto';
export class RegisterCitizenUseCase {
  constructor(private readonly citizenRepository: ICitizenRepository) {}
  async execute(dto: RegisterCitizenDto): Promise<Citizen> {
    const existingCitizen = await this.citizenRepository.findByWallet(dto.walletAddress);
    if (existingCitizen) throw new Error('Cidadão com esta carteira já está registrado.');
    const newCitizen = new Citizen(randomUUID(), dto.name, dto.walletAddress, dto.cpf, dto.email, dto.phone, dto.birthDate, dto.address, dto.facePhotoUrl);
    await this.citizenRepository.save(newCitizen);
    return newCitizen;
  }
}
