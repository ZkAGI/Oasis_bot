// bot/commands/portfolio.js
require('dotenv').config();
const { db } = require('../db');
const { ethers } = require('ethers');

try { require('../trading'); } catch (_) {} // ensure tables exist

function fmt(n, dp = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: dp });
}

// Chunked log scanning to satisfy Sapphire RPC limits.
async function getLatestStrategyEventChunked(provider, store, agentID) {
  const toBlock = await provider.getBlockNumber();

  // Window size PER CALL (keep <= 100 due to RPC rule). Default 80.
  const WINDOW = parseInt(process.env.HISTORY_WINDOW_BLOCKS || '80', 10);
  // Total depth we are willing to scan (defaults to 4000).
  const MAX_DEPTH = parseInt(process.env.HISTORY_MAX_BLOCKS || '4000', 10);

  const minBlock = Math.max(0, toBlock - MAX_DEPTH);
  let end = toBlock;
  let start = Math.max(minBlock, end - WINDOW + 1);

  const filter = store.filters.StrategyStored(agentID);

  while (end >= minBlock) {
    // Query this small window.
    const events = await store.queryFilter(filter, start, end);
    if (events.length) {
      // Return the latest in this window.
      return events[events.length - 1];
    }
    // Move the window one chunk back.
    end = start - 1;
    start = Math.max(minBlock, end - WINDOW + 1);
  }
  return null;
}

module.exports = async (ctx) => {
  try {
    const uid = String(ctx.from.id);

    // --- User row (wallet + paper ledger basics)
    const u = db.prepare(
      `SELECT addr, cash, alloc_pct FROM users WHERE telegram_id=?`
    ).get(uid);
    if (!u) return ctx.reply('ℹ️ No wallet found. Send /start first.');

    // --- On-chain native balance (ROSE)
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const balanceWei = await provider.getBalance(u.addr);
    const balanceRose = ethers.utils.formatEther(balanceWei);

    // --- Paper positions
    const positions = db.prepare(
      `SELECT symbol, side, qty, entry, tp, sl, opened_at
         FROM positions
        WHERE telegram_id=?`
    ).all(uid);

    const cur = process.env.BASE_CURRENCY || 'USDT';
    let msg =
      `💼 Portfolio\n` +
      `Address: ${u.addr}\n` +
      `On-chain balance: ${fmt(balanceRose, 6)} ROSE\n` +
      `Paper cash: ${fmt(u.cash, 2)} ${cur}\n` +
      `Allocation: ${fmt(u.alloc_pct, 0)}%\n\n`;

    if (!positions.length) {
      msg += `No open paper positions.\n\n`;
    } else {
      msg += `Open paper positions:\n`;
      for (const p of positions) {
        const openedISO = p.opened_at ? new Date(p.opened_at * 1000).toISOString() : '—';
        msg += `• ${p.symbol} ${p.side}  qty=${fmt(p.qty, 6)}  @ ${fmt(p.entry)}  (TP ${fmt(p.tp)}, SL ${fmt(p.sl)})  • opened ${openedISO}\n`;
      }
      msg += `\n`;
    }

    // --- Latest fetched forecast (saved by worker)
    db.exec(`
      CREATE TABLE IF NOT EXISTS latest_forecasts (
        telegram_id TEXT PRIMARY KEY,
        iso         TEXT,
        symbol      TEXT,
        side        TEXT,
        entry       REAL,
        tp          REAL,
        sl          REAL,
        updated_at  INTEGER
      );
    `);
    const latest = db.prepare(
      `SELECT iso, symbol, side, entry, tp, sl, updated_at
         FROM latest_forecasts WHERE telegram_id=?`
    ).get(uid);

    if (latest) {
      const updISO = latest.updated_at ? new Date(latest.updated_at * 1000).toISOString() : '—';
      msg += `🛰 Latest fetched forecast (worker):\n`;
      msg += `• ${latest.symbol} ${latest.side}  entry=${fmt(latest.entry)}  TP=${fmt(latest.tp)}  SL=${fmt(latest.sl)}\n`;
      msg += `• issued hour: ${latest.iso} • saved: ${updISO}\n\n`;
    } else {
      msg += `🛰 No fetched forecast recorded yet.\n\n`;
    }

    // --- Latest on-chain StrategyStored (chunked logs)
    const stratAddr = process.env.STRATEGY_STORE_ADDRESS;
    if (stratAddr) {
      const store = new ethers.Contract(
        stratAddr,
        ["event StrategyStored(bytes32 indexed id, uint256 size)"],
        provider
      );
      const agentID = ethers.utils.id(uid);

      let lastEvt = null;
      try {
        lastEvt = await getLatestStrategyEventChunked(provider, store, agentID);
      } catch (e) {
        // Show a short hint if RPC complained about ranges.
        msg += `🧾 Could not fetch on-chain StrategyStored events (${e?.code || 'ERR'}). Try lowering HISTORY_WINDOW_BLOCKS.\n`;
      }

      if (lastEvt) {
        const blk = await provider.getBlock(lastEvt.blockHash);
        const when = new Date((blk?.timestamp || 0) * 1000).toISOString();
        msg += `🧾 Latest on-chain StrategyStored:\n`;
        msg += `• block #${lastEvt.blockNumber} @ ${when} • size=${lastEvt.args.size?.toString?.() || '—'} bytes\n`;
        msg += `• tx: ${lastEvt.transactionHash}\n`;
      } else {
        const WINDOW = parseInt(process.env.HISTORY_WINDOW_BLOCKS || '80', 10);
        const MAX_DEPTH = parseInt(process.env.HISTORY_MAX_BLOCKS || '4000', 10);
        msg += `🧾 No StrategyStored found in the last ~${MAX_DEPTH} blocks (queried in ${WINDOW}-block windows).\n`;
      }
    } else {
      msg += `🧾 StrategyStore not configured (set STRATEGY_STORE_ADDRESS in .env to show on-chain strategy log).\n`;
    }

    return ctx.reply(msg);
  } catch (e) {
    console.error(e);
    return ctx.reply('❌ /portfolio failed: ' + e.message);
  }
};

