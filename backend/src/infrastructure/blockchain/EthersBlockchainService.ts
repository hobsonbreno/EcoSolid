import { Injectable } from '@nestjs/common';
import { IBlockchainService } from '../../application/ports/IBlockchainService';
import { ethers } from 'ethers';

@Injectable()
export class EthersBlockchainService implements IBlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private ready = false;

  constructor() {
    const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
    const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

    const abi = [
      "event ActionRegistered(bytes32 indexed actionId, address indexed citizen, uint256 points, string actionType, uint256 timestamp)",
      "event RedemptionConfirmed(bytes32 indexed redemptionId, address indexed citizen, string benefit, uint256 solidSpent, uint256 timestamp)",
      "function registerAction(bytes32 actionId, address citizen, uint256 points, string memory actionType) public",
      "function confirmRedemption(bytes32 redemptionId, address citizen, string memory benefit, uint256 solidSpent) public",
    ];

    try {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, abi, this.wallet);
      this.ready = true;
      console.log(`[Blockchain] Conectado à Sepolia. Wallet: ${this.wallet.address}`);
    } catch (err) {
      console.warn('[Blockchain] Aviso: Falha na inicialização. Transações serão simuladas.', err);
    }
  }

  async mintSolidToken(walletAddress: string, amount: number): Promise<string> {
    return this.registerAction(
      ethers.hexlify(ethers.randomBytes(32)),
      walletAddress,
      amount,
      'LEGACY_MINT',
    );
  }

  async registerAction(
    actionId: string,
    citizenAddress: string,
    points: number,
    actionType: string,
  ): Promise<string> {
    if (!this.ready) {
      const mockHash = 'mock-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      console.log(`[Blockchain] MOCK — hash simulado (sem configuração): ${mockHash}`);
      return mockHash;
    }

    try {
      const actionIdBytes = ethers.hexlify(ethers.randomBytes(32));
      const addr = citizenAddress || this.wallet.address;
      console.log(`[Blockchain] registerAction — actionId: ${actionIdBytes}, citizen: ${addr}, points: ${points}, type: ${actionType}`);

      const tx = await this.contract.registerAction(actionIdBytes, addr, points, actionType);
      console.log(`[Blockchain] Transação real enviada: ${tx.hash}`);
      await tx.wait();
      console.log(`[Blockchain] Transação real confirmada: ${tx.hash}`);
      return tx.hash;
    } catch (error: any) {
      console.error('[Blockchain] Falha ao registrar ação na blockchain:', error.message);
      // Salvar como pendente — nunca quebrar o fluxo do usuário
      const pendingHash = 'pending-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      console.log(`[Blockchain] Hash pendente (retry posterior): ${pendingHash}`);
      return pendingHash;
    }
  }

  async confirmRedemption(
    redemptionId: string,
    citizenAddress: string,
    benefit: string,
    solidSpent: number,
  ): Promise<string> {
    if (!this.ready) {
      const mockHash = 'mock-redemption-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      console.log(`[Blockchain] MOCK redemption — hash simulado (sem configuração): ${mockHash}`);
      return mockHash;
    }

    try {
      const redemptionIdBytes = ethers.hexlify(ethers.randomBytes(32));
      const addr = citizenAddress || this.wallet.address;
      console.log(`[Blockchain] confirmRedemption — id: ${redemptionIdBytes}, citizen: ${addr}, benefit: ${benefit}, solid: ${solidSpent}`);

      const tx = await this.contract.confirmRedemption(redemptionIdBytes, addr, benefit, solidSpent);
      console.log(`[Blockchain] Transação real enviada: ${tx.hash}`);
      await tx.wait();
      console.log(`[Blockchain] Transação real confirmada: ${tx.hash}`);
      return tx.hash;
    } catch (error: any) {
      console.error('[Blockchain] Falha ao confirmar resgate na blockchain:', error.message);
      const pendingHash = 'pending-redemption-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      return pendingHash;
    }
  }
}
