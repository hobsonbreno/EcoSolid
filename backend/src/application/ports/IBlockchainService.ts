export interface IBlockchainService {
  mintSolidToken(walletAddress: string, amount: number): Promise<string>;
}
