import { Injectable } from '@nestjs/common';
import { IBlockchainService } from '../../application/ports/IBlockchainService';
import { ethers } from 'ethers';

@Injectable()
export class EthersBlockchainService implements IBlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    // Em produção isso estaria num .env seguro
    const RPC_URL = process.env.RPC_URL || 'https://rpc2.sepolia.org';
    const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'; 
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'; 

    // ABI reduzida contendo só a função que nosso MVP precisa
    const abi = [
      "function mintSolidToken(address to, uint256 amount) public returns (bool)"
    ];

    try {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, abi, this.wallet);
    } catch (err) {
      console.warn('[Blockchain] Aviso: Falha na inicialização do provider Ethers. Provavelmente as chaves estão ausentes.', err);
    }
  }

  async mintSolidToken(walletAddress: string, amount: number): Promise<string> {
    try {
      console.log(`[Blockchain] Iniciando emissão de ${amount} SOLID para ${walletAddress}...`);
      
      // Quando o Smart Contract estiver pronto e deployado na Sepolia, 
      // usaremos a linha abaixo para registrar na rede real:
      // const tx = await this.contract.mintSolidToken(walletAddress, amount);
      // await tx.wait();
      // return tx.hash;
      
      // Mock para MVP/Desenvolvimento Inicial
      const mockTxHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      
      console.log(`[Blockchain] Emissão concluída! TxHash: ${mockTxHash}`);
      return mockTxHash;

    } catch (error) {
      console.error('[Blockchain] Falha crítica na chamada do Smart Contract:', error);
      throw new Error('Erro ao integrar com a rede Blockchain para emissão de Tokens.');
    }
  }
}
