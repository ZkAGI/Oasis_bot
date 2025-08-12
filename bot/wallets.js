// bot/wallets.js
const { ethers } = require('ethers');
const { db, now } = require('./db');
const { roflEncrypt, roflDecrypt } = require('./roflClient');

function getUser(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(telegramId));
}

async function ensureUserWallet(telegramId) {
  const u = getUser(telegramId);
  if (u) return u;

  const w = ethers.Wallet.createRandom();
  const priv = Buffer.from(w.privateKey.replace(/^0x/, ''), 'hex');

  const { iv, tag, ciphertext } = await roflEncrypt(telegramId, priv);
  const blob = Buffer.concat([tag, ciphertext]); // store as tag|ciphertext

  const seed = parseFloat(process.env.STARTING_CASH || '10000');
  db.prepare(`
    INSERT INTO users (telegram_id, addr, enc_priv, iv, alloc_pct, cash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(String(telegramId), w.address, blob, iv, 0, seed, now());

  return getUser(telegramId);
}

function setAllocation(telegramId, pct) {
  db.prepare('UPDATE users SET alloc_pct=? WHERE telegram_id=?')
    .run(Math.max(0, Math.min(100, pct)), String(telegramId));
}

async function getDecryptedPrivateKey(telegramId) {
  const u = getUser(telegramId);
  if (!u) throw new Error('user not found');
  const tag = Buffer.from(u.enc_priv).slice(0,16);
  const ct  = Buffer.from(u.enc_priv).slice(16);
  const iv  = Buffer.from(u.iv);
  const plain = await roflDecrypt(telegramId, iv, tag, ct);
  return '0x' + plain.toString('hex');
}

module.exports = { getUser, ensureUserWallet, setAllocation, getDecryptedPrivateKey };

