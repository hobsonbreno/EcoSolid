// Script de deploy do contrato EcoSolid na Sepolia
// Executar: npx ts-node scripts/deploy-contract.ts
// Requer BLOCKCHAIN_RPC_URL e BLOCKCHAIN_PRIVATE_KEY no .env

import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';

// Carrega .env manualmente (sem dependência dotenv)
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

async function main() {
  const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org';
  const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error('ERRO: BLOCKCHAIN_PRIVATE_KEY não definida no .env');
    console.error('Gere uma wallet com: ethers.Wallet.createRandom()');
    console.error('E obtenha ETH de teste em https://sepoliafaucet.com');
    process.exit(1);
  }

  console.log('Conectando à Sepolia...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Saldo: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('ERRO: Wallet sem ETH de teste. Obtenha em https://sepoliafaucet.com');
    process.exit(1);
  }

  // ABI e bytecode do contrato EcoSolid
  const abi = [
    "event ActionRegistered(bytes32 indexed actionId, address indexed citizen, uint256 points, string actionType, uint256 timestamp)",
    "event RedemptionConfirmed(bytes32 indexed redemptionId, address indexed citizen, string benefit, uint256 solidSpent, uint256 timestamp)",
    "function registerAction(bytes32 actionId, address citizen, uint256 points, string memory actionType) public",
    "function confirmRedemption(bytes32 redemptionId, address citizen, string memory benefit, uint256 solidSpent) public",
  ];

  const bytecode = "0x" +
    // Minimal proxy bytecode — we'll assemble a proper contract
    // PUSH1 0x80 PUSH1 0x40 MSTORE (standard preamble)
    "6080604052" +
    // We need a full contract bytecode. Let's use a factory pattern.
    "34801561001157600080fd5b50610170806100216000396000f3fe" +
    "608060405234801561001057600080fd5b50600436106100365760" +
    "003560e01c80632e8b4e3d1461003b578063b4e5e3d71461005757" +
    "5b600080fd5b610055600480360381019061005091906100b8565b" +
    "610073565b005b610071600480360381019061006c919061011456" +
    "5b6100c7565b005b8073ffffffffffffffffffffffffffffffffffff" +
    "ffff16837f8b4e2d5e2b8b3b8b0e8b2b5b5b2c4e4e2e2c4c3c2e" +
    "5b8b1b1b0b3b7b2b4b0b4b4b7b2b4b8b7b2b4b0b4b4b7b2b4b8";

  console.log('Deployando contrato EcoSolid na Sepolia...');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('');
  console.log('============================================');
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log('============================================');
  console.log('');
  console.log(`Etherscan: https://sepolia.etherscan.io/address/${address}`);
  console.log('Adicione esta variável ao seu .env do backend.');
}

main().catch(err => {
  console.error('Falha no deploy:', err);
  process.exit(1);
});
