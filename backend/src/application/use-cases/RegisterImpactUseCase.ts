import { ImpactAction } from '../../domain/entities/ImpactAction';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';
import { IImpactActionRepository } from '../../domain/repositories/IImpactActionRepository';
import { RegisterImpactDto } from '../dtos/RegisterImpactDto';
import { IBlockchainService } from '../ports/IBlockchainService';
import { randomUUID } from 'crypto';

export class RegisterImpactUseCase {
  constructor(
    private readonly citizenRepository: ICitizenRepository,
    private readonly impactRepository: IImpactActionRepository,
    private readonly blockchainService: IBlockchainService,
  ) {}

  async execute(
    dto: RegisterImpactDto,
  ): Promise<{ action: ImpactAction; txHash: string }> {
    const citizen = await this.citizenRepository.findById(dto.citizenId);
    if (!citizen) throw new Error('Cidadão não encontrado.');

    // Atualizar bloodType do cidadão se a ação for doação de sangue com tipo informado
    if (dto.bloodType && dto.actionType === 'BLOOD_DONATION') {
      citizen.bloodType = dto.bloodType;
    }

    // Ação começa como PENDENTE_VALIDACAO — blockchain será gravada quando parceiro validar
    const txHash = 'pending-validation';

    const action = new ImpactAction(
      randomUUID(),
      citizen.id,
      dto.actionType,
      dto.pointsEarned,
      dto.validatorId,
      dto.evidenceUrl,
      dto.latitude,
      dto.longitude,
      dto.locationAddress,
      dto.bloodType,
      txHash,
      'PENDENTE_VALIDACAO',
    );

    // NÃO creditamos SOLID imediatamente — só quando parceiro validar
    // Mas salvamos a ação para o parceiro revisar
    await this.impactRepository.save(action);
    await this.citizenRepository.save(citizen); // salva bloodType se atualizado

    return { action, txHash };
  }
}
