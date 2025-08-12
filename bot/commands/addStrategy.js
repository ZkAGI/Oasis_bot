// bot/commands/addStrategy.js
const { roflEncrypt } = require('../roflClient');
const { ethers } = require('ethers');
require('dotenv').config();

module.exports = async (ctx) => {
  try {
    const m = ctx.message.text.match(/^\/addStrategy\s+(\S+)\s+([\s\S]+)/);
    if (!m) return ctx.reply('Usage: /addStrategy <AgentID> <json>');
    const agentID = m[1], json = m[2].trim();

    if (!/^0x[0-9a-fA-F]{64}$/.test(agentID)) return ctx.reply('❌ AgentID must be bytes32 (0x + 64 hex).');

    const { iv, tag, ciphertext } = await roflEncrypt(ctx.from.id, json);
    const payload = Buffer.concat([iv, tag, ciphertext]); // iv|tag|ciphertext

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const StoreAbi = require('../../artifacts/contracts/StrategyStore.sol/StrategyStore.json').abi;
    const store    = new ethers.Contract(process.env.STRATEGY_STORE_ADDRESS, StoreAbi, wallet);

    await store.storeStrategy(agentID, payload);
    ctx.reply(`🗄 Strategy stored for ${agentID} (${payload.length} bytes).`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ /addStrategy failed: ' + e.message);
  }
};

