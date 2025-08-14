// bot/utils/invokeAsText.js
module.exports = async function invokeAsText(ctx, handler, text) {
  const oldUpdate = ctx.update, oldMessage = ctx.message;
  const fakeMessage = { ...(oldMessage || {}), chat: ctx.chat, from: ctx.from, text };
  try {
    ctx.update = { ...(oldUpdate || {}), message: fakeMessage };
    ctx.message = fakeMessage;
    return await handler(ctx);
  } finally {
    ctx.update = oldUpdate;
    ctx.message = oldMessage;
  }
};

