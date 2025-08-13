// bot/db.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'bot.db'));

// sensible pragmas for a local bot DB
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

function migrate() {
  db.exec(`
    -- per-user encrypted wallet + settings
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      addr        TEXT NOT NULL,
      enc_priv    BLOB NOT NULL,  -- tag|ciphertext
      iv          BLOB NOT NULL,  -- 12 bytes
      alloc_pct   REAL DEFAULT 0,
      cash        REAL DEFAULT 0,
      created_at  INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_alloc ON users(alloc_pct);

    -- most recent forecast fetched by the worker for each user
    CREATE TABLE IF NOT EXISTS latest_forecasts (
      telegram_id TEXT PRIMARY KEY,
      iso         TEXT,
      symbol      TEXT,
      side        TEXT,   -- LONG/SHORT/HOLD
      entry       REAL,
      tp          REAL,
      sl          REAL,
      updated_at  INTEGER
    );
  `);
}

function now() {
  return Math.floor(Date.now() / 1000);
}

module.exports = { db, migrate, now };

