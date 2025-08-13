// bot/index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { migrate } = require('./db');
const { ensureUserWallet, getUser, setAllocation } = require('./wallets');
const { backendName } = require('./roflClient');
const { startWorker } = require('./worker');
const portfolio  = require('./commands/portfolio');

// Your existing commands (keep paths as you have them)
const deployCmd  = require('./commands/deploy');
const addStrCmd  = require('./commands/addStrategy');
const setState   = require('./commands/setState');
const status     = require('./commands/status');
const history    = require('./commands/history');

migrate();
console.log('Crypto backend:', backendName());

const bot = new Telegraf(process.env.BOT_TOKEN);

// Auto-create encrypted wallet for any user touching the bot
bot.use(async (ctx, next) => {
  if (ctx?.from?.id) await ensureUserWallet(ctx.from.id);
  return next();
});

bot.start(async (ctx) => {
  const u = getUser(ctx.from.id);
  await ctx.reply(
    `👋 Welcome!\n` +
    `• Wallet: ${u.addr}\n` +
    `• Allocation: ${u.alloc_pct}% (set with /alloc <percent>)\n` +
    `Use: /deploy, /addStrategy, /setState, /status, /history`
  );
});

// Keep existing command names
bot.command('deploy',     deployCmd);
bot.command('addStrategy', addStrCmd);
bot.command('setState',   setState);
bot.command('status',     status);
bot.command('history',    history);
bot.command('portfolio',  portfolio);

// Small helper /wallet (address only; never shows key)
bot.command('wallet', (ctx) => {
  const u = getUser(ctx.from.id);
  ctx.reply(`🔐 Wallet address: ${u.addr}`);
});

// Risk gate you asked for (keeps same pattern)
bot.command('alloc', (ctx) => {
  const m = ctx.message.text.match(/^\/alloc\s+(\d{1,3})$/);
  if (!m) return ctx.reply('Usage: /alloc <percent 0-100>');
  const pct = parseInt(m[1], 10);
  setAllocation(ctx.from.id, pct);
  ctx.reply(`✅ Allocation set to ${pct}%`);
});

bot.launch()
  .then(() => console.log('🤖 Bot is live'))
  .catch(console.error);

startWorker();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

