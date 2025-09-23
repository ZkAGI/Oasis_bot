// bot/keyboard.js

// function setupKeyboard() {
//   return {
//     keyboard: [
//       [{ text: '🧭 Start' }],
//       [{ text: '🔗 Connect HyperLiquid API' }],
//       [{ text: '🎰 Spin the Wheel' }],
//     ],
//     resize_keyboard: true,
//     one_time_keyboard: false,
//   };
// }

// function tradingKeyboard() {
//   return {
//     keyboard: [
//       [{ text: '📊 Portfolio' }, { text: '⚙️ Adjust Risk' }],
//       [{ text: '🚀 Trade Now' }, { text: '🤖 Auto Trade' }],
//       [{ text: '🛑 Kill All Positions' }, { text: '🔄 Check Signal' }],
//       [{ text: '🎰 Spin the Wheel' }],
//     ],
//     resize_keyboard: true,
//     one_time_keyboard: false,
//   };
// }

// // thin wrappers to keep ctx.reply terse
// function asMarkup(kb) {
//   return { reply_markup: kb };
// }

// module.exports = {
//   setupKeyboard,
//   tradingKeyboard,
//   asMarkup,
// };


function setupKeyboard() {
  return {
    keyboard: [
      [{ text: '🧭 Start' }],
      [{ text: '🔗 Connect HyperLiquid API' }],
      [{ text: '🎰 Spin the Wheel' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function tradingKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Portfolio' }, { text: '⚙️ Adjust Risk' }],
      [{ text: '🚀 Trade Now' }, { text: '🤖 Auto Trade' }],
      // New dedicated Auto-Trade controls (index.js already has handlers)
      [
        { text: '🤖 Auto-Trade: Status' },
        { text: '▶️ Enable Auto-Trade' },
        { text: '⏹ Disable Auto-Trade' },
      ],
      [{ text: '🛑 Kill All Positions' }, { text: '🔄 Check Signal' }],
      [{ text: '🎰 Spin the Wheel' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

// thin wrappers to keep ctx.reply terse
function asMarkup(kb) {
  return { reply_markup: kb };
}

module.exports = {
  setupKeyboard,
  tradingKeyboard,
  asMarkup,
};
