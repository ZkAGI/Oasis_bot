// packages/lib/encryptedPortfolio.js
// Upsert encrypted state into EncryptedPortfolio:
//   iv (12 bytes) passed as bytes12 arg
//   data = tag(16) | ciphertext

const { ethers } = require('ethers');
const { roflEncrypt } = require('../../bot/roflClient');

const ABI = [
  'function createState(bytes32 id, bytes data, bytes12 iv) external',
  'function updateState(bytes32 id, bytes data, bytes12 iv) external',
  'function getState(bytes32 id) external view returns (bytes data, bytes12 iv, bool exists)'
];

function isV6() { return typeof ethers.JsonRpcProvider === 'function'; }
function mkProvider(rpc) {
  return isV6() ? new ethers.JsonRpcProvider(rpc)
                : new ethers.providers.JsonRpcProvider(rpc);
}
function hexlify(u8) { return isV6() ? ethers.hexlify(u8) : ethers.utils.hexlify(u8); }
function isHexString(v, len) {
  const fn = isV6() ? ethers.isHexString : ethers.utils.isHexString;
  return fn(v, len);
}
function toUtf8Bytes(s) { return (isV6() ? ethers.toUtf8Bytes : ethers.utils.toUtf8Bytes)(s); }
function keccak256(b)   { return (isV6() ? ethers.keccak256   : ethers.utils.keccak256)(b); }

function b64(s) { return Buffer.from(s, 'base64'); }
function assertLen(label, buf, len) {
  if (buf.length !== len) throw new Error(`${label} must be ${len} bytes, got ${buf.length}`);
}

// Accept bytes32 hex, 32-byte array, or label (hashed)
function normalizeId(id) {
  if (typeof id === 'string') {
    if (id.startsWith('0x') && isHexString(id, 32)) return id; // bytes32 hex
    return keccak256(toUtf8Bytes(id));                         // label → bytes32
  }
  if (id && typeof id.length === 'number' && id.length === 32) {
    return hexlify(id);
  }
  throw new Error('id must be bytes32 hex, 32-byte array, or a string (will be hashed)');
}

/**
 * Encrypt JSON with ROFL and upsert:
 *  - data = tag(16) | ciphertext
 *  - iv   = 12 bytes (bytes12 arg)
 * Authorization: msg.sender must be Agent owner OR have MANAGER_ROLE in AgentRegistry.
 */
async function upsertEncryptedPortfolio({ telegramId, agentId, stateJson }) {
  const rpc  = process.env.RPC_URL;
  const pk   = process.env.PRIVATE_KEY; // signer must be MANAGER in AgentRegistry, or the agent owner
  const addr = process.env.ENCRYPTED_PORTFOLIO_ADDRESS; // <-- set this in .env
  if (!rpc || !pk || !addr) throw new Error('RPC_URL/PRIVATE_KEY/ENCRYPTED_PORTFOLIO_ADDRESS required');

  const provider = mkProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);
  const ep       = new ethers.Contract(addr, ABI, wallet);

  // 1) ROFL encrypt
  const enc = await roflEncrypt(String(telegramId), JSON.stringify(stateJson));
  if (!enc?.iv || !enc?.tag || !enc?.ciphertext) {
    throw new Error('roflEncrypt must return {iv, tag, ciphertext} in base64');
  }

  // 2) Build pieces
  const iv  = b64(enc.iv);  assertLen('iv', iv, 12);            // bytes12
  const tag = b64(enc.tag); assertLen('tag', tag, 16);          // 16
  const ct  = b64(enc.ciphertext); if (ct.length === 0) throw new Error('ciphertext empty');

  const dataBytes = Buffer.concat([tag, ct]);                   // data = tag|ct
  const idBytes32 = normalizeId(agentId);

  const fromAddr = await wallet.getAddress();

  // helper: simulate with explicit from (works in v5/v6)
  const simulate = async (popTxPromise) => {
    const txReq = await popTxPromise;
    txReq.from = fromAddr;
    try { await provider.call(txReq); return true; }
    catch (e) { console.warn('[encPortfolio] simulate revert:', e?.error?.data || e?.data || e?.message); return false; }
  };

  // 3) dual preflight
  const canCreate = await simulate(ep.populateTransaction.createState(idBytes32, hexlify(dataBytes), hexlify(iv)));
  const canUpdate = await simulate(ep.populateTransaction.updateState(idBytes32, hexlify(dataBytes), hexlify(iv)));

  // 4) choose and send
  if (canCreate && !canUpdate) {
    const tx = await ep.createState(idBytes32, hexlify(dataBytes), hexlify(iv));
    const rc = await tx.wait();
    return rc?.transactionHash || rc?.hash;
  }
  if (!canCreate && canUpdate) {
    const tx = await ep.updateState(idBytes32, hexlify(dataBytes), hexlify(iv));
    const rc = await tx.wait();
    return rc?.transactionHash || rc?.hash;
  }
  if (canCreate && canUpdate) {
    // slot exists but both simulate? (rare race) prefer UPDATE
    const tx = await ep.updateState(idBytes32, hexlify(dataBytes), hexlify(iv));
    const rc = await tx.wait();
    return rc?.transactionHash || rc?.hash;
  }

  throw new Error('EncryptedPortfolio: both create/update simulations reverted. Check roles/ownership and agentId.');
}

module.exports = {
  upsertEncryptedPortfolio,
  normalizeId
};

