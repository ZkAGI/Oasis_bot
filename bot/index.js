// bot/index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { ethers } = require('ethers');

// Commands
const deployCmd      = require('./commands/deploy');
const addStrategyCmd = require('./commands/addStrategy');
const statusCmd      = require('./commands/status');
const historyCmd     = require('./commands/history');
const setStateCmd = require('./commands/setState');

function isAddr(x){ return x && ethers.utils.isAddress(x); }
function logEnv(){
  const envs = {
    AGENT_REGISTRY_ADDRESS: process.env.AGENT_REGISTRY_ADDRESS,
    STRATEGY_STORE_ADDRESS: process.env.STRATEGY_STORE_ADDRESS,
    ENCRYPTED_PORTFOLIO_ADDRESS: process.env.ENCRYPTED_PORTFOLIO_ADDRESS,
    STATE_VERIFIER_ADDRESS: process.env.STATE_VERIFIER_ADDRESS,
  };
  console.log('🔧 Using addresses:', envs);
  for (const [k,v] of Object.entries(envs)) if (!isAddr(v)) console.warn(`⚠️ ${k} is missing/invalid`);
}

logEnv();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('👋 Welcome! Use /deploy <metaURI|JSON> to create an agent.'));
bot.command('deploy', deployCmd);
bot.command('addStrategy', addStrategyCmd);
bot.command('status', statusCmd);
bot.command('history', historyCmd);
bot.command('setState', setStateCmd);

bot.launch()
  .then(() => console.log('🤖 Bot is live!'))
  .catch(console.error);
