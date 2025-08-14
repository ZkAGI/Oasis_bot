// bot/commands/addStrategyUI.js
const { Markup, Scenes } = require('telegraf');
const addStrCmd = require('./addStrategy');
const invokeAsText = require('../utils/invokeAsText');

function cancelKeyboard() {
  return Markup.inlineKeyboard([Markup.button.callback('❌ Cancel', 'asui:cancel')]);
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm', 'asui:confirm'), Markup.button.callback('❌ Cancel', 'asui:cancel')],
  ]);
}

function createAddStrategyWizard() {
  const wizard = new Scenes.WizardScene(
    'addStrategyWizard',

    // Step 0: Ask AgentID (or auto-use from session and skip)
    async (ctx) => {
      ctx.wizard.state.data = {};
      const saved = ctx.session?.lastAgentId;
      if (saved) {
        ctx.wizard.state.data.agentId = saved;
        await ctx.reply(
          `Using your last AgentID:\n${saved}\n\nChoose symbol:`,
          Markup.inlineKeyboard([
            [Markup.button.callback('BTC', 'asui:sym:BTC'), Markup.button.callback('ETH', 'asui:sym:ETH')],
            [Markup.button.callback('Other…', 'asui:sym:other')],
            [Markup.button.callback('❌ Cancel', 'asui:cancel')],
          ])
        );
        // jump directly to Step 2 (symbol handler)
        return ctx.wizard.selectStep(2);
      }

      await ctx.reply(
        'Enter your *AgentID* (copy from /deploy or /portfolio):',
        { parse_mode: 'Markdown', ...cancelKeyboard() }
      );
      return ctx.wizard.next();
    },

    // Step 1: Receive AgentID -> ask for Symbol (then advance to step 2)
    async (ctx) => {
      if (!ctx.message?.text) {
        return ctx.reply('Please paste your AgentID as text.', cancelKeyboard());
      }
      ctx.wizard.state.data.agentId = ctx.message.text.trim();

      await ctx.reply(
        'Choose symbol:',
        Markup.inlineKeyboard([
          [Markup.button.callback('BTC', 'asui:sym:BTC'), Markup.button.callback('ETH', 'asui:sym:ETH')],
          [Markup.button.callback('Other…', 'asui:sym:other')],
          [Markup.button.callback('❌ Cancel', 'asui:cancel')],
        ])
      );
      return ctx.wizard.next();
    },

    // Step 2: Handle symbol (callback or custom text) -> ask for Side
    async (ctx) => {
      const data = ctx.wizard.state.data;

      if (ctx.callbackQuery?.data?.startsWith('asui:sym:')) {
        const choice = ctx.callbackQuery.data.split(':')[2];
        await ctx.answerCbQuery();
        if (choice === 'other') {
          data.awaitingCustomSymbol = true;
          await ctx.reply('Type the symbol (e.g., BTC):', cancelKeyboard());
          return; // stay in step 2 to receive text
        }
        data.symbol = choice;
      } else if (ctx.message?.text && data.awaitingCustomSymbol) {
        data.symbol = ctx.message.text.trim().toUpperCase();
        data.awaitingCustomSymbol = false;
      } else if (ctx.message?.text && !data.symbol) {
        data.symbol = ctx.message.text.trim().toUpperCase();
      } else {
        return; // ignore unrelated updates
      }

      await ctx.reply(
        'Select side:',
        Markup.inlineKeyboard([
          [Markup.button.callback('LONG', 'asui:side:LONG'), Markup.button.callback('SHORT', 'asui:side:SHORT')],
          [Markup.button.callback('❌ Cancel', 'asui:cancel')],
        ])
      );
      return ctx.wizard.next();
    },

    // Step 3: Handle side -> ask Entry
    async (ctx) => {
      if (!ctx.callbackQuery?.data?.startsWith('asui:side:')) return;
      ctx.wizard.state.data.side = ctx.callbackQuery.data.split(':')[2];
      await ctx.answerCbQuery();
      await ctx.reply('Enter *entry price* (number):', { parse_mode: 'Markdown', ...cancelKeyboard() });
      return ctx.wizard.next();
    },

    // Step 4: Entry -> ask TP
    async (ctx) => {
      const n = Number(ctx.message?.text);
      if (!Number.isFinite(n)) {
        return ctx.reply('Please send a valid number for entry price:', cancelKeyboard());
      }
      ctx.wizard.state.data.entry = n;
      await ctx.reply('Enter *take-profit* price:', { parse_mode: 'Markdown', ...cancelKeyboard() });
      return ctx.wizard.next();
    },

    // Step 5: TP -> ask SL
    async (ctx) => {
      const n = Number(ctx.message?.text);
      if (!Number.isFinite(n)) {
        return ctx.reply('Please send a valid number for take-profit price:', cancelKeyboard());
      }
      ctx.wizard.state.data.tp = n;
      await ctx.reply('Enter *stop-loss* price:', { parse_mode: 'Markdown', ...cancelKeyboard() });
      return ctx.wizard.next();
    },

    // Step 6: SL -> confirm
    async (ctx) => {
      const n = Number(ctx.message?.text);
      if (!Number.isFinite(n)) {
        return ctx.reply('Please send a valid number for stop-loss price:', cancelKeyboard());
      }
      ctx.wizard.state.data.sl = n;

      const d = ctx.wizard.state.data;
      const preview =
        `Please confirm:\n` +
        `• AgentID: ${d.agentId}\n` +
        `• Symbol: ${d.symbol}\n` +
        `• Side: ${d.side}\n` +
        `• Entry: ${d.entry}\n` +
        `• TP: ${d.tp}\n` +
        `• SL: ${d.sl}`;

      await ctx.reply(preview, confirmKeyboard());
      // stay on this step until confirm/cancel
    }
  );

  // Cancel anywhere
  wizard.action('asui:cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('Add Strategy cancelled.');
    return ctx.scene.leave();
  });

  // Confirm -> call existing /addStrategy directly (no self-sent message)
  wizard.action('asui:confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const d = ctx.wizard.state.data;

    const payload = {
      symbol: d.symbol,
      signal: d.side,
      entry: d.entry,
      tp: d.tp,
      sl: d.sl,
    };

    const text = `/addStrategy ${d.agentId} ${JSON.stringify(payload)}`;
    await ctx.reply(`Submitting:\n${text}`);

    // 🔧 Invoke your existing handler so it works from the wizard
    await invokeAsText(ctx, addStrCmd, text);

    await ctx.reply('Strategy submitted ✅');
    return ctx.scene.leave();
  });

  return wizard;
}

module.exports = { createAddStrategyWizard };

