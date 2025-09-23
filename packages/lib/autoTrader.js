// packages/lib/autoTrader.js
require('dotenv').config();
const fetch = require('node-fetch');
const { users } = require('./db');
const { fetchLatestSignal, hashSignal } = require('./signal');
const { openFromSignal } = require('./hlTrade');
const { storeStrategyEncrypted } = require('./strategyStore');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const inMemoryLocks = new Map(); // per-telegramId runtime lock (single process)

async function fetchLatestBtcSlotFallback() {
  const apiKey = process.env.ZKAGI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
  if (!apiKey) return { ok: false, reason: 'ZKAGI_API_KEY missing' };
  const r = await fetch('https://zynapse.zkagi.ai/today', { headers: { accept: 'application/json', 'api-key': apiKey }});
  if (!r.ok) return { ok: false, reason: `Signal API ${r.status}` };
  const j = await r.json();
  const arr = j?.forecast_today_hourly?.BTC;
  if (!Array.isArray(arr) || !arr.length) return { ok: false, reason: 'No BTC array' };
  const slot = arr[arr.length - 1];
  if (!slot?.signal || slot.forecast_price == null) return { ok: false, reason: 'Slot missing fields' };
  const sigHash = hashSignal({
    signal: slot.signal,
    forecast_price: slot.forecast_price,
    ts: slot.time || Math.floor(Date.now() / 3600000),
  });
  return { ok: true, slot, sigHash, ts: Date.now() };
}

async function getFreshSignal() {
  let s = await fetchLatestSignal();
  if (!s.ok) s = await fetchLatestBtcSlotFallback();
  return s;
}

// run one user once: fetch signal, dedupe, trade, persist
async function runOnceForUser(telegramId, log = console) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(telegramId) }, {
    projection: { hlMainAddress:1, hlAddress:1, hlSecretCipher:1, lastExecuted:1, agentID:1, autoTrade:1 }
  });

  if (!u?.hlSecretCipher || !u?.hlAddress) {
    log.warn('[auto] user not connected:', telegramId);
    return { ok:false, reason:'not_connected' };
  }
  if (!u?.autoTrade?.enabled) {
    return { ok:false, reason:'disabled' };
  }

  // process-wide lock (avoid concurrent)
  if (inMemoryLocks.get(telegramId)) return { ok:false, reason:'locked' };
  inMemoryLocks.set(telegramId, true);
  const lockUntil = Date.now() + 5 * 60 * 1000;
  try {
    // lightweight DB lock (best-effort)
    const res = await col.updateOne(
      { telegramId: String(telegramId), $or: [{ 'autoTrade.lockUntil': { $lt: Date.now() } }, { 'autoTrade.lockUntil': { $exists: false } }] },
      { $set: { 'autoTrade.lockUntil': lockUntil } }
    );
    if (!res.matchedCount) return { ok:false, reason:'db_locked' };

    const s = await getFreshSignal();
    if (!s.ok) return { ok:false, reason:s.reason || 'signal_fail' };
    const slot = s.slot;
    if (slot.signal === 'HOLD') return { ok:false, reason:'hold' };

    const sigHash = s.sigHash || hashSignal(slot);
    const already = u?.lastExecuted &&
                    u.lastExecuted.hash === sigHash &&
                    u.lastExecuted.signal === slot.signal;

    const lastAutoHash = u?.autoTrade?.lastHash;
    const sameAsLastAuto = lastAutoHash && lastAutoHash === sigHash;

    if (already || sameAsLastAuto) {
      return { ok:false, reason:'dupe' };
    }

    // Place trade
    const exec = await openFromSignal(telegramId, slot);

    // Persist both lastExecuted and autoTrade.lastHash
    await col.updateOne(
      { telegramId: String(telegramId) },
      { $set: {
          lastExecuted: {
            hash: sigHash, symbol: 'BTC', signal: slot.signal,
            time: slot.time || null, at: Date.now(),
          },
          'autoTrade.lastHash': sigHash,
          'autoTrade.lastRunAt': Date.now(),
        }
      }
    );

    // Optional: store encrypted strategy on-chain (guard with env)
    if (process.env.SAVE_STRATEGY_ONCHAIN === 'true' && process.env.STRATEGY_STORE_ADDRESS && u?.agentID) {
      try {
        const strategy = {
          t: Date.now(),
          source: 'ZkAGI-latest',
          slot,
          executed: { side: exec.side, size: exec.size, leverage: exec.leverage },
          mode: 'auto',
        };
        await storeStrategyEncrypted({
          telegramId,
          agentId: u.agentID,
          strategyJson: strategy,
        });
      } catch (e) {
        log.warn('[auto] storeStrategyEncrypted warn:', e?.message || e);
      }
    }

    return { ok:true, exec, sigHash, slot };
  } catch (e) {
    // best-effort error tracking
    await (await users()).updateOne(
      { telegramId: String(telegramId) },
      { $set: { 'autoTrade.lastError': (e?.message || String(e)).slice(0, 500), 'autoTrade.lastRunAt': Date.now() } }
    );
    return { ok:false, reason: e?.message || 'error' };
  } finally {
    inMemoryLocks.delete(telegramId);
    // clear DB lock if we still own it
    await (await users()).updateOne(
      { telegramId: String(telegramId), 'autoTrade.lockUntil': { $lte: lockUntil } },
      { $unset: { 'autoTrade.lockUntil': "" } }
    ).catch(()=>{});
  }
}

// scheduler: polls at interval with jitter and backoff
function startAutoTrader({ intervalMin = 30, bot = null, log = console } = {}) {
  let stopped = false;

  (async function loop() {
    while (!stopped) {
      try {
        const col = await users();
        // pull all enabled users
        const enabled = await col.find({ 'autoTrade.enabled': true }, { projection: { telegramId: 1 } }).toArray();
        log.log(`[auto] tick — users enabled=${enabled.length} @ ${new Date().toISOString()}`);

        for (const doc of enabled) {
          const uid = doc.telegramId;
          const res = await runOnceForUser(uid, log);

          // notify user (optional; keep quiet unless trade executed)
          if (res.ok) {
            if (bot) {
              bot.telegram.sendMessage(uid,
                `🤖 Auto-trade executed: *${res.exec.side}* ${res.exec.size} @ leverage ${res.exec.leverage}x`,
                { parse_mode: 'Markdown' }
              ).catch(()=>{});
            }
          }
          // small gap to avoid API bursts
          await sleep(800);
        }
      } catch (e) {
        log.error('[auto] tick error:', e?.message || e);
      }

      // interval with light jitter (±10%)
      const base = (intervalMin || 30) * 60 * 1000;
      const jitter = base * (Math.random() * 0.2 - 0.1);
      await sleep(base + jitter);
    }
  })();

  return () => { stopped = true; };
}

module.exports = {
  startAutoTrader,
  runOnceForUser,
};

