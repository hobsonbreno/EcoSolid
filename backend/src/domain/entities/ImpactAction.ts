import { ActionType } from '../enums/ActionType';
export class ImpactAction {
  constructor(
    public readonly id: string,
    public readonly citizenId: string,
    public readonly actionType: ActionType,
    public readonly pointsEarned: number,
    public readonly validatorId: string,
    public readonly evidenceUrl: string, 
    public readonly latitude?: number,
    public readonly longitude?: number,
    public readonly locationAddress?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
