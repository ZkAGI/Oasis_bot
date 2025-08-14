// bot/commands/deployUI.js
const invokeAsText = require('../utils/invokeAsText');
const { Markup, Scenes } = require('telegraf');
const deployCmd = require('./deploy');

// small helper: run an existing command handler as if user typed text
async function runCommandAsText(ctx, handler, text) {
  const oldMsg = ctx.message;
  try {
    // minimal message object with text; keep chat/from so replies still work
    ctx.message = {
      ...(oldMsg || {}),
      chat: ctx.chat,
      from: ctx.from,
      text,
    };
    await handler(ctx);
  } finally {
    ctx.message = oldMsg;
  }
}

function cancelKb() {
  return Markup.inlineKeyboard([Markup.button.callback('❌ Cancel', 'depui:cancel')]);
}
function confirmKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm', 'depui:confirm'), Markup.button.callback('❌ Cancel', 'depui:cancel')],
  ]);
}

function createDeployWizard() {
  const wizard = new Scenes.WizardScene(
    'deployWizard',

    // Step 0: name
    async (ctx) => {
      ctx.wizard.state.data = {};
      await ctx.reply('Enter *agent name*:', { parse_mode: 'Markdown', ...cancelKb() });
      return ctx.wizard.next();
    },

    // Step 1: version
    async (ctx) => {
      if (!ctx.message?.text) return ctx.reply('Please send a valid name text.', cancelKb());
      ctx.wizard.state.data.name = ctx.message.text.trim();

      await ctx.reply(
        'Select or type *version*:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('1.0', 'depui:ver:1.0'), Markup.button.callback('1.1', 'depui:ver:1.1')],
            [Markup.button.callback('Other…', 'depui:ver:other')],
            [Markup.button.callback('❌ Cancel', 'depui:cancel')],
          ]),
        }
      );
      return ctx.wizard.next();
    },

    // Step 2: handle version (button or custom) -> ask description
    async (ctx) => {
      const data = ctx.wizard.state.data;

      if (ctx.callbackQuery?.data?.startsWith('depui:ver:')) {
        await ctx.answerCbQuery();
        const v = ctx.callbackQuery.data.split(':')[2];
        if (v === 'other') {
          data.awaitingCustomVer = true;
          await ctx.reply('Type version (e.g., 1.0.0):', cancelKb());
          return; // stay in this step for text
        }
        data.version = v;
      } else if (ctx.message?.text && data.awaitingCustomVer) {
        data.version = ctx.message.text.trim();
        data.awaitingCustomVer = false;
      } else if (ctx.message?.text && !data.version) {
        data.version = ctx.message.text.trim();
      } else {
        return;
      }

      await ctx.reply('Enter *description*:', { parse_mode: 'Markdown', ...cancelKb() });
      return ctx.wizard.next();
    },

    // Step 3: description -> confirm
    async (ctx) => {
      if (!ctx.message?.text) return ctx.reply('Please send a description text.', cancelKb());
      ctx.wizard.state.data.desc = ctx.message.text.trim();

      const d = ctx.wizard.state.data;
      const preview =
        `Please confirm deploy:\n` +
        `• Name: ${d.name}\n` +
        `• Version: ${d.version}\n` +
        `• Desc: ${d.desc}`;
      await ctx.reply(preview, confirmKb());
      // wait for confirm/cancel
    }
  );

  // cancel
  wizard.action('depui:cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('Deploy cancelled.');
    return ctx.scene.leave();
  });

  // confirm -> call your existing /deploy handler
  wizard.action('depui:confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const d = ctx.wizard.state.data;
    const payload = { name: d.name, version: d.version, desc: d.desc };
    const text = `/deploy ${JSON.stringify(payload)}`;


    await invokeAsText(ctx, deployCmd, text);

   const agentId = ctx.session?.lastAgentId;
   if (agentId) await ctx.reply(`🆔 AgentID: ${agentId}`);
    // run your existing deploy command with fake message text

    await ctx.reply('Deploy submitted ✅');
    return ctx.scene.leave();
  });

  // optional direct command
  wizard.command('deployUI', (ctx) => ctx.scene.enter('deployWizard'));

  return wizard;
}

module.exports = { createDeployWizard };

