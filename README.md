# Oasis ROFL Telegram Bot — Quick README

A compact guide for your current setup (with **History removed**).

---

## What this does

* Creates a **per-user wallet** on first contact (key encrypted with ROFL TEE).
* Lets you **register agents** on-chain and **store encrypted** strategies & portfolio snapshots.
* Can **auto-fetch forecasts** and do **paper trading** based on your allocation %.
* **ROFL-first** crypto (AES-256-GCM + HKDF); .

---

## Contracts used

* **AgentRegistry** – `createAgent(bytes32 id, string uri)` (guarded by `MANAGER_ROLE`) → stores `{owner, metadataURI}`.
* **StrategyStore** – `storeStrategy(bytes32 id, bytes payload)`; payload is `iv|tag|ciphertext`.
* **EncryptedPortfolio** – `storeState(bytes32 id, bytes data, bytes12 iv)`; data is `tag|ciphertext`.

> **AgentID** is a 32-byte key (`0x` + 64 hex), not a contract address.

---

## Prereqs

* Node 18+ (use LTS), npm 9+, Hardhat dev deps installed.
* Testnet ROSE for the deployer wallet.
* Optional for ROFL: Docker + buildx, Oasis CLI.

---

## Env file (`.env`) example

```ini
# RPC / signer
RPC_URL=
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
BOT_TOKEN=123456789:ABCdefGhIJklmnOPQrstuVwXyZ

# Contracts (fill after deploy)
AGENT_REGISTRY_ADDRESS=0x...
STRATEGY_STORE_ADDRESS=0x...
ENCRYPTED_PORTFOLIO_ADDRESS=0x...

# Paper trading seed & logs scan
PAPER_SEED_CASH=10000
HISTORY_FROM_BLOCK=0
HISTORY_STEP=2000

# Crypto backend (ROFL preferred, stub fallback)
# --- ROFL ---
# ROFL_GATEWAY_URL=https://<gateway>
# ROFL_APP_ID=rofl1q...
# --- STUB ---
MASTER_SECRET=0x<32-byte-hex>
```

---

## Deploy contracts

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network oasisTestnet
node scripts/checkDeployment.js
# paste addresses into .env
```

If `createAgent` reverts, grant the bot signer `MANAGER_ROLE` on your registry.

---

## Run the bot

```bash
npm install
node bot/index.js
# console: "🤖 Bot is live" and backend info
```

---

## Telegram commands

```
/start                 -> shows wallet + tips
/menu                  -> inline menu (Portfolio / Status / Wallet / Allocation / Deploy)
/wallet                -> your wallet address
/alloc <percent>       -> set paper-trade allocation (e.g., /alloc 25)
/deploy <json|url>     -> register agent with metadata (bot must have MANAGER_ROLE)
/addStrategy <AGENT_ID> <json> -> store encrypted strategy (also used by auto-forecast worker)
/setState <AGENT_ID> <json>    -> store encrypted portfolio snapshot
/status <AGENT_ID>     -> decrypt & show last snapshot via ROFL/stub
/portfolio             -> wallet balance, paper positions, latest strategy/forecast
```


---

## Switch Stub → ROFL

1. Build & deploy your ROFL app (get a **Gateway URL**).
2. Set in `.env`:

   ```ini
   ROFL_GATEWAY_URL=https://<gateway>
   ROFL_APP_ID=rofl1q...
   ```
3. Restart the bot.
   The bot uses **ROFL when available**, otherwise **stub** (same AES-GCM/HKDF) so features keep working.
---

## How encryption works (1-liner)

Per user, keys are derived with **HKDF-SHA256** from a TEE-sealed master key; data is encrypted with **AES-256-GCM** (`iv=12B`, `tag=16B`).

---

## Notes & tips

* New Telegram users automatically get a wallet on first interaction.
* **/deploy** always uses the **bot signer**; it must hold `MANAGER_ROLE` on the target `AgentRegistry`.
* Auto-forecast worker (if enabled) fetches hourly JSON, stores encrypted strategy, and paper-trades by your `/alloc`.

