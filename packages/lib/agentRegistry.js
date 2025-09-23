// packages/lib/agentRegistry.js
const { ethers } = require('ethers');

const REG_ABI = [
  'function createAgent(bytes32 agentID, address owner, string uri) external',
  'function agents(bytes32) view returns (address owner, string metadataURI, bool exists)',
  'function MANAGER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)'
];

function mkProvider(url) {
  return ethers.JsonRpcProvider
    ? new ethers.JsonRpcProvider(url)                 // ethers v6
    : new ethers.providers.JsonRpcProvider(url);      // ethers v5
}
function b32(label) {
  const to = ethers.toUtf8Bytes || ethers.utils.toUtf8Bytes;
  const kk = ethers.keccak256  || ethers.utils.keccak256;
  return kk(to(label)); // bytes32
}

/** Ensure agent exists; create with provided owner if missing. signerPk must have MANAGER_ROLE. */
async function ensureAgent({ rpcUrl, registryAddr, signerPk, ownerAddr, agentLabel, metadataURI = '' }) {
  const provider = mkProvider(rpcUrl);
  const signer   = new ethers.Wallet(signerPk, provider);
  const reg      = new ethers.Contract(registryAddr, REG_ABI, signer);
  const agentID  = b32(agentLabel);

  const info = await reg.agents(agentID);
  if (!info.exists) {
    const tx = await reg.createAgent(agentID, ownerAddr, metadataURI);
    await tx.wait();
  }
  return agentID; // 0x… bytes32
}

module.exports = { ensureAgent, b32 };

