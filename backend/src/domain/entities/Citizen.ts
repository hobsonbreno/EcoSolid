import { CitizenLevel } from '../enums/CitizenLevel';
export class Citizen {
  constructor(
    public readonly id: string,
    public name: string,
    public walletAddress?: string,
    public cpf?: string,
    public email?: string,
    public phone?: string,
    public bloodType?: string,
    public birthDate?: string,
    public address?: string,
    public facePhotoUrl?: string,
    public totalPoints: number = 0,
    public level: CitizenLevel = CitizenLevel.SEED,
    public createdAt: Date = new Date(),
    public credentialId?: string,
    public credentialPublicKey?: string,
  ) {}
  public addPoints(points: number): void {
    if (points < 0) throw new Error('Os pontos ganhos devem ser positivos.');
    this.totalPoints += points;
    if (this.totalPoints >= 1000) this.level = CitizenLevel.FOREST;
    else if (this.totalPoints >= 500) this.level = CitizenLevel.TREE;
    else if (this.totalPoints >= 100) this.level = CitizenLevel.SPROUT;
  }
}
