const { deriveRawKey } = require('../roflClient');
const { ethers } = require('ethers');
require('dotenv').config();

function isLikelyUri(s) {
  return /^https?:\/\//i.test(s) || /^ipfs:\/\//i.test(s) || /^data:/i.test(s);
}

function toDataUriIfJson(input) {
  try {
    const obj = JSON.parse(input);
    const min = JSON.stringify(obj);
    const bytes = Buffer.from(min, 'utf8');
    if (bytes.length > 2048) {
      return { error: `JSON too large (${bytes.length} bytes). Host on IPFS/HTTP and pass the URL.` };
    }
    return { uri: 'data:application/json;base64,' + bytes.toString('base64') };
  } catch (e) {
    return { error: 'Invalid JSON. Pass a valid URL/ipfs or JSON.' };
  }
}

module.exports = async (ctx) => {
  try {
    // Keep everything after /deploy verbatim
    const arg = ctx.message.text.replace(/^\/deploy\s+/, '').trim();
    if (!arg) return ctx.reply('Usage: /deploy <metadataURI | inline JSON>');

    let metaUri = arg;
    if (!isLikelyUri(arg)) {
      const { uri, error } = toDataUriIfJson(arg);
      if (error) return ctx.reply('❌ ' + error);
      metaUri = uri;
    }

    // MUST attach to existing registry from .env
    const registryAddr = process.env.AGENT_REGISTRY_ADDRESS;
    if (!registryAddr || !ethers.utils.isAddress(registryAddr)) {
      return ctx.reply('❌ Set a valid AGENT_REGISTRY_ADDRESS in .env (from Hardhat deploy).');
    }

    // Optional: warm up user key path (stub/ROFL)
    await deriveRawKey(ctx.from.id.toString());

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const AgentJson = require('../../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json');
    const registry  = new ethers.Contract(registryAddr, AgentJson.abi, wallet);

    const agentID = ethers.utils.id(String(ctx.from.id)); // bytes32 key
    await registry.createAgent(agentID, metaUri);

    ctx.reply(`✅ Agent created\nRegistry: ${registry.address}\nAgentID: ${agentID}`);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ /deploy failed: ' + err.message);
  }
};
