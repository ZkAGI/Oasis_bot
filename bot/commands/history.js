// bot/commands/history.js
const { ethers } = require('ethers');
require('dotenv').config();

const DEFAULT_LOOKBACK_BLOCKS = 50_000;   // user can override with `/history <blocks>`
const INITIAL_STEP_BLOCKS     = 2_000;    // start optimistically; we'll shrink on RPC errors
const MIN_STEP_BLOCKS         = 1;        // never go below 1

// Adaptive windowed query: halves step on Sapphire "rounds" errors (-32000)
async function queryFilterAdaptive(contract, filter, fromBlock, toBlock, initialStep = INITIAL_STEP_BLOCKS) {
  const out = [];
  let step = initialStep;

  for (let start = fromBlock; start <= toBlock; ) {
    let end = Math.min(start + step - 1, toBlock);

    try {
      // Try this window
      // eslint-disable-next-line no-await-in-loop
      const chunk = await contract.queryFilter(filter, start, end);
      out.push(...chunk);

      // Advance window
      start = end + 1;

      // If we shrank earlier and things are stable, we can try to grow a bit (optional)
      if (step < initialStep) {
        step = Math.min(initialStep, Math.floor(step * 2));
      }
    } catch (err) {
      // Sapphire-specific: "max allowed of rounds in logs query is: 100"
      const msg = String(err?.message || '');
      const code = err?.code;
      const tooManyRounds = code === -32000 && /rounds in logs query/i.test(msg);

      if (tooManyRounds || /eth_getLogs/i.test(msg)) {
        // shrink the window and retry the same start
        const newStep = Math.max(MIN_STEP_BLOCKS, Math.floor(step / 2));
        if (newStep === step) {
          // can't shrink further
          throw err;
        }
        step = newStep;
        // continue loop without advancing start
        continue;
      }
      throw err;
    }
  }

  return out;
}

// send long text as multiple messages (Telegram limit ~4096 chars)
async function replyLong(ctx, text) {
  const LIMIT = 3900; // safety headroom
  if (text.length <= LIMIT) return ctx.reply(text);

  const lines = text.split('\n');
  let buf = '';
  for (const ln of lines) {
    if ((buf + ln + '\n').length > LIMIT) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.reply(buf);
      buf = '';
    }
    buf += ln + '\n';
  }
  if (buf) await ctx.reply(buf);
}

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

    // Lookback: `/history` or `/history <blocks>`
    const text = ctx.message?.text || '/history';
    const m = text.match(/^\/history\s+(\d+)/);
    const lookbackBlocks = m ? Math.max(1_000, parseInt(m[1], 10)) : DEFAULT_LOOKBACK_BLOCKS;

    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(latest - lookbackBlocks, 0);
    const toBlock = latest;

    // Fetch events with adaptive chunking (handles Sapphire's ~100-round limit)
    const created = await queryFilterAdaptive(registry, registry.filters.AgentCreated(), fromBlock, toBlock);
    const stored  = await queryFilterAdaptive(store,    store.filters.StrategyStored(), fromBlock, toBlock);

    let msg = `🕒 History (blocks ${fromBlock} → ${toBlock}, lookback ${lookbackBlocks}):\n`;
    for (const e of created) msg += `• AgentCreated: ${e.args.agentID} @ block ${e.blockNumber}\n`;
    for (const e of stored)  msg += `• StrategyStored: ${e.args.id} (${e.args.size} bytes) @ block ${e.blockNumber}\n`;

    await replyLong(ctx, msg);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ /history failed: ' + err.message);
  }
};

