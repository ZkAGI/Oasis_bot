// bot/index.js
require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const { migrate } = require('./db');
const { ensureUserWallet, getUser, setAllocation } = require('./wallets');
const { backendName } = require('./roflClient');
const { startWorker } = require('./worker');
const portfolio  = require('./commands/portfolio');

// Command handlers
const deployCmd  = require('./commands/deploy');
const addStrCmd  = require('./commands/addStrategy');
const setState   = require('./commands/setState');
const status     = require('./commands/status');
//const history    = require('./commands/history');

// UI helpers
const { registerPortfolioUi, portfolioKeyboard } = require('./commands/portfolioUi');
const { createAddStrategyWizard } = require('./commands/addStrategyUI');
const { createDeployWizard } = require('./commands/deployUI');
const registerMenu = require('./commands/menu');

migrate();
console.log('Crypto backend:', backendName());

const bot = new Telegraf(process.env.BOT_TOKEN);

// Telegram commands list
bot.telegram.setMyCommands([
  { command: 'menu',      description: 'Open main menu' },
  { command: 'portfolio', description: 'Show portfolio' },
  { command: 'status',    description: 'Show agent status' },
//  { command: 'history',   description: 'Show on-chain history' },
  { command: 'deploy',    description: 'Deploy an agent (JSON)' },
]);

// 1) session FIRST
bot.use(session());

// 2) stage middleware BEFORE any scene usage
const stage = new Scenes.Stage([
  createAddStrategyWizard(),
  createDeployWizard(),
]);
bot.use(stage.middleware());

// 3) BOOTSTRAP: ensure per-user wallet for every update (messages & callbacks)
bot.use(async (ctx, next) => {
  try {
    if (ctx.from?.id) await ensureUserWallet(ctx.from.id); // <-- ensure/create
  } catch (e) {
    console.error('user bootstrap failed:', e);
  }
  return next();
});

// 4) Register menu (uses scenes), then other commands
registerMenu(bot);

// /start shows basics + keyboard
bot.start(async (ctx) => {
  await ensureUserWallet(ctx.from.id);              // ensure/create
  const u = getUser(ctx.from.id) || { alloc_pct: 0 };
  const addr = u.addr || '(creating...)';
  await ctx.reply(
    `👋 Welcome!\n` +
    `• Wallet: ${addr}\n` +
    `• Allocation: ${u.alloc_pct || 0}% (set with /alloc <percent>)\n` +
    `Use: /deploy, /addStrategy, /setState, /status, /history`,
    Markup.keyboard([['☰ Menu']]).resize().persistent()
  );
});

// Keep existing command names
bot.command('deploy',      deployCmd);
bot.command('addStrategy', addStrCmd);
bot.command('setState',    setState);
bot.command('status',      status);
//bot.command('history',     history);

// /portfolio + quick actions row
bot.command('portfolio', async (ctx) => {
  await portfolio(ctx);
  await ctx.reply('Quick actions:', portfolioKeyboard());
});

// Help
bot.command('help', (ctx) => ctx.reply(
  'Commands:\n/start – menu\n/menu – menu\n/addStrategyUI – guided add strategy\n/deployUI – guided deploy'
));

// /wallet convenience
bot.command('wallet', async (ctx) => {
  await ensureUserWallet(ctx.from.id);              // ensure/create
  const u = getUser(ctx.from.id);
  return ctx.reply(`🔐 Wallet address: ${u?.addr || 'not available'}`);
});

// Allocation
bot.command('alloc', (ctx) => {
  const m = ctx.message.text.match(/^\/alloc\s+(\d{1,3})$/);
  if (!m) return ctx.reply('Usage: /alloc <percent 0-100>');
  const pct = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  setAllocation(ctx.from.id, pct);
  ctx.reply(`✅ Allocation set to ${pct}%`);
});

// Register inline alloc handlers shown by /portfolio
registerPortfolioUi(bot, async (ctx) => {
  await portfolio(ctx);
  await ctx.reply('Quick actions:', portfolioKeyboard());
});

// Global error catcher to avoid hard crashes
bot.catch((err, ctx) => {
  console.error('Unhandled error while processing', ctx.update, err);
});

bot.launch()
  .then(() => console.log('🤖 Bot is live'))
  .catch(console.error);

startWorker();

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

