// bot/commands/auto_trade.js
const { users } = require('../../packages/lib/db');

async function status(ctx) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(ctx.from.id) }, {
    projection: { autoTrade:1, lastExecuted:1 }
  });
  const en = u?.autoTrade?.enabled ? 'ON' : 'OFF';
  const last = u?.autoTrade?.lastRunAt ? new Date(u.autoTrade.lastRunAt).toLocaleString() : '—';
  const lastErr = u?.autoTrade?.lastError || '—';
  await ctx.reply(
    `🤖 Auto-Trade is *${en}*\n` +
    `• Last run: ${last}\n` +
    `• Last error: ${lastErr}`,
    { parse_mode: 'Markdown' }
  );
}

async function enable(ctx) {
  const col = await users();
  await col.updateOne(
    { telegramId: String(ctx.from.id) },
    { $set: { 'autoTrade.enabled': true, 'autoTrade.requestedAt': Date.now() } },
    { upsert: true }
  );
  await ctx.reply('✅ Auto-Trade *enabled*. I’ll watch signals and execute when a new one appears.', { parse_mode: 'Markdown' });
}

async function disable(ctx) {
  const col = await users();
  await col.updateOne(
    { telegramId: String(ctx.from.id) },
    { $set: { 'autoTrade.enabled': false, 'autoTrade.requestedAt': Date.now() } },
    { upsert: true }
  );
  await ctx.reply('⏸️ Auto-Trade *disabled*.', { parse_mode: 'Markdown' });
}

module.exports = { status, enable, disable };

