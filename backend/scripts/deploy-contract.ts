// Script de deploy do contrato EcoSolid na Sepolia
// Executar: npx ts-node scripts/deploy-contract.ts
// Requer BLOCKCHAIN_RPC_URL e BLOCKCHAIN_PRIVATE_KEY no .env

import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';
import * as solc from 'solc';

// Carrega .env manualmente (sem dependência dotenv)
function loadEnv() {
  // Procura .env em múltiplos caminhos possíveis
  const scriptDir = __dirname;
  const possiblePaths = [
    path.resolve(scriptDir, '..', '.env'),        // backend/.env
    path.resolve(scriptDir, '..', '.env.local'),  // backend/.env.local
    path.resolve(process.cwd(), '.env'),          // .env no cwd
    path.resolve(process.cwd(), '..', '.env'),    // ../.env (se cwd = backend/scripts)
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log('Usando .env:', envPath);
      parseEnvContent(fs.readFileSync(envPath, 'utf8'));
      return;
    }
  }
  console.warn('Aviso: Nenhum arquivo .env encontrado. Usando valores padrão.');
}

function parseEnvContent(content: string) {
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
  const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

  if (!PRIVATE_KEY || PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000001') {
    console.error('ERRO: BLOCKCHAIN_PRIVATE_KEY não definida no .env');
    console.error('Gere uma wallet com: node -e "const{ethers}=require(\'ethers\');const w=ethers.Wallet.createRandom();console.log(\'Address:\',w.address);console.log(\'PrivateKey:\',w.privateKey)"');
    console.error('E obtenha ETH de teste em https://sepoliafaucet.com');
    process.exit(1);
  }

  console.log('Conectando à Sepolia...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log('Wallet:', wallet.address);
  console.log('Saldo:', ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('ERRO: Wallet sem ETH de teste.');
    console.error('Obtenha em https://sepoliafaucet.com para o endereço:', wallet.address);
    process.exit(1);
  }

  // Compila o contrato Solidity usando solc
  console.log('\nCompilando contrato EcoSolid...');

  const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EcoSolid {
    event ActionRegistered(bytes32 indexed actionId, address indexed citizen, uint256 points, string actionType, uint256 timestamp);
    event RedemptionConfirmed(bytes32 indexed redemptionId, address indexed citizen, string benefit, uint256 solidSpent, uint256 timestamp);

    function registerAction(bytes32 actionId, address citizen, uint256 points, string calldata actionType) external {
        emit ActionRegistered(actionId, citizen, points, actionType, block.timestamp);
    }

    function confirmRedemption(bytes32 redemptionId, address citizen, string calldata benefit, uint256 solidSpent) external {
        emit RedemptionConfirmed(redemptionId, citizen, benefit, solidSpent, block.timestamp);
    }
}`;

  const input = {
    language: 'Solidity',
    sources: {
      'EcoSolid.sol': { content: source },
    },
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Erros de compilação:');
      errors.forEach((e: any) => console.error(e.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['EcoSolid.sol']['EcoSolid'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  console.log('Compilação OK.');
  console.log('Tamanho do bytecode:', bytecode.length, 'caracteres');

  // Deploy
  console.log('\nDeployando contrato EcoSolid na Sepolia...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();

  const address = await deployed.getAddress();
  console.log('');
  console.log('============================================');
  console.log('CONTRACT_ADDRESS=' + address);
  console.log('============================================');
  console.log('');
  console.log('Etherscan: https://sepolia.etherscan.io/address/' + address);
  console.log('');
  console.log('Adicione no .env do backend:');
  console.log('CONTRACT_ADDRESS=' + address);
}

main().catch(err => {
  console.error('Falha no deploy:', err?.reason || err?.message || err);
  process.exit(1);
});
