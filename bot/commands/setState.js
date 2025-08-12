// bot/commands/setState.js
const { roflEncrypt } = require('../roflClient');
const { ethers } = require('ethers');
require('dotenv').config();

module.exports = async (ctx) => {
  try {
    const m = ctx.message.text.match(/^\/setState\s+(\S+)\s+([\s\S]+)/);
    if (!m) return ctx.reply('Usage: /setState <AgentID> <json>');
    const agentID = m[1], json = m[2].trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(agentID)) return ctx.reply('❌ AgentID must be bytes32.');

    const { iv, tag, ciphertext } = await roflEncrypt(ctx.from.id, json);
    const data = Buffer.concat([tag, ciphertext]); // store tag|ciphertext, pass iv separately

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const EncAbi   = require('../../artifacts/contracts/EncryptedPortfolio.sol/EncryptedPortfolio.json').abi;
    const enc      = new ethers.Contract(process.env.ENCRYPTED_PORTFOLIO_ADDRESS, EncAbi, wallet);

    await enc.storeState(agentID, data, iv);
    ctx.reply(`💾 Portfolio state stored for ${agentID} (${data.length + 12} bytes).`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ /setState failed: ' + e.message);
  }
};

