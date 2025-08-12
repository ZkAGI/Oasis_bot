# Oasis ROFL Telegram Bot & App

End‑to‑end template for:

* **Smart contracts** to register agents and store encrypted data
* **Telegram bot** to create agents and push/read encrypted payloads
* **ROFL TEE app** (Node API + Go sidecar) for enclave‑backed AES‑GCM

> This README assumes: Hardhat + ethers **v5**, Node 18+, Docker, and the Oasis CLI.

---

## Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Repo Layout](#repo-layout)
* [Contracts](#contracts)
* [Prerequisites](#prerequisites)
* [Setup & Environment](#setup--environment)
* [Deploy Contracts](#deploy-contracts)
* [Run the Bot](#run-the-bot)
* [Use the Bot in Telegram](#use-the-bot-in-telegram)
* [ROFL TEE App (Node + Go)](#rofl-tee-app-node--go)
* [Switch Bot from Stub → ROFL](#switch-bot-from-stub--rofl)
* [Troubleshooting](#troubleshooting)
* [Security Checklist](#security-checklist)

---

## Overview

This project lets you:

1. **Create an Agent** (by `AgentID` = bytes32) on‑chain via `AgentRegistry`.
2. **Encrypt & store** strategy/config in `StrategyStore` and state snapshots in `EncryptedPortfolio`.
3. **Decrypt on demand** via Telegram commands. In production, encryption/decryption is performed by a **ROFL TEE app**, so keys never leave the enclave.

---

## Architecture

```
Telegram  ──>  Bot (Node, Telegraf)
                │
                │  JSON (strategy/state)
                ▼
            ROFL Gateway ──> ROFL App (TEE)
                │              ├─ Node API (HTTP)
                │              └─ Go Sidecar (HKDF + AES‑GCM)
                │                         ▲
                │   iv|tag|ciphertext     │ per‑user key (TEE)
                ▼                          
      Sapphire (Oasis) Contracts
      ├─ AgentRegistry (AgentID → owner, metadataURI)
      ├─ StrategyStore (AgentID → bytes)
      └─ EncryptedPortfolio (AgentID → {data, iv})
```

---

## Repo Layout

```
.
├── bot/
│   ├── index.js                 # Telegraf entrypoint
│   ├── roflClient.js            # stub or ROFL HTTP client
│   └── commands/
│       ├── deploy.js            # /deploy  (attach to existing registry)
│       ├── addStrategy.js       # /addStrategy <AgentID> <json>
│       ├── setState.js          # /setState    <AgentID> <json>
│       ├── status.js            # /status      <AgentID>
│       └── history.js           # /history (batched)
├── contracts/
│   ├── AgentRegistry.sol        # ^0.8.28, AccessControl
│   ├── StrategyStore.sol        # bytes payload
│   ├── EncryptedPortfolio.sol   # {data, iv}
│   └── StateVerifier.sol        # Merkle verify (optional)
├── scripts/
│   ├── deploy.js                # Hardhat deploy all
│   └── checkDeployment.js       # Sanity check code at addresses
├── app/
│   ├── node-api/                # ROFL API container
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   └── go-sidecar/              # ROFL crypto sidecar
│       ├── main.go              # HKDF + AES‑GCM
│       ├── go.mod (+ go.sum)
│       └── Dockerfile
├── compose.yaml                 # ROFL app (both containers)
├── hardhat.config.js
├── package.json
├── .env                         # local runtime env (never commit)
└── rofl.yaml                    # created by `oasis rofl init`
```

---

## Contracts

* **AgentRegistry**: `createAgent(bytes32 id, string uri)` with `MANAGER_ROLE`. Stores `{owner, metadataURI}`. Emits `AgentCreated`/`AgentUpdated`.
* **StrategyStore**: `storeStrategy(bytes32 id, bytes payload)`; you store `iv|tag|ciphertext`.
* **EncryptedPortfolio**: `storeState(bytes32 id, bytes data, bytes12 iv)`; you store `data = tag|ciphertext` and `iv` separately.
* Solidity `pragma ^0.8.28`; OpenZeppelin v5+ (`_grantRole` instead of `_setupRole`).

---

## Prerequisites

* **Node.js** 18+ (Hardhat supports LTS; avoid Node 23 warnings)
* **npm** 9+
* **Docker** + **buildx** (to build linux/amd64 images)
* **Oasis CLI** (install platform‑specific binary)
* **Hardhat** (installed via devDeps)
* **Oasis Sapphire testnet** access + TEST ROSE in your wallet

> macOS users: if building the ROFL bundle locally fails due to missing `mksquashfs`/`veritysetup`, run the build inside a Debian container (see Troubleshooting).

---

## Setup & Environment

Install deps:

```bash
npm install
# (bot uses telegraf + ethers v5)
```

Create `.env` (example):

```ini
# RPC / Wallet
RPC_URL=https://testnet.sapphire.oasis.dev
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
BOT_TOKEN=123456789:ABCdefGhIJklmnOPQrstuVwXyZ

# Contracts (fill after deploy)
AGENT_REGISTRY_ADDRESS=0x...
STRATEGY_STORE_ADDRESS=0x...
ENCRYPTED_PORTFOLIO_ADDRESS=0x...
STATE_VERIFIER_ADDRESS=0x...

# History scanning (optional)
HISTORY_FROM_BLOCK=0
HISTORY_STEP=2000

# Either STUB or ROFL (pick one)
# --- STUB (dev only) ---
MASTER_SECRET=0x<32-byte-hex>

# --- ROFL (TEE) ---
# ROFL_GATEWAY_URL=https://<gateway-url>
# ROFL_APP_ID=rofl1q...
```

---

## Deploy Contracts

Compile & deploy to Sapphire testnet:

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network oasisTestnet
```

Copy the printed addresses into `.env`. Verify code exists:

```bash
node scripts/checkDeployment.js
```

> If `AgentRegistry.createAgent` reverts: grant `MANAGER_ROLE` to your bot’s wallet, or avoid creating duplicate `AgentID`s.

---

## Run the Bot

```bash
node bot/index.js
# Console prints the contract addresses in use and "🤖 Bot is live!"
```

---

## Use the Bot in Telegram

**1) Start**

```
/start
```

**2) Create Agent** (attach to existing registry)

```
/deploy {"name":"MyAgent","version":"1.0"}
```

Bot replies with `Registry: 0x...` and **AgentID** (bytes32). Keep that AgentID.

**3) Store Strategy** (encrypted → StrategyStore)

```
/addStrategy 0x<AGENT_ID> {"signal":"LONG","tp":120000}
```

**4) Store State** (dev helper; encrypted → EncryptedPortfolio)

```
/setState 0x<AGENT_ID> {"balance":1000,"positions":[{"symbol":"BTC","qty":0.5}]}
```

**5) Read State** (decrypt via stub/ROFL)

```
/status 0x<AGENT_ID>
```

**6) History** (batched getLogs)

```
/history
```

> AgentID is **not** a contract address. It is a 32‑byte key (0x + 64 hex) used across all stores.

---

## ROFL TEE App (Node + Go)

Two containers run inside the same TEE VM:

* **Go sidecar**: derives per‑user AES‑256 keys (HKDF) from a TEE secret `MASTER_KEY` and performs AES‑GCM.
* **Node API**: exposes `/v1/apps/<APP_ID>/encrypt` and `/decrypt`, forwarding to the sidecar.

**compose.yaml** (snippet):

```yaml
services:
  api:
    image: docker.io/<YOUR_USER>/rofl-node-api:0.1.0
    platform: linux/amd64
    environment:
      - SIDECAR_URL=http://crypto:8081
    ports: ["8080"]
  crypto:
    image: docker.io/<YOUR_USER>/rofl-go-sidecar:0.1.0
    platform: linux/amd64
    environment:
      - MASTER_KEY=${MASTER_KEY}
```

**Build & push images** (amd64):

```bash
# Node API
docker buildx build --platform linux/amd64 -t docker.io/<YOUR_USER>/rofl-node-api:0.1.0 --push app/node-api
# Go sidecar
docker buildx build --platform linux/amd64 -t docker.io/<YOUR_USER>/rofl-go-sidecar:0.1.0  --push app/go-sidecar
```

**ROFL lifecycle**:

```bash
oasis rofl init                                   # creates rofl.yaml
oasis rofl create --network testnet               # prints APP_ID
# Build the TEE bundle (requires mksquashfs + veritysetup)
oasis rofl build
# Create a 32‑byte base64 key and inject as a ROFL secret
openssl rand -base64 32 > mk.b64
oasis rofl secret set MASTER_KEY - < mk.b64
# Update app config and deploy to a provider
oasis rofl update
oasis rofl deploy
```

The deploy output shows your **Gateway URL**; use it below.

---

## Switch Bot from Stub → ROFL

Set bot env:

```ini
ROFL_GATEWAY_URL=https://<gateway-url>
ROFL_APP_ID=rofl1q...
```

Use a ROFL client in `bot/roflClient.js`:

```js
// returns Buffers: {iv, tag, ciphertext}
async function roflEncrypt(userId, utf8) { /* POST /encrypt */ }
async function roflDecrypt(userId, iv, tag, ct) { /* POST /decrypt */ }
```

