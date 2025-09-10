
# Pawpad Oasis Telegram Bot

This project combines:

* **Oasis Sapphire smart contracts** for registering agents and storing encrypted strategies.
* **Telegram bot** for onboarding, connecting wallets, risk control, and trading with Hyperliquid.
* **ROFL TEE app** for enclave-backed encryption/decryption of user secrets.
* **Hyperliquid integration** to place and manage trades directly from Telegram.

---

## 🚀 Features

* **Agent creation** on Oasis Sapphire testnet.
* **Secure HL connection**: user pastes API secret, main wallet, and API wallet once; all sensitive fields are encrypted via ROFL.
* **Trading modes**:

  * Manual: view latest signal and place trades instantly.
  * Auto-trade: bot executes signals automatically on Hyperliquid.
* **Risk management**: use defaults (ZkAGI) or set custom limits.
* **Portfolio tracking**: unified view of both HL API wallet and HL Main wallet.
* **Encrypted strategy store**: strategies saved on-chain with AES-GCM.

---

## 🧩 Architecture

```
User (Telegram)
   │
   ▼
Bot (Telegraf, Node.js)
   │   ┌─────────── Secure encrypt/decrypt ───────────┐
   ├──▶│  ROFL Gateway → ROFL TEE App (Node + Go)     │
   │   └──────────────────────────────────────────────┘
   │
   ├─ Oasis Sapphire contracts (AgentRegistry, StrategyStore)
   │
   └─ Hyperliquid API (trading, portfolio, signals)
```

---

## ⚙️ Prerequisites

* Node.js **18+**
* npm **9+**
* Docker + buildx (for ROFL app containers)
* Oasis CLI
* TEST ROSE on Sapphire testnet
* Hyperliquid API wallet (funded on **perps account**)

---

## 🔑 Environment

Example `.env`:

```ini
# Telegram
BOT_TOKEN=123456789:ABCdefGhIJklmnOPQrstuVwXyZ

# -------- ROFL Gateway (your deployed ROFL app) --------
ROFL_GATEWAY_URL=
ROFL_APP_ID=

# Oasis
RPC_URL=https://testnet.sapphire.oasis.dev
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
AGENT_REGISTRY_ADDRESS=0x...
STRATEGY_STORE_ADDRESS=0x...

# Signal feed
# -------- Forecast API --------
FORECAST_API_URL=
ZKAGI_API_KEY=

```

> When users connect through Telegram, HL secrets are encrypted with ROFL and stored in MongoDB.

---

## 💬 User Journey in Telegram

1. **Start**

   * `/start` registers your Agent on Oasis and shows the main keyboard.

2. **Connect Hyperliquid**

   * Paste your HL API secret → encrypted with ROFL.
   * Provide API wallet address + Main wallet address.
   * Once connected, bot shows confirmation and unlocks trading menu.

3. **Trading Menu**

   * 📊 **Portfolio** → shows balances & open positions (API + Main wallet).
   * ⚙️ **Adjust Risk** → use defaults or custom leverage/size.
   * 🚀 **Trade Now** → place a manual trade from the latest signal.
   * 🤖 **Auto Trade** → bot watches signals every 30 mins and executes.
   * 🛑 **Close All** → liquidate all open HL positions.
   * 🔄 **Check Signal** → print the latest BTC signal.
   * 🎰 **Spin the Wheel** → coming soon.

---

```
## 🛠 Run Locally

```bash
npm install
node bot/index.js
```

The bot prints:

```
🤖 Bot is live with keyboard.
```

---

## 🔐 Security Checklist

* All user HL secrets encrypted with AES-GCM inside ROFL TEE.
* Telegram messages instruct users to delete sensitive messages after sending.
* Friendly error messages (no raw stack traces shown to users).

---

## ❓ Troubleshooting

* **`Insufficient margin`** → deposit into HL API wallet perps account.
* **Timeouts** → the bot shows a placeholder (“checking…”) until Hyperliquid responds.
* **ROFL errors** → confirm `ROFL_GATEWAY_URL` and `ROFL_APP_ID` in `.env`.

---

⚡ You now have a **TEE-backed Telegram trading agent** integrated with Hyperliquid and Oasis Sapphire.


