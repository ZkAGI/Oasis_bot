// bot/roflClient.js
// ROFL-first crypto helper. If ROFL_* are set, uses TEE gateway.
// If not set and MASTER_SECRET is present, uses a dev-only local stub.
// To force ROFL-only: leave MASTER_SECRET unset; code will throw if ROFL is missing.

require('dotenv').config();
const crypto = require('crypto');

const hasROFL = !!(process.env.ROFL_GATEWAY_URL && process.env.ROFL_APP_ID);

const b64 = (b) => Buffer.from(b).toString('base64');
const ub64 = (s) => Buffer.from(s, 'base64');

async function roflEncrypt(userId, bytes) {
  if (hasROFL) {
    const res = await fetch(`${process.env.ROFL_GATEWAY_URL}/v1/apps/${process.env.ROFL_APP_ID}/encrypt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: String(userId), plaintext: b64(bytes) })
    });
    if (!res.ok) throw new Error(`ROFL encrypt failed: ${res.status}`);
    const j = await res.json();
    return { iv: ub64(j.iv), tag: ub64(j.tag), ciphertext: ub64(j.ciphertext) };
  }
  // ---- Dev stub (only if you *explicitly* set MASTER_SECRET) ----
  if (!process.env.MASTER_SECRET) {
    throw new Error('ROFL not configured (ROFL_GATEWAY_URL/ROFL_APP_ID). Set those envs or provide MASTER_SECRET for dev stub.');
  }
  const key = crypto.createHash('sha256')
    .update(Buffer.from(process.env.MASTER_SECRET.replace(/^0x/, ''), 'hex'))
    .digest(); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext: ct };
}

async function roflDecrypt(userId, iv, tag, ciphertext) {
  if (hasROFL) {
    const res = await fetch(`${process.env.ROFL_GATEWAY_URL}/v1/apps/${process.env.ROFL_APP_ID}/decrypt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: String(userId), iv: b64(iv), tag: b64(tag), ciphertext: b64(ciphertext) })
    });
    if (!res.ok) throw new Error(`ROFL decrypt failed: ${res.status}`);
    const j = await res.json();
    return ub64(j.plaintext);
  }
  if (!process.env.MASTER_SECRET) {
    throw new Error('ROFL not configured and no MASTER_SECRET for stub decryption.');
  }
  const key = crypto.createHash('sha256')
    .update(Buffer.from(process.env.MASTER_SECRET.replace(/^0x/, ''), 'hex'))
    .digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return pt;
}

function backendName() {
  return hasROFL ? 'ROFL' : (process.env.MASTER_SECRET ? 'stub' : 'unconfigured');
}

module.exports = { roflEncrypt, roflDecrypt, backendName };

