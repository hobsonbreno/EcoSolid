export interface IBlockchainService {
  mintSolidToken(walletAddress: string, amount: number): Promise<string>;
  registerAction(
    actionId: string,
    citizenAddress: string,
    points: number,
    actionType: string,
  ): Promise<string>;
  confirmRedemption(
    redemptionId: string,
    citizenAddress: string,
    benefit: string,
    solidSpent: number,
  ): Promise<string>;
}
