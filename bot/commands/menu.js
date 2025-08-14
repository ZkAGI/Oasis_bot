// bot/commands/menu.js
const invokeAsText = require('../utils/invokeAsText');
const { Markup } = require('telegraf');

// Real handlers
const portfolio = require('./portfolio');
const status    = require('./status');
//const history   = require('./history');

// Wallet helpers from your existing wallets.js
const { ensureUserWallet, getUser } = require('../wallets');

// Optional: quick alloc keyboard
const { portfolioKeyboard } = require('./portfolioUi');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Strategy', 'menu:addStrategy')],
    [
      Markup.button.callback('📊 Portfolio', 'menu:portfolio'),
      Markup.button.callback('📈 Status',    'menu:status'),
    ],
    [
      Markup.button.callback('💼 Wallet',    'menu:wallet'),
    ],
    [
      Markup.button.callback('⚙️ Allocation','menu:alloc'),
      Markup.button.callback('🧰 Deploy Agent','menu:deploy'),
    ],
  ]);
}

function showMainMenu(ctx) {
  return ctx.reply('Choose an action:', mainMenuKeyboard());
}

// Ack callback safely (prevents "query is too old" errors)
async function safeAck(ctx, text = 'Got it') {
  try { await ctx.answerCbQuery(text, { cache_time: 0 }); } catch {}
}

module.exports = function registerMenu(bot) {
  bot.command('start', showMainMenu);
  bot.command('menu',  showMainMenu);
  bot.hears('☰ Menu',  showMainMenu);

  // ➕ Add Strategy wizard
  bot.action('menu:addStrategy', async (ctx) => {
    await safeAck(ctx);
    return ctx.scene.enter('addStrategyWizard');
  });

  // 📊 Portfolio
  bot.action('menu:portfolio', async (ctx) => {
    await safeAck(ctx);
    try {
      await portfolio(ctx);
      await ctx.reply('Quick actions:', portfolioKeyboard());
    } catch (e) {
      console.error('menu:portfolio failed:', e);
      await ctx.reply('❌ Portfolio failed: ' + e.message);
    }
  });

  // 📈 Status
  bot.action('menu:status', async (ctx) => {
    await safeAck(ctx);
    try {
      const agentId = ctx.session?.lastAgentId;
      if (!agentId) {
        return ctx.reply(
          'ℹ️ No AgentID yet. Deploy an agent first (menu → 🧰 Deploy Agent), or paste: /status <AgentID>'
        );
      }
      return invokeAsText(ctx, status, `/status ${agentId}`);
    } catch (e) {
      console.error('menu:status failed:', e);
      await ctx.reply('❌ Status failed: ' + e.message);
    }
  });

  // 🧾 History
  bot.action('menu:history', async (ctx) => {
    await safeAck(ctx);
    try {
      return invokeAsText(ctx, history, '/history');
    } catch (e) {
      console.error('menu:history failed:', e);
      await ctx.reply('❌ History failed: ' + e.message);
    }
  });

  // 💼 Wallet — ensure user exists, then show address
  bot.action('menu:wallet', async (ctx) => {
    await safeAck(ctx);
    try {
      await ensureUserWallet(ctx.from.id);      // create if missing
      const u = getUser(ctx.from.id);
      if (!u?.addr) return ctx.reply('Could not load your wallet. Try /start once.');
      return ctx.reply(`🔐 Wallet address:\n${u.addr}`);
    } catch (e) {
      console.error('menu:wallet failed:', e);
      await ctx.reply('❌ Could not load wallet: ' + e.message);
    }
  });

  // ⚙️ Allocation quick buttons
  bot.action('menu:alloc', async (ctx) => {
    await safeAck(ctx);
    try {
      await ctx.reply(
        'Set allocation quickly:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Alloc 10%', 'alloc:set:10'),
            Markup.button.callback('Alloc 20%', 'alloc:set:20'),
            Markup.button.callback('Alloc 50%', 'alloc:set:50'),
          ],
        ])
      );
    } catch (e) {
      console.error('menu:alloc failed:', e);
      await ctx.reply('❌ Could not show allocation: ' + e.message);
    }
  });

  // 🧰 Deploy wizard
  bot.action('menu:deploy', async (ctx) => {
    await safeAck(ctx);
    try {
      return ctx.scene.enter('deployWizard');
    } catch (e) {
      console.error('menu:deploy failed:', e);
      await ctx.reply('❌ Deploy wizard failed: ' + e.message);
    }
  });
};

