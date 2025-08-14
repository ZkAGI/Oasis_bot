// bot/roflClient.js
// ROFL-first crypto with safe STUB fallback + legacy deriveRawKey shim.

require('dotenv').config();
const crypto = require('crypto');

// Use global fetch if Node >= 18; else lazy-load node-fetch.
const fetchFn = (global.fetch
  ? global.fetch.bind(global)
  : (...a) => import('node-fetch').then(({ default: f }) => f(...a)));

// --- Config / circuit breaker ---
const ROFL_URL = process.env.ROFL_GATEWAY_URL;
const ROFL_APP = process.env.ROFL_APP_ID;
const hasRoflConfig = !!(ROFL_URL && ROFL_APP);

// If ROFL errors, fall back to STUB for this long (ms)
const FALLBACK_MS = parseInt(process.env.ROFL_FALLBACK_MS || '60000', 10);

// If true, allow deriveRawKey to return a raw key even when ROFL is configured (NOT recommended for prod)
const DERIVE_FORCE_STUB = /^true$/i.test(process.env.DERIVE_RAW_KEY_FORCE_STUB || '');

// If true, when ROFL is configured but deriveRawKey is called, instead of throwing we will
// transparently use the STUB path.
// Useful while migrating legacy code. Still not recommended for production.
const DERIVE_ALLOW_STUB_WHEN_ROFL = /^true$/i.test(process.env.DERIVE_RAW_KEY_ALLOW_STUB || '');

let circuitOpenUntil = 0;
let _lastBackend = 'INIT';
function backendName() {
  const now = Date.now();
  if (hasRoflConfig && now >= circuitOpenUntil && !DERIVE_FORCE_STUB) return _lastBackend === 'ROFL' ? 'ROFL' : 'ROFL?';
  return 'STUB';
}

// --- STUB key derivation (HKDF over MASTER_SECRET) ---
function parseSecret(s) {
  if (!s) return null;
  if (/^0x[0-9a-fA-F]+$/.test(s)) return Buffer.from(s.slice(2), 'hex');
  try { return Buffer.from(s, 'base64'); } catch { return Buffer.from(s, 'utf8'); }
}
let _ephemeral;
function getMasterSecret() {
  const buf = parseSecret(process.env.MASTER_SECRET);
  if (buf && buf.length >= 16) return buf;
  if (!_ephemeral) {
    _ephemeral = crypto.randomBytes(32);
    console.warn('[roflClient] MASTER_SECRET not set; using EPHEMERAL in-memory secret. Stub-encrypted data will NOT decrypt after restart.');
  }
  return _ephemeral;
}
const HKDF_SALT = Buffer.from('oasis-bot-v1');
function deriveStubKey(userId) {
  return crypto.hkdfSync('sha256', getMasterSecret(), Buffer.from(String(userId)), HKDF_SALT, 32);
}

// --- STUB AES-GCM ---
function stubEncrypt(userId, bytes) {
  const key = deriveStubKey(userId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}
function stubDecrypt(userId, iv, tag, ciphertext) {
  const key = deriveStubKey(userId);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// --- HTTP helper ---
async function fetchJSONWithTimeout(url, options, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { ...options, signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    }
    return await res.json();
  } finally { clearTimeout(t); }
}

// --- Public: ROFL-first encrypt/decrypt with fallback ---
async function roflEncrypt(userId, bytes, timeoutMs = 4000) {
  const now = Date.now();
  if (hasRoflConfig && now >= circuitOpenUntil && !DERIVE_FORCE_STUB) {
    try {
      const j = await fetchJSONWithTimeout(
        `${ROFL_URL}/v1/apps/${ROFL_APP}/encrypt`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userId: String(userId),
            plaintext: Buffer.from(bytes).toString('base64'),
          }),
        },
        timeoutMs
      );
      _lastBackend = 'ROFL';
      return {
        iv: Buffer.from(j.iv, 'base64'),
        tag: Buffer.from(j.tag, 'base64'),
        ciphertext: Buffer.from(j.ciphertext, 'base64'),
      };
    } catch (e) {
      console.warn('[roflClient] ROFL encrypt failed, falling back to STUB:', e.message);
      circuitOpenUntil = now + FALLBACK_MS;
    }
  }
  _lastBackend = 'STUB';
  return stubEncrypt(userId, Buffer.from(bytes));
}

async function roflDecrypt(userId, iv, tag, ciphertext, timeoutMs = 4000) {
  const now = Date.now();
  if (hasRoflConfig && now >= circuitOpenUntil && !DERIVE_FORCE_STUB) {
    try {
      const j = await fetchJSONWithTimeout(
        `${ROFL_URL}/v1/apps/${ROFL_APP}/decrypt`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userId: String(userId),
            iv: Buffer.from(iv).toString('base64'),
            tag: Buffer.from(tag).toString('base64'),
            ciphertext: Buffer.from(ciphertext).toString('base64'),
          }),
        },
        timeoutMs
      );
      _lastBackend = 'ROFL';
      return Buffer.from(j.plaintext, 'base64');
    } catch (e) {
      console.warn('[roflClient] ROFL decrypt failed, falling back to STUB:', e.message);
      circuitOpenUntil = now + FALLBACK_MS;
    }
  }
  _lastBackend = 'STUB';
  return stubDecrypt(userId, iv, tag, ciphertext);
}

// --- Legacy shim: deriveRawKey(userId) ---
// • In ROFL mode (and not forcing stub), we DO NOT return the raw key (security).
//   -> throws unless you set DERIVE_RAW_KEY_ALLOW_STUB=true or DERIVE_RAW_KEY_FORCE_STUB=true
// • In STUB mode, returns a 32-byte Buffer like before.
async function deriveRawKey(userId) {
  const now = Date.now();
  const roflActive = hasRoflConfig && now >= circuitOpenUntil && !DERIVE_FORCE_STUB;

  if (roflActive && !DERIVE_ALLOW_STUB_WHEN_ROFL) {
    throw new Error(
      'deriveRawKey() is not available under ROFL (raw keys never leave TEE). ' +
      'Use roflEncrypt/roflDecrypt instead, or set DERIVE_RAW_KEY_ALLOW_STUB=true (not recommended for prod).'
    );
  }
  // STUB path (either no ROFL, ROFL failed, or you allowed stub under ROFL)
  return deriveStubKey(userId);
}

module.exports = {
  backendName,
  roflEncrypt,
  roflDecrypt,
  deriveRawKey, // legacy shim
};

