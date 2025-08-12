const { ethers } = require('ethers');
require('dotenv').config();

module.exports = async (ctx) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

    const regAddr = process.env.AGENT_REGISTRY_ADDRESS;
    const storeAddr = process.env.STRATEGY_STORE_ADDRESS;
    if (!regAddr || !ethers.utils.isAddress(regAddr)) return ctx.reply('❌ AGENT_REGISTRY_ADDRESS invalid.');
    if (!storeAddr || !ethers.utils.isAddress(storeAddr)) return ctx.reply('❌ STRATEGY_STORE_ADDRESS invalid.');

    const AgentJson = require('../../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json');
    const StoreJson = require('../../artifacts/contracts/StrategyStore.sol/StrategyStore.json');

    const registry = new ethers.Contract(regAddr, AgentJson.abi, provider);
    const store    = new ethers.Contract(storeAddr, StoreJson.abi, provider);

    const created = await registry.queryFilter(registry.filters.AgentCreated());
    const stored  = await store.queryFilter(store.filters.StrategyStored());

    let msg = '🕒 History:\n';
    for (const e of created) msg += `• AgentCreated: ${e.args.agentID} @ block ${e.blockNumber}\n`;
    for (const e of stored)  msg += `• StrategyStored: ${e.args.id} (${e.args.size} bytes) @ block ${e.blockNumber}\n`;

    ctx.reply(msg);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ /history failed: ' + err.message);
  }
};
