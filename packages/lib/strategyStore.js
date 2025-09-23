// const { ethers } = require('ethers');
// const { roflEncrypt } = require('../../bot/roflClient');

// const STRATEGY_STORE_ABI = [
//   'function storeStrategy(bytes32 id, bytes payload) external'
// ];

// function isV6() {
//   // ethers v6 has JsonRpcProvider at root, v5 under providers.*
//   return typeof ethers.JsonRpcProvider === 'function';
// }

// function mkProvider(rpcUrl) {
//   return isV6()
//     ? new ethers.JsonRpcProvider(rpcUrl)                       // v6
//     : new ethers.providers.JsonRpcProvider(rpcUrl);            // v5
// }

// function hexlify(u8) {
//   return isV6() ? ethers.hexlify(u8) : ethers.utils.hexlify(u8);
// }

// function isHexString(v, lenBytes) {
//   const fn = isV6() ? ethers.isHexString : ethers.utils.isHexString;
//   return fn(v, lenBytes);
// }

// function keccak256Bytes32(s) {
//   const toUtf8 = isV6() ? ethers.toUtf8Bytes : ethers.utils.toUtf8Bytes;
//   const keccak = isV6() ? ethers.keccak256 : ethers.utils.keccak256;
//   return keccak(toUtf8(s));
// }

// function toBytesB64(b64) {
//   return Buffer.from(b64, 'base64'); // Uint8Array
// }

// function assertLen(label, got, expected) {
//   if (got.length !== expected) {
//     throw new Error(`${label} must be ${expected} bytes, got ${got.length}`);
//   }
// }

// function normalizeAgentId(agentId) {
//   // Accepts:
//   //  - 0x-prefixed 32-byte hex
//   //  - Uint8Array/Buffer length 32
//   //  - string (we'll keccak it for determinism)
//   if (typeof agentId === 'string') {
//     if (agentId.startsWith('0x') && isHexString(agentId, 32)) {
//       return agentId;
//     }
//     // treat as label -> hash
//     return keccak256Bytes32(agentId);
//   }
//   if (agentId && typeof agentId.length === 'number' && agentId.length === 32) {
//     return hexlify(agentId);
//   }
//   throw new Error('agentId must be bytes32 hex, 32-byte array, or a string to hash');
// }

// /** Build iv|tag|ciphertext bytes payload from base64 parts */
// function encodeStrategyPayload({ ivB64, tagB64, ciphertextB64 }) {
//   const iv = toBytesB64(ivB64);
//   const tag = toBytesB64(tagB64);
//   const ct = toBytesB64(ciphertextB64);

//   // AES-GCM norms: iv=12 bytes, tag=16 bytes
//   assertLen('iv', iv, 12);
//   assertLen('tag', tag, 16);
//   if (ct.length === 0) throw new Error('ciphertext must not be empty');

//   return Buffer.concat([iv, tag, ct]);
// }

// /**
//  * Encrypt strategy JSON with ROFL and store on-chain.
//  * @param {Object} args
//  * @param {string|number} args.telegramId - Per-user salt for ROFL encryption
//  * @param {string|Uint8Array} args.agentId - bytes32 hex/array or label (string) to be hashed
//  * @param {Object} args.strategyJson - Plain JS object to encrypt
//  * @returns {Promise<string>} tx hash
//  */
// async function storeStrategyEncrypted({ telegramId, agentId, strategyJson }) {
//   const rpc = process.env.RPC_URL;
//   const pk = process.env.PRIVATE_KEY; // signer with rights to call contract
//   const strategyAddr = process.env.STRATEGY_STORE_ADDRESS;
//   if (!rpc || !pk || !strategyAddr) {
//     throw new Error('RPC_URL/PRIVATE_KEY/STRATEGY_STORE_ADDRESS required');
//   }

//   const provider = mkProvider(rpc);
//   const wallet = new ethers.Wallet(pk, provider);
//   const store = new ethers.Contract(strategyAddr, STRATEGY_STORE_ABI, wallet);

//   // 1) Encrypt via ROFL (expects {iv, tag, ciphertext} as base64)
//   const enc = await roflEncrypt(String(telegramId), JSON.stringify(strategyJson));
//   if (!enc?.iv || !enc?.tag || !enc?.ciphertext) {
//     throw new Error('roflEncrypt must return {iv, tag, ciphertext} in base64');
//   }

//   // 2) Build iv|tag|ciphertext payload
//   const payloadBytes = encodeStrategyPayload({
//     ivB64: enc.iv,
//     tagB64: enc.tag,
//     ciphertextB64: enc.ciphertext,
//   });
//   const payloadHex = hexlify(payloadBytes); // 0x…

//   // 3) Normalize agent id to bytes32
//   const idBytes32 = normalizeAgentId(agentId);

//   // 4) Send tx
//   const tx = await store.storeStrategy(idBytes32, payloadHex);
//   const rc = await tx.wait();
//   // ethers v5 vs v6: receipt hash prop differs slightly, handle both
//   return rc?.transactionHash || rc?.hash;
// }

// module.exports = {
//   storeStrategyEncrypted,
//   encodeStrategyPayload,     // exported for tests/other callers
//   normalizeAgentId,
// };

// packages/lib/strategyStore.js
// Upsert encrypted strategy into StrategyStore: payload = iv(12)|tag(16)|ciphertext


// ------------------------------------------------------------------------------------------------------

// const { ethers } = require('ethers');
// const { roflEncrypt } = require('../../bot/roflClient');

// const ABI = [
//   'function createStrategy(bytes32 id, bytes payload) external',
//   'function updateStrategy(bytes32 id, bytes payload) external',
//   'function getStrategy(bytes32 id) external view returns (bytes memory)'
// ];

// function isV6() { return typeof ethers.JsonRpcProvider === 'function'; }
// function mkProvider(rpc) {
//   return isV6() ? new ethers.JsonRpcProvider(rpc)
//                 : new ethers.providers.JsonRpcProvider(rpc);
// }
// function hexlify(u8) { return isV6() ? ethers.hexlify(u8) : ethers.utils.hexlify(u8); }
// function isHexString(v, len) {
//   const fn = isV6() ? ethers.isHexString : ethers.utils.isHexString;
//   return fn(v, len);
// }
// function toUtf8Bytes(s) { return (isV6() ? ethers.toUtf8Bytes : ethers.utils.toUtf8Bytes)(s); }
// function keccak256(b)   { return (isV6() ? ethers.keccak256   : ethers.utils.keccak256)(b); }

// function toBytesB64(b64) { return Buffer.from(b64, 'base64'); }
// function assertLen(label, got, expected) {
//   if (got.length !== expected) throw new Error(`${label} must be ${expected} bytes, got ${got.length}`);
// }

// /** Build iv|tag|ciphertext from base64 parts */
// function encodePayload({ ivB64, tagB64, ciphertextB64 }) {
//   const iv  = toBytesB64(ivB64);
//   const tag = toBytesB64(tagB64);
//   const ct  = toBytesB64(ciphertextB64);
//   assertLen('iv', iv, 12);
//   assertLen('tag', tag, 16);
//   if (!ct.length) throw new Error('ciphertext must not be empty');
//   return Buffer.concat([iv, tag, ct]);
// }

// /** Accept bytes32 hex / 32-byte array / or string label (hashed) */
// function normalizeAgentId(agentId) {
//   if (typeof agentId === 'string') {
//     if (agentId.startsWith('0x') && isHexString(agentId, 32)) return agentId;
//     return keccak256(toUtf8Bytes(agentId));
//   }
//   if (agentId && typeof agentId.length === 'number' && agentId.length === 32) {
//     return hexlify(agentId);
//   }
//   throw new Error('agentId must be bytes32 hex, 32-byte array, or a string (will be hashed)');
// }

// /**
//  * Encrypt strategyJson with ROFL and upsert into StrategyStore.
//  * NOTE: PRIVATE_KEY must have StrategyStore.MANAGER_ROLE.
//  */
// async function storeStrategyEncrypted({ telegramId, agentId, strategyJson }) {
//   const rpc  = process.env.RPC_URL;
//   const pk   = process.env.PRIVATE_KEY;            // MUST have MANAGER_ROLE in StrategyStore
//   const addr = process.env.STRATEGY_STORE_ADDRESS;
//   if (!rpc || !pk || !addr) throw new Error('RPC_URL/PRIVATE_KEY/STRATEGY_STORE_ADDRESS required');

//   const provider = mkProvider(rpc);
//   const wallet   = new ethers.Wallet(pk, provider);
//   const store    = new ethers.Contract(addr, ABI, wallet);

//   // 1) ROFL encrypt -> base64 parts
//   const enc = await roflEncrypt(String(telegramId), JSON.stringify(strategyJson));
//   if (!enc?.iv || !enc?.tag || !enc?.ciphertext) {
//     throw new Error('roflEncrypt must return {iv, tag, ciphertext} in base64');
//   }

//   // 2) Build payload and normalize id
//   const payloadHex = hexlify(encodePayload({ ivB64: enc.iv, tagB64: enc.tag, ciphertextB64: enc.ciphertext }));
//   const idBytes32  = normalizeAgentId(agentId);

//   // 3) Determine create vs update
//   let exists = false;
//   try {
//     const cur = await store.getStrategy(idBytes32);
//     exists = cur && cur.length > 0;
//   } catch (_) {
//     // If your contract reverts with StrategyNotFound, exists remains false.
//   }

//   // 4) callStatic preflight to catch role/payload errors without spending gas
//   try {
//     if (exists) await store.callStatic.updateStrategy(idBytes32, payloadHex);
//     else        await store.callStatic.createStrategy(idBytes32, payloadHex);
//   } catch (e) {
//     console.warn('storeStrategyEncrypted warn: callStatic failed:', e?.error?.message || e?.message || e);
//     console.warn('Hints: signer lacks StrategyStore.MANAGER_ROLE; wrong STRATEGY_STORE_ADDRESS; bad payload sizes.');
//     throw e;
//   }

//   // 5) Send tx
//   const tx = exists
//     ? await store.updateStrategy(idBytes32, payloadHex)
//     : await store.createStrategy(idBytes32, payloadHex);
//   const rc = await tx.wait();
//   return rc?.transactionHash || rc?.hash;
// }

// module.exports = {
//   storeStrategyEncrypted,
//   encodePayload,
//   normalizeAgentId,
// };


// packages/lib/strategyStore.js
// Upsert encrypted strategy into StrategyStore: payload = iv(12)|tag(16)|ciphertext

const { ethers } = require('ethers');
const { roflEncrypt } = require('../../bot/roflClient');

const ABI = [
  'function createStrategy(bytes32 id, bytes payload) external',
  'function updateStrategy(bytes32 id, bytes payload) external',
  'function getStrategy(bytes32 id) external view returns (bytes memory)'
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

function toBytesB64(b64) { return Buffer.from(b64, 'base64'); }
function assertLen(label, got, expected) {
  if (got.length !== expected) throw new Error(`${label} must be ${expected} bytes, got ${got.length}`);
}

/** Build iv|tag|ciphertext from base64 parts */
function encodePayload({ ivB64, tagB64, ciphertextB64 }) {
  const iv  = toBytesB64(ivB64);
  const tag = toBytesB64(tagB64);
  const ct  = toBytesB64(ciphertextB64);
  assertLen('iv', iv, 12);
  assertLen('tag', tag, 16);
  if (!ct.length) throw new Error('ciphertext must not be empty');
  return Buffer.concat([iv, tag, ct]);
}

/** Accept bytes32 hex / 32-byte array / or string label (hashed) */
function normalizeAgentId(agentId) {
  if (typeof agentId === 'string') {
    if (agentId.startsWith('0x') && isHexString(agentId, 32)) return agentId;
    return keccak256(toUtf8Bytes(agentId));
  }
  if (agentId && typeof agentId.length === 'number' && agentId.length === 32) {
    return hexlify(agentId);
  }
  throw new Error('agentId must be bytes32 hex, 32-byte array, or a string (will be hashed)');
}

// Custom error selector for StrategyExists(bytes32) from your contract
const STRATEGY_EXISTS_SELECTOR = '0xe2517d3f';
function isStrategyExistsError(e) {
  const data = e?.error?.data || e?.data || '';
  return typeof data === 'string' && data.startsWith(STRATEGY_EXISTS_SELECTOR);
}

/**
 * Encrypt strategyJson with ROFL and upsert into StrategyStore.
 * NOTE: PRIVATE_KEY must have StrategyStore.MANAGER_ROLE. **/

async function storeStrategyEncrypted({ telegramId, agentId, strategyJson }) {
  const rpc  = process.env.RPC_URL;
  const pk   = process.env.PRIVATE_KEY;
  const addr = process.env.STRATEGY_STORE_ADDRESS;
  if (!rpc || !pk || !addr) throw new Error('RPC_URL/PRIVATE_KEY/STRATEGY_STORE_ADDRESS required');

  const provider = mkProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);
  const store    = new ethers.Contract(addr, ABI, wallet);

  // 1) ROFL encrypt
  const enc = await roflEncrypt(String(telegramId), JSON.stringify(strategyJson));
  if (!enc?.iv || !enc?.tag || !enc?.ciphertext) throw new Error('roflEncrypt must return {iv, tag, ciphertext} in base64');

  // 2) Build payload and normalize id
  const payloadHex = hexlify(encodePayload({
    ivB64: enc.iv,
    tagB64: enc.tag,
    ciphertextB64: enc.ciphertext
  }));
  const idBytes32  = normalizeAgentId(agentId);

  const fromAddr = await wallet.getAddress();

  // Helper: raw preflight that always sets "from"
  const simulate = async (popTx) => {
    const txReq = await popTx;
    txReq.from = fromAddr; // critical
    try {
      await provider.call(txReq); // simulate
      return true;
    } catch (e) {
      // surface the revert data plainly for decode
      const data = e?.error?.data || e?.data || e?.message;
      console.warn('simulate revert:', data);
      return false;
    }
  };

  // 3) Try CREATE preflight with explicit "from"
  const canCreate = await simulate(store.populateTransaction.createStrategy(idBytes32, payloadHex));

  if (canCreate) {
    const tx = await store.createStrategy(idBytes32, payloadHex); // real tx (signed)
    const rc = await tx.wait();
    return rc?.transactionHash || rc?.hash;
  }

  // 4) Try UPDATE preflight with explicit "from"
  const canUpdate = await simulate(store.populateTransaction.updateStrategy(idBytes32, payloadHex));

  if (canUpdate) {
    const tx = await store.updateStrategy(idBytes32, payloadHex);
    const rc = await tx.wait();
    return rc?.transactionHash || rc?.hash;
  }

  throw new Error('Both create and update simulations reverted (see logs above).');
}



module.exports = {
  storeStrategyEncrypted,
  encodePayload,
  normalizeAgentId,
};
