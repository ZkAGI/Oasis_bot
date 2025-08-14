// bot/commands/deploy.js
const { deriveRawKey } = require('../roflClient');
const { ethers } = require('ethers');
const { Markup } = require('telegraf');
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
  } catch {
    return { error: 'Invalid JSON. Pass a valid URL/ipfs or JSON.' };
  }
}

module.exports = async (ctx) => {
  try {
    // keep everything after /deploy verbatim
    const text = ctx.message?.text || '';
    const arg = text.replace(/^\/deploy\s+/, '').trim();
    if (!arg) {
      return ctx.reply(
        'Usage: /deploy <metadataURI | inline JSON>\n' +
        'Example: /deploy {"name":"MyAgent","version":"1.0","desc":"demo"}'
      );
    }

    let metaUri = arg;
    if (!isLikelyUri(arg)) {
      const { uri, error } = toDataUriIfJson(arg);
      if (error) return ctx.reply('❌ ' + error);
      metaUri = uri;
    }

    const registryAddr = process.env.AGENT_REGISTRY_ADDRESS;
    if (!registryAddr || !ethers.utils.isAddress(registryAddr)) {
      return ctx.reply('❌ Set a valid AGENT_REGISTRY_ADDRESS in .env (from Hardhat deploy).');
    }

    await deriveRawKey(ctx.from.id.toString());

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const AgentJson = require('../../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json');
    const registry  = new ethers.Contract(registryAddr, AgentJson.abi, wallet);

    // bytes32 agent id derived from Telegram user id
    const agentID = ethers.utils.id(String(ctx.from.id));

    const tx = await registry.createAgent(agentID, metaUri);
    // wait 1 confirmation (optional; keeps UX crisp but confirms success)
    await tx.wait?.(1).catch(() => {});

    // ✅ remember AgentID for future commands/wizards
    ctx.session = ctx.session || {};
    ctx.session.lastAgentId = agentID;

    // success message + quick actions
    await ctx.reply(
      `✅ Agent created\n` +
      `Registry: ${registry.address}\n` +
      `🆔 AgentID: ${agentID}\n` +
      `Tip: use the buttons below to add a strategy or check status.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ Add Strategy', 'menu:addStrategy'),
          Markup.button.callback('📈 Status', 'menu:status'),
        ],
      ])
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ /deploy failed: ' + err.message);
  }
};

