import { ImpactAction } from '../../domain/entities/ImpactAction';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';
import { IImpactActionRepository } from '../../domain/repositories/IImpactActionRepository';
import { RegisterImpactDto } from '../dtos/RegisterImpactDto';
import { IBlockchainService } from '../ports/IBlockchainService';
import { randomUUID } from 'crypto';
export class RegisterImpactUseCase {
  constructor(private readonly citizenRepository: ICitizenRepository, private readonly impactRepository: IImpactActionRepository, private readonly blockchainService: IBlockchainService) {}
  async execute(dto: RegisterImpactDto): Promise<{ action: ImpactAction, txHash: string }> {
    const citizen = await this.citizenRepository.findById(dto.citizenId);
    if (!citizen) throw new Error('Cidadão não encontrado.');
    const action = new ImpactAction(randomUUID(), citizen.id, dto.actionType, dto.pointsEarned, dto.validatorId, dto.evidenceUrl, dto.latitude, dto.longitude, dto.locationAddress);
    citizen.addPoints(dto.pointsEarned);
    await this.impactRepository.save(action);
    await this.citizenRepository.save(citizen); 
    const txHash = await this.blockchainService.mintSolidToken(citizen.walletAddress || '0x0000000000000000000000000000000000000000', dto.pointsEarned);
    return { action, txHash };
  }
}
