import { ImpactAction } from '../entities/ImpactAction';

export interface IImpactActionRepository {
  save(action: ImpactAction): Promise<void>;
  findByCitizenId(citizenId: string): Promise<ImpactAction[]>;
}
