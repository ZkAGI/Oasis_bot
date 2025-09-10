const { users } = require('../../packages/lib/db');
const { mainKeyboard } = require('../keyboard');
const { utils } = require('ethers');

module.exports = async function start(ctx) {
  const col = await users();
  const telegramId = String(ctx.from.id);

  let u = await col.findOne({ telegramId });
  if (!u) {
    const agentId = utils.keccak256(utils.toUtf8Bytes(telegramId));
    u = {
      telegramId,
      agentId,
      hlAddress: '',
      hlSecretCipher: null,
      settings: {},
      createdAt: new Date()
    };
    await col.insertOne(u);
  }

  await ctx.reply(
    [
      '👋 Welcome to Oasis-ROFL × HL bot!',
      `• AgentID: ${u.agentId}`,
      'Tap **Connect HL** to paste your secret key (it will be encrypted in ROFL).'
    ].join('\n'),
    { reply_markup: mainKeyboard().reply_markup, parse_mode: 'Markdown' }
  );
};
