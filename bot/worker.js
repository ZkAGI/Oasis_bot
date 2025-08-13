// bot/worker.js
require('dotenv').config();
const { ethers } = require('ethers');
const { db, now } = require('./db');
const { fetchLatestForecast } = require('./forecast');
const { roflEncrypt } = require('./roflClient');
const { paperOpen, buildSnapshot } = require('./trading');

const STRAT_ABI = [
  "function storeStrategy(bytes32 id, bytes payload) external"
];
const EP_ABI = [
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],
   "name":"encryptedStates",
   "outputs":[{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes12","name":"iv","type":"bytes12"}],
   "stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes12","name":"iv","type":"bytes12"}],
   "name":"storeState","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const signer   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

let lastISO = null;

async function tick() {
  if (!process.env.SIGNAL_API_URL) return;               // nothing to do
  const f = await fetchLatestForecast();
  if (!f) return;

  // de-dup per process
  if (lastISO === f.iso) return;
  lastISO = f.iso;

  // on-chain targets (optional)
  const stratAddr = process.env.STRATEGY_STORE_ADDRESS;
  const epAddr    = process.env.ENCRYPTED_PORTFOLIO_ADDRESS;
  const store = stratAddr ? new ethers.Contract(stratAddr, STRAT_ABI, signer) : null;
  const ep    = epAddr    ? new ethers.Contract(epAddr,    EP_ABI,   signer) : null;

  // for every user with a wallet (and alloc possibly >0), push & trade
  const users = db.prepare(`SELECT telegram_id, addr, alloc_pct, cash FROM users`).all();
  for (const u of users) {
    const agentID = ethers.utils.id(String(u.telegram_id));

    // 1) Save encrypted strategy on-chain (if address provided)
    if (store) {
      const payloadUtf8 = Buffer.from(JSON.stringify({
        iso: f.iso, symbol: f.symbol, side: f.side, entry: f.entry, tp: f.tp, sl: f.sl
      }), 'utf8');

      const { iv, tag, ciphertext } = await roflEncrypt(String(u.telegram_id), payloadUtf8);
      const packed = Buffer.concat([tag, ciphertext]); // tag|ciphertext

      try {
        const tx = await store.storeStrategy(agentID, packed);
        await tx.wait();
      } catch (e) {
        console.error('storeStrategy failed for', u.telegram_id, e.message);
      }
    }

    // 2) Paper trade based on alloc
    const result = paperOpen({ ...u, telegram_id: String(u.telegram_id) }, f);

    // 3) Optional: immediately snapshot to EncryptedPortfolio
    if (process.env.AUTO_SNAPSHOT === 'true' && ep) {
      const snap = buildSnapshot(String(u.telegram_id));
      const bytes = Buffer.from(JSON.stringify(snap), 'utf8');
      const { iv, tag, ciphertext } = await roflEncrypt(String(u.telegram_id), bytes);
      const packed = Buffer.concat([tag, ciphertext]);

      try {
        const tx = await ep.storeState(agentID, packed, iv);
        await tx.wait();
      } catch (e) {
        console.error('storeState failed for', u.telegram_id, e.message);
      }
    }

    if (result?.opened) {
      console.log(`PAPER ${result.side} for ${u.telegram_id}: qty=${result.qty.toFixed(6)} at ${f.entry}`);
    }
  }
}

function startWorker() {
  const sec = Number(process.env.SIGNAL_POLL_SEC || 60);
  console.log(`📡 Forecast worker polling every ${sec}s…`);
  tick().catch(console.error);
  setInterval(() => tick().catch(console.error), sec * 1000);
}

module.exports = { startWorker };

