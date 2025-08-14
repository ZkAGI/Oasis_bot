// bot/commands/portfolioUi.js
const { Markup } = require('telegraf');

function portfolioKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Refresh', 'port:refresh'),
      Markup.button.callback('➕ Add Strategy', 'port:addStrategy'),
    ],
    [
      Markup.button.callback('Alloc 10%', 'alloc:set:10'),
      Markup.button.callback('Alloc 20%', 'alloc:set:20'),
      Markup.button.callback('Alloc 50%', 'alloc:set:50'),
    ],
  ]);
}

/**
 * Registers inline button handlers shown under /portfolio output.
 * If you pass a render function, it will be used for refresh; otherwise we fallback to sending '/portfolio'.
 */
function registerPortfolioUi(bot, renderPortfolio) {
  const doRefresh = async (ctx) => {
    if (renderPortfolio) {
      await renderPortfolio(ctx);
    } else {
      // Reuse your existing command
      await ctx.telegram.sendMessage(ctx.chat.id, '/portfolio');
    }
  };

  bot.action('port:refresh', async (ctx) => {
    await ctx.answerCbQuery();
    return doRefresh(ctx);
  });

  bot.action('port:addStrategy', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene) return ctx.scene.enter('addStrategyWizard');
    // fallback if scenes not available for some reason
    return ctx.telegram.sendMessage(ctx.chat.id, '/addStrategyUI');
  });

  ['10', '20', '50'].forEach((p) => {
    bot.action(`alloc:set:${p}`, async (ctx) => {
      await ctx.answerCbQuery();
      const { setAllocation } = require('../wallets');
      setAllocation(ctx.from.id, parseInt(p, 10));
      await ctx.reply(`✅ Allocation set to ${p}%`);
      return doRefresh(ctx);
    });
  });
}

module.exports = { registerPortfolioUi, portfolioKeyboard };

