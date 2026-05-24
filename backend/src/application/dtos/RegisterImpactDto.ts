import { ActionType } from '../../domain/enums/ActionType';
export class RegisterImpactDto {
  citizenId: string; actionType: ActionType; pointsEarned: number; validatorId: string; evidenceUrl: string; latitude?: number; longitude?: number; locationAddress?: string; bloodType?: string; txHash?: string;
}
