// bot/index.js
// bot/index.js
// require('dotenv').config();
// const { Telegraf, session } = require('telegraf');

// const { setupKeyboard, tradingKeyboard } = require('./keyboard');

// const startCmd     = require('./commands/start');
// const connectHl    = require('./commands/connect_hl');
// const riskCmd      = require('./commands/risk');
// const portfolioCmd = require('./commands/portfolio');
// const tradeNow     = require('./commands/trade_now');
// const closeAll     = require('./commands/close_all');
// const checkSignal  = require('./commands/check_signal'); // optional

// if (!process.env.BOT_TOKEN) {
//   console.error('Missing BOT_TOKEN in .env');
//   process.exit(1);
// }

// // No handler timeout so long ops don’t get cut off
// // const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 0 });
// const bot = new Telegraf(process.env.BOT_TOKEN);
// bot.use(session());


// // helpers
// function setStage(ctx, stage) {
//   ctx.session ??= {};
//   ctx.session.stage = stage;
// }
// function sendSetup(ctx, text) {
//   return ctx.reply(text, { reply_markup: setupKeyboard() });
// }
// function sendTrading(ctx, text) {
//   return ctx.reply(text, { reply_markup: tradingKeyboard() });
// }

// /* ------------------------------- START ---------------------------------- */

// bot.start(async (ctx) => {
//   try {
//     // your existing onboarding text (safe if it throws)
//     await Promise.resolve(startCmd(ctx)).catch((e) => {
//       console.warn('startCmd warn:', e?.message || e);
//     });

//     // decide stage based on DB
//     let connected = false;
//     try {
//       connected = await connectHl.isConnected(ctx.from.id);
//     } catch (e) {
//       console.warn('isConnected warn:', e?.message || e);
//     }

//     if (connected) {
//       setStage(ctx, 'trading');
//       return sendTrading(ctx, '✅ Welcome back. Your Hyperliquid is connected.');
//     } else {
//       setStage(ctx, 'setup');
//       return sendSetup(ctx, '👇 Let’s begin. Connect your Hyperliquid to continue.');
//     }
//   } catch (e) {
//     console.error('start fatal:', e);
//     // absolute fallback so user always sees something
//     setStage(ctx, 'setup');
//     return sendSetup(ctx, '👋 Hi! Use the buttons below to continue.');
//   }
// });

// // Also handle the “Onboard / Start” keyboard button
// bot.hears(/^🧭 Start$/, async (ctx) => {
//   try {
//     await Promise.resolve(startCmd(ctx)).catch(() => {});
//     const connected = await connectHl.isConnected(ctx.from.id).catch(() => false);
//     if (connected) {
//       setStage(ctx, 'trading');
//       return sendTrading(ctx, '✅ You are already connected.');
//     }
//     setStage(ctx, 'setup');
//     return sendSetup(ctx, '👇 Use the buttons to continue.');
//   } catch {
//     setStage(ctx, 'setup');
//     return sendSetup(ctx, '👇 Use the buttons to continue.');
//   }
// });

// /* ---------------------------- SETUP ACTIONS ----------------------------- */
// bot.hears(/^🔗 Connect HyperLiquid API$/, (ctx) => connectHl.prompt(ctx));

// /* --------------------------- TRADING ACTIONS ---------------------------- */
// bot.hears(/^📊 Portfolio$/, (ctx) => portfolioCmd(ctx));

// bot.hears(/^⚙️ Adjust Risk$/, (ctx) => riskCmd.menu(ctx));
// bot.hears(/^⚡ Use Default \(ZkAGI\)$/, async (ctx) => {
//   await riskCmd.useDefaultCmd(ctx);
//   return sendTrading(ctx, '✅ Default risk applied.');
// });
// bot.hears(/^✍️ Manual Setup$/, (ctx) => riskCmd.manualSetup(ctx));

// bot.hears(/^🚀 Trade Now$/, async (ctx) => {
//   await tradeNow(ctx);
//   return sendTrading(ctx, '✅ Done. What next?');
// });

// bot.hears(/^🛑 Kill All Positions$/, async (ctx) => {
//   await closeAll(ctx);
//   return sendTrading(ctx, '✅ All positions closed (where possible).');
// });

// bot.hears(/^🔄 Check Signal$/, (ctx) => checkSignal?.(ctx));

// /* --------------------------- SPIN THE WHEEL ----------------------------- */
// bot.hears(/^🎰 Spin the Wheel$/, async (ctx) => {
//   const outcomes = ['+5% risk boost (temp)', '−5% risk (safer)', 'Free 🍩', 'Try again!'];
//   const pick = outcomes[Math.floor(Math.random() * outcomes.length)];
//   const text = `🎡 You spun the wheel… *${pick}*`;
//   const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
//   return stage === 'trading' ? sendTrading(ctx, text) : sendSetup(ctx, text);
// });

// /* ------------------------ AWAITED TEXT ROUTER --------------------------- */
// bot.on('text', async (ctx) => {
//   // HL connect steps
//   const usedHL = await connectHl.handleText(ctx);
//   if (usedHL) {
//     if (ctx.session?.hlConnected) {
//       setStage(ctx, 'trading');
//       return sendTrading(ctx);
//     }
//     return;
//   }

//   // Risk JSON
//   if (typeof riskCmd.handleText === 'function') {
//     const usedRisk = await riskCmd.handleText(ctx);
//     if (usedRisk) return;
//   }

//   // not handled -> keep current stage visible
//   const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
//   return stage === 'trading'
//     ? sendTrading(ctx, '👇 Use the keyboard to continue.')
//     : sendSetup(ctx, '👇 Use the keyboard to continue.');
// });

// bot.catch((err, ctx) => {
//   console.error('Telegraf error for', ctx.updateType, err);
// });

// bot.launch().then(() => console.log('🤖 Bot is live with staged keyboards.'));


// bot/index.js
require('dotenv').config();
const { Telegraf, session } = require('telegraf');

const { setupKeyboard, tradingKeyboard } = require('./keyboard');

const startCmd     = require('./commands/start');
const connectHl    = require('./commands/connect_hl');
const riskCmd      = require('./commands/risk');
const portfolioCmd = require('./commands/portfolio');
const tradeNow     = require('./commands/trade_now');
const closeAll     = require('./commands/close_all');
const checkSignal  = require('./commands/check_signal'); // optional

// NEW: auto-trade engine + commands
const { startAutoTrader } = require('../packages/lib/autoTrader');
const autoTradeCmd        = require('./commands/auto_trade');

if (!process.env.BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env');
  process.exit(1);
}

// const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 0 });
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// helpers
function setStage(ctx, stage) {
  ctx.session ??= {};
  ctx.session.stage = stage;
}
function sendSetup(ctx, text) {
  return ctx.reply(text, { reply_markup: setupKeyboard() });
}
function sendTrading(ctx, text) {
  return ctx.reply(text, { reply_markup: tradingKeyboard() });
}

/* ------------------------------- START ---------------------------------- */

bot.start(async (ctx) => {
  try {
    await Promise.resolve(startCmd(ctx)).catch((e) => {
      console.warn('startCmd warn:', e?.message || e);
    });

    let connected = false;
    try {
      connected = await connectHl.isConnected(ctx.from.id);
    } catch (e) {
      console.warn('isConnected warn:', e?.message || e);
    }

    if (connected) {
      setStage(ctx, 'trading');
      return sendTrading(ctx, '✅ Welcome back. Your Hyperliquid is connected.');
    } else {
      setStage(ctx, 'setup');
      return sendSetup(ctx, '👇 Let’s begin. Connect your Hyperliquid to continue.');
    }
  } catch (e) {
    console.error('start fatal:', e);
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👋 Hi! Use the buttons below to continue.');
  }
});

// Also handle the “Onboard / Start” keyboard button
bot.hears(/^🧭 Start$/, async (ctx) => {
  try {
    await Promise.resolve(startCmd(ctx)).catch(() => {});
    const connected = await connectHl.isConnected(ctx.from.id).catch(() => false);
    if (connected) {
      setStage(ctx, 'trading');
      return sendTrading(ctx, '✅ You are already connected.');
    }
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👇 Use the buttons to continue.');
  } catch {
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👇 Use the buttons to continue.');
  }
});

/* ---------------------------- SETUP ACTIONS ----------------------------- */
bot.hears(/^🔗 Connect HyperLiquid API$/, (ctx) => connectHl.prompt(ctx));

/* --------------------------- TRADING ACTIONS ---------------------------- */
bot.hears(/^📊 Portfolio$/, (ctx) => portfolioCmd(ctx));

bot.hears(/^⚙️ Adjust Risk$/, (ctx) => riskCmd.menu(ctx));
bot.hears(/^⚡ Use Default \(ZkAGI\)$/, async (ctx) => {
  await riskCmd.useDefaultCmd(ctx);
  return sendTrading(ctx, '✅ Default risk applied.');
});
bot.hears(/^✍️ Manual Setup$/, (ctx) => riskCmd.manualSetup(ctx));

bot.hears(/^🚀 Trade Now$/, async (ctx) => {
  await tradeNow(ctx);
  return sendTrading(ctx, '✅ Done. What next?');
});

bot.hears(/^🛑 Kill All Positions$/, async (ctx) => {
  await closeAll(ctx);
  return sendTrading(ctx, '✅ All positions closed (where possible).');
});

bot.hears(/^🔄 Check Signal$/, (ctx) => checkSignal?.(ctx));

/* --------------------------- AUTO-TRADE UI ------------------------------ */
// If you added these buttons to keyboard.js, they’ll “just work”.
// If not, users can still type these exact texts to control auto-trade.
bot.hears(/^🤖 Auto-Trade: Status$/, (ctx) => autoTradeCmd.status(ctx));
bot.hears(/^▶️ Enable Auto-Trade$/,  (ctx) => autoTradeCmd.enable(ctx));
bot.hears(/^⏹ Disable Auto-Trade$/,  (ctx) => autoTradeCmd.disable(ctx));

// Backward-compat: a single “🤖 Auto Trade” button can show status
bot.hears(/^🤖 Auto Trade$/, (ctx) => autoTradeCmd.status(ctx));

/* --------------------------- SPIN THE WHEEL ----------------------------- */
bot.hears(/^🎰 Spin the Wheel$/, async (ctx) => {
  const outcomes = ['+5% risk boost (temp)', '−5% risk (safer)', 'Free 🍩', 'Try again!'];
  const pick = outcomes[Math.floor(Math.random() * outcomes.length)];
  const text = `🎡 You spun the wheel… *${pick}*`;
  const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
  return stage === 'trading' ? sendTrading(ctx, text) : sendSetup(ctx, text);
});

/* ------------------------ AWAITED TEXT ROUTER --------------------------- */
bot.on('text', async (ctx) => {
  const usedHL = await connectHl.handleText(ctx);
  if (usedHL) {
    if (ctx.session?.hlConnected) {
      setStage(ctx, 'trading');
      // no text, just show the keyboard again
      return sendTrading(ctx, '✅ Hyperliquid connected. Choose an action below.');
    }
    return;
  }

  if (typeof riskCmd.handleText === 'function') {
    const usedRisk = await riskCmd.handleText(ctx);
    if (usedRisk) return;
  }

  const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
  return stage === 'trading'
    ? sendTrading(ctx, '👇 Use the keyboard to continue.')
    : sendSetup(ctx, '👇 Use the keyboard to continue.');
});

bot.catch((err, ctx) => {
  console.error('Telegraf error for', ctx.updateType, err);
});

/* ------------------------- LAUNCH & SCHEDULER --------------------------- */
let stopAuto = null;

bot.launch().then(() => {
  console.log('🤖 Bot is live with staged keyboards.');

  // Start Auto-Trader loop (single process)
  stopAuto = startAutoTrader({
    intervalMin: Number(process.env.AUTO_TRADE_INTERVAL_MIN || 30),
    bot, // pass bot to DM users on executed trades (optional)
  });
});

// graceful shutdown
process.once('SIGINT', () => { if (stopAuto) stopAuto(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { if (stopAuto) stopAuto(); bot.stop('SIGTERM'); });
