<div align="center">

# 🌱 EcoSolid

**Plataforma PWA de Impacto Social e Ambiental com Blockchain**

> *Faça o bem → Ganhe SOLID → Troque por benefícios reais.*

[![Backend](https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs)](./backend)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black?logo=next.js)](./frontend)
[![Blockchain](https://img.shields.io/badge/Blockchain-Ethereum%20Sepolia-627EEA?logo=ethereum)](./blockchain)
[![DB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb)](https://mongodb.com)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Railway-000?logo=vercel)](https://vercel.com)

</div>

---

## 📖 O que é o EcoSolid?

O **EcoSolid** é uma plataforma que incentiva cidadãos a realizarem **ações de impacto social e ambiental**, recompensando-os com um **token digital próprio chamado SOLID**, registrado de forma imutável na blockchain Ethereum.

Os tokens SOLID podem ser trocados por **benefícios reais** com parceiros locais: estacionamento, consultas médicas, descontos em energia, refeições e muito mais.

---

## 🏗️ Arquitetura

```
EcoSolid/
├── backend/       → API REST (NestJS + TypeScript + MongoDB)
├── frontend/      → PWA (Next.js + React + TypeScript)
├── blockchain/    → Smart Contract ERC-20 (Solidity + Hardhat)
├── docker-compose.yml
├── start.sh       → Inicia todos os serviços localmente
├── stop.sh        → Para todos os serviços
└── ngrok.yml      → Túneis públicos (opcional)
```

### Camadas do Backend (Clean Architecture)

```
presentation/    → Controllers HTTP (NestJS)
application/     → Use Cases, DTOs, Ports (interfaces)
domain/          → Entities, Enums, Repository Interfaces
infrastructure/  → MongoDB (Mongoose) + Blockchain (ethers.js)
```

---

## 🔄 Fluxo Principal

```
Cidadão realiza ação solidária (reciclagem, doação de sangue, etc.)
        ↓
Backend registra a ação como "PENDENTE_VALIDACAO"
        ↓
Parceiro valida a ação pelo portal
        ↓
Tokens SOLID são mintados na carteira blockchain do cidadão
        ↓
Cidadão resgata SOLID por benefícios reais com parceiros
```

---

## 🧩 Módulos do Sistema

### 👤 Cidadãos

- Registro com nome, CPF, e-mail, tipo sanguíneo, foto facial e carteira MetaMask
- Autenticação via **MetaMask (Web3)** + **WebAuthn / Biometria**
- Auto-preenchimento de endereço via **ViaCEP**
- Sistema de **níveis progressivos**:

| Nível | Pontos |
|---|---|
| 🌱 Semente | 0 – 99 |
| 🌿 Broto | 100 – 499 |
| 🌳 Árvore | 500 – 999 |
| 🌲 Floresta | 1000+ |

### ♻️ Ações de Impacto

| Tipo | Descrição |
|---|---|
| `RECYCLING` | Reciclagem de resíduos |
| `BLOOD_DONATION` | Doação de sangue |
| `FOOD_DONATION` | Doação de alimentos |
| `VOLUNTEERING` | Voluntariado |

Cada ação é registrada com geolocalização, foto de evidência e ID do parceiro validador.

### 🩸 Alertas de Sangue

- Hospitais criam alertas urgentes por tipo sanguíneo
- O sistema dispara **Push Notifications** (Web Push / VAPID) para cidadãos compatíveis
- Recompensa de **1.000 SOLID** para quem responder e doar
- Alertas ativos por **48 horas**

### 🎁 Benefícios e Resgates

| Parceiro | Segmento | Benefício |
|---|---|---|
| Zona Azul Fortaleza | Estacionamento | 60 min de vaga |
| Clínica Saúde+ | Hospital | Consultas / Exames |
| CAGECE / Enel CE | Energia | Desconto em contas |
| Restaurante Verde | Restaurante | 90 min de refeição |

- Código único de 8 caracteres por resgate
- Parceiro valida em até **30 minutos**
- SOLID é debitado após validação

### 🔗 Blockchain (Ethereum Sepolia)

- Smart Contract `EcoSolidToken` (ERC-20) escrito em Solidity
- Evento `ImpactRewarded` gravado permanentemente on-chain (auditável)
- Backend usa **ethers.js** para interagir com a rede
- Em desenvolvimento: transações simuladas com hash `mock-*`

---

## 🛠️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 + React + TypeScript |
| Backend | NestJS + TypeScript |
| Banco de Dados | MongoDB 6 (via Mongoose) |
| Blockchain | Solidity + Hardhat + ethers.js |
| Infra Local | Docker + Docker Compose |
| Túnel Público | Ngrok |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |
| Autenticação | MetaMask (Web3) + WebAuthn (Biometria) |
| Push Notifications | Web Push API (VAPID) |

---

## ⚙️ Pré-requisitos

Certifique-se de ter instalados:

- [Node.js](https://nodejs.org) `>= 18`
- [Docker](https://www.docker.com) + Docker Compose
- [Git](https://git-scm.com)
- [Ngrok](https://ngrok.com) *(opcional, para expor URLs públicas)*

---

## 🚀 Como Rodar o Projeto

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/EcoSolid.git
cd EcoSolid
```

### 2. Configure as variáveis de ambiente

```bash
# Backend
cp backend/.env.example backend/.env
```

Edite `backend/.env` com suas chaves:

```env
# MongoDB (local via Docker ou Atlas)
MONGO_URI=mongodb://root:rootpassword@localhost:27777/ecosolid_db?authSource=admin

# Porta do servidor
PORT=3005

# CORS — URL do frontend
CORS_ORIGIN=http://localhost:3000

# Blockchain Sepolia
BLOCKCHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
BLOCKCHAIN_PRIVATE_KEY=0x...    # Sua chave privada de teste
CONTRACT_ADDRESS=0x...          # Endereço do contrato deployado

# Web Push / VAPID
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Admin
ADMIN_KEY=ecosolid-admin-2026

# Email (Gmail App Password)
GMAIL_USER=seuemail@gmail.com
GMAIL_APP_PASS=xxxx
```

> **Gerar chaves VAPID:**
> ```bash
> npx web-push generate-vapid-keys
> ```

> **Gerar carteira Ethereum de teste:**
> ```bash
> node -e "const{ethers}=require('ethers');const w=ethers.Wallet.createRandom();console.log('Address:',w.address,'PrivateKey:',w.privateKey)"
> ```

### 3. Instale as dependências

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Blockchain
cd blockchain && npm install && cd ..
```

---

## ▶️ Rodar tudo com um comando

A forma mais simples é usar o script de automação na raiz:

```bash
./start.sh
```

Este script:
1. Sobe o **MongoDB** via Docker
2. Compila e inicia o **Backend** (porta `3005`)
3. Compila e inicia o **Frontend** (porta `3000`)
4. Inicia os **túneis Ngrok** (se configurado)

Para parar todos os serviços:

```bash
./stop.sh
```

---

## 🐳 Rodar via Docker Compose (completo)

```bash
docker compose up -d
```

| Serviço | Porta local |
|---|---|
| MongoDB | `27777` |
| Backend (API) | `3000` |
| Frontend (PWA) | `3001` |

---

## 🔧 Rodar cada serviço individualmente

### MongoDB (Docker)

```bash
docker compose up -d ecosolid-mongo
```

### Backend (NestJS)

```bash
cd backend
npm run start:dev   # Modo desenvolvimento (hot-reload)
# ou
npm run build && node dist/main   # Modo produção
```

API disponível em: `http://localhost:3005`

### Frontend (Next.js)

```bash
cd frontend
npm run dev         # Modo desenvolvimento
# ou
npm run build && npx next start   # Modo produção
```

PWA disponível em: `http://localhost:3000`

### Blockchain (Deploy do Contrato)

```bash
cd blockchain

# Compilar contratos
npx hardhat compile

# Deploy na rede Sepolia
npx ts-node scripts/deploy-contract.ts

# Copie o endereço gerado para backend/.env > CONTRACT_ADDRESS
```

> **ETH de teste Sepolia:** https://sepoliafaucet.com

---

## 📡 Endpoints da API (resumo)

| Recurso | Método | Rota |
|---|---|---|
| Cidadãos | `GET / POST` | `/citizens` |
| Ações de Impacto | `POST` | `/impact-actions` |
| Alertas de Sangue | `GET / POST` | `/alerts/blood` |
| Benefícios | `POST` | `/benefits/redeem` |
| Validar Resgate | `POST` | `/benefits/validate` |
| Parceiros | `GET / POST` | `/partners` |
| Dashboard | `GET` | `/dashboard/metricas` |
| Admin | `GET` | `/admin/...` |
| Push Subscription | `POST` | `/push/subscribe` |

---

## 📊 Logs e Diagnóstico

```bash
# Log do backend
tail -f /tmp/ecosolid-backend.log

# Log do frontend
tail -f /tmp/ecosolid-frontend.log

# Log do Ngrok
tail -f /tmp/ecosolid-ngrok.log

# Containers Docker
docker compose logs -f
```

---

## 📁 Estrutura de Pastas (detalhada)

```
backend/src/
├── domain/
│   ├── entities/         → Citizen.ts, ImpactAction.ts
│   ├── enums/            → ActionType.ts, CitizenLevel.ts
│   └── repositories/     → Interfaces (ICitizenRepository, etc.)
├── application/
│   ├── use-cases/        → RegisterCitizenUseCase, RegisterImpactUseCase, etc.
│   ├── dtos/             → Objetos de transferência de dados
│   └── ports/            → IBlockchainService
├── infrastructure/
│   ├── database/mongo/   → Schemas e Repositories MongoDB
│   └── blockchain/       → EthersBlockchainService.ts
└── presentation/
    ├── controllers/      → CitizenController, ImpactActionController, etc.
    └── modules/          → Módulos NestJS

blockchain/
├── contracts/
│   └── EcoSolidToken.sol → Smart Contract ERC-20
└── hardhat.config.ts

frontend/src/app/
├── page.tsx              → PWA principal (cidadão)
├── admin/                → Painel administrativo
├── parceiro/             → Portal do parceiro
├── gestao/               → Gestão de impacto
└── impacto/              → Registro de ações
```

---

## 🌐 Deploy

| Serviço | Plataforma | Comando |
|---|---|---|
| Frontend | Vercel | `vercel --prod` (na pasta `frontend/`) |
| Backend | Railway | Push automático via GitHub |
| Blockchain | Sepolia | `npx ts-node scripts/deploy-contract.ts` |

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](./LICENSE) para detalhes.

---

<div align="center">

Feito com 💚 para transformar ações solidárias em impacto real.

</div>
