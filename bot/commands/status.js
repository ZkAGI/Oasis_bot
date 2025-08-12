// bot/commands/status.js
const { roflDecrypt } = require('../roflClient');
const { ethers } = require('ethers');
require('dotenv').config();

module.exports = async (ctx) => {
  try {
    const m = ctx.message.text.match(/^\/status\s+(\S+)/);
    if (!m) return ctx.reply('Usage: /status <AgentID>');
    const agentID = m[1];
    if (!/^0x[0-9a-fA-F]{64}$/.test(agentID)) return ctx.reply('❌ AgentID must be bytes32.');

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const EncAbi   = require('../../artifacts/contracts/EncryptedPortfolio.sol/EncryptedPortfolio.json').abi;
    const enc      = new ethers.Contract(process.env.ENCRYPTED_PORTFOLIO_ADDRESS, EncAbi, wallet);

    const st = await enc.encryptedStates(agentID);
    if (!st || st.data === '0x') return ctx.reply('ℹ️ No encrypted portfolio state for this AgentID.');

    const buf = Buffer.from(st.data.slice(2), 'hex');   // tag|ciphertext
    const tag = buf.slice(0, 16);
    const ct  = buf.slice(16);
    const iv  = Buffer.from(st.iv.slice(2), 'hex');

    const plaintext = await roflDecrypt(ctx.from.id, iv, tag, ct);
    ctx.reply(`📊 Decrypted state:\n\`\`\`json\n${plaintext}\n\`\`\``);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ /status failed: ' + e.message);
  }
};

