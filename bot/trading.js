// bot/trading.js
const { db, now } = require('./db');

function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      telegram_id TEXT,
      symbol TEXT,
      side   TEXT,    -- LONG/SHORT
      qty    REAL,
      entry  REAL,
      tp     REAL,
      sl     REAL,
      opened_at INTEGER,
      PRIMARY KEY (telegram_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      symbol TEXT,
      side   TEXT,
      qty    REAL,
      entry  REAL,
      exit   REAL,
      pnl    REAL,
      ts_open  INTEGER,
      ts_close INTEGER
    );
  `);
}
ensureTables();

/**
 * Execute a PAPER trade:
 * - uses user's alloc_pct and cash
 * - opens/overwrites a single position per symbol
 * - reduces cash by cost for LONG; increases for SHORT (simple model)
 */
function paperOpen(user, f) {
  // ignore HOLD
  if (f.side !== 'LONG' && f.side !== 'SHORT') return { skipped: true, reason: 'HOLD' };

  const alloc = Math.max(0, Math.min(100, Number(user.alloc_pct || 0)));
  if (alloc <= 0) return { skipped: true, reason: 'alloc=0' };

  const cash = Number(user.cash || 0);
  if (!Number.isFinite(cash) || cash <= 0) return { skipped: true, reason: 'cash=0' };

  const budget = (alloc / 100) * cash;
  if (budget <= 0) return { skipped: true, reason: 'budget=0' };

  const qty = budget / f.entry;
  const side = f.side;
  const effect = side === 'LONG' ? -budget : +budget; // SHORT "receives" budget (very simplified)

  // upsert position
  db.prepare(`
    INSERT INTO positions (telegram_id, symbol, side, qty, entry, tp, sl, opened_at)
    VALUES (@tid, @sym, @side, @qty, @entry, @tp, @sl, @ts)
    ON CONFLICT(telegram_id, symbol) DO UPDATE SET
      side=excluded.side, qty=excluded.qty, entry=excluded.entry, tp=excluded.tp, sl=excluded.sl, opened_at=excluded.opened_at
  `).run({
    tid: user.telegram_id, sym: f.symbol, side,
    qty, entry: f.entry, tp: f.tp, sl: f.sl, ts: now()
  });

  // adjust cash
  db.prepare(`UPDATE users SET cash = cash + ? WHERE telegram_id = ?`)
    .run(effect, user.telegram_id);

  return { opened: true, qty, cost: budget, side };
}

function buildSnapshot(telegram_id) {
  const u = db.prepare(`SELECT addr, cash, alloc_pct FROM users WHERE telegram_id=?`).get(telegram_id);
  const pos = db.prepare(`SELECT symbol, side, qty, entry, tp, sl, opened_at FROM positions WHERE telegram_id=?`).all(telegram_id);
  return {
    user: { telegramId: telegram_id, addr: u?.addr ?? null, cash: Number(u?.cash ?? 0), allocPct: Number(u?.alloc_pct ?? 0) },
    positions: pos,
    ts: now()
  };
}

module.exports = { paperOpen, buildSnapshot };

