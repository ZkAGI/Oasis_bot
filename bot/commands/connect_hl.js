// const { users } = require('../../packages/lib/db');
// const { roflEncrypt } = require('../roflClient');

// const STEPS = {
//   MAIN_ADDR: 'hl_main_addr',
//   API_ADDR: 'hl_api_addr',
//   SECRET: 'hl_secret',
// };

// function isConnectedDoc(u) {
//   return Boolean(u?.hlMainAddress && u?.hlAddress && u?.hlSecretCipher);
// }

// async function isConnected(telegramId) {
//   const col = await users();
//   const u = await col.findOne({ telegramId: String(telegramId) }, { projection: {
//     hlMainAddress: 1, hlAddress: 1, hlSecretCipher: 1
//   }});
//   return isConnectedDoc(u);
// }

// async function prompt(ctx) {
//   ctx.session ??= {};
//   ctx.session.await = STEPS.MAIN_ADDR;

//   await ctx.reply(
//     '🔗 Let’s connect your Hyperliquid.\n\n' +
//     'Step 1/3 — *Paste your Hyperliquid Main Wallet Address* (0x…)\n' +
//     '• This is your funding/main wallet on HL.',
//     { parse_mode: 'Markdown' }
//   );
// }

// async function handleText(ctx) {
//   ctx.session ??= {};
//   const step = ctx.session.await;
//   if (!step) return false; // not in HL flow

//   const col = await users();
//   const telegramId = String(ctx.from.id);
//   const text = (ctx.message?.text || '').trim();

//   try {
//     if (step === STEPS.MAIN_ADDR) {
//       if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
//         await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
//         return true;
//       }
//       await col.updateOne({ telegramId }, { $set: { hlMainAddress: text } }, { upsert: true });
//       ctx.session.await = STEPS.API_ADDR;
//       await ctx.reply(
//         'Step 2/3 — *Paste your Hyperliquid API Wallet Address* (0x…)\n' +
//         '• This is the API wallet used to place trades.',
//         { parse_mode: 'Markdown' }
//       );
//       return true;
//     }

//     if (step === STEPS.API_ADDR) {
//       if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
//         await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
//         return true;
//       }
//       await col.updateOne({ telegramId }, { $set: { hlAddress: text } }, { upsert: true });
//       ctx.session.await = STEPS.SECRET;
//       await ctx.reply(
//         'Step 3/3 — *Paste your Hyperliquid API Private Key* (will be end-to-end encrypted in ROFL).\n' +
//         '• After I confirm, please delete your message for your own hygiene.',
//         { parse_mode: 'Markdown' }
//       );
//       return true;
//     }

//     if (step === STEPS.SECRET) {
//       if (text.length < 8) {
//         await ctx.reply('⚠️ That doesn’t look like a valid secret. Please paste your API private key again.');
//         return true;
//       }
//       const enc = await roflEncrypt(telegramId, text); // { iv, tag, ciphertext }
//       await col.updateOne({ telegramId }, { $set: { hlSecretCipher: enc } }, { upsert: true });

//       ctx.session.await = null;
//       ctx.session.hlConnected = true; // <-- flag for index.js

//       await ctx.reply(
//         '✅ Your Hyperliquid account is securely connected. ' +
//         'You can now adjust risk, trade manually, or enable auto trade.\n\n' +
//         'For safety, delete your previous message containing the secret.',
//         { parse_mode: 'Markdown' }
//       );
//       return true;
//     }
//   } catch (e) {
//     console.error('connect_hl handleText error:', e);
//     await ctx.reply('❌ Something went wrong while saving your details. Please try again.');
//     // keep the same step so user can retry
//     return true;
//   }

//   return false;
// }

// module.exports = { prompt, handleText, isConnected };

// bot/commands/connect_hl.js
const { users } = require('../../packages/lib/db');
const { roflEncrypt } = require('../roflClient');
const { ensureAgent } = require('../../packages/lib/agentRegistry');

const STEPS = {
  MAIN_ADDR: 'hl_main_addr',
  API_ADDR: 'hl_api_addr',
  SECRET: 'hl_secret',
};

function isConnectedDoc(u) {
  return Boolean(u?.hlMainAddress && u?.hlAddress && u?.hlSecretCipher && u?.agentID);
}

async function isConnected(telegramId) {
  const col = await users();
  const u = await col.findOne(
    { telegramId: String(telegramId) },
    { projection: { hlMainAddress: 1, hlAddress: 1, hlSecretCipher: 1, agentID: 1 } }
  );
  return isConnectedDoc(u);
}

async function prompt(ctx) {
  ctx.session ??= {};
  ctx.session.await = STEPS.MAIN_ADDR;

  await ctx.reply(
    '🔗 Let’s connect your Hyperliquid.\n\n' +
    'Step 1/3 — *Paste your Hyperliquid Main Wallet Address* (0x…)\n' +
    '• This is your funding/main wallet on HL.',
    { parse_mode: 'Markdown' }
  );
}

function isHexAddr(s) { return /^0x[a-fA-F0-9]{40}$/.test(s); }

async function handleText(ctx) {
  ctx.session ??= {};
  const step = ctx.session.await;
  if (!step) return false; // not in HL flow

  const col = await users();
  const telegramId = String(ctx.from.id);
  const text = (ctx.message?.text || '').trim();

  try {
    if (step === STEPS.MAIN_ADDR) {
      if (!isHexAddr(text)) {
        await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
        return true;
      }
      await col.updateOne(
        { telegramId },
        { $set: { hlMainAddress: text } },
        { upsert: true }
      );
      ctx.session.hlMainAddress = text;
      ctx.session.await = STEPS.API_ADDR;
      await ctx.reply(
        'Step 2/3 — *Paste your Hyperliquid API Wallet Address* (0x…)\n' +
        '• This is the API wallet used to place trades.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    if (step === STEPS.API_ADDR) {
      if (!isHexAddr(text)) {
        await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
        return true;
      }
      await col.updateOne(
        { telegramId },
        { $set: { hlAddress: text } },
        { upsert: true }
      );
      ctx.session.hlAddress = text;
      ctx.session.await = STEPS.SECRET;
      await ctx.reply(
        'Step 3/3 — *Paste your Hyperliquid API Private Key* (will be end-to-end encrypted in ROFL).\n' +
        '• After I confirm, please delete your message for your own hygiene.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    if (step === STEPS.SECRET) {
      if (text.length < 8) {
        await ctx.reply('⚠️ That doesn’t look like a valid secret. Please paste your API private key again.');
        return true;
      }

      // 1) Encrypt & store secret
      const enc = await roflEncrypt(telegramId, text); // { iv, tag, ciphertext }
      await col.updateOne(
        { telegramId },
        { $set: { hlSecretCipher: enc } },
        { upsert: true }
      );

      // 2) Ensure on-chain Agent using MAIN wallet as owner
      const ownerAddr = ctx.session.hlMainAddress
        || (await col.findOne({ telegramId }, { projection: { hlMainAddress: 1 } })).hlMainAddress;

      if (!ownerAddr) {
        await ctx.reply('⚠️ Missing main wallet address; please restart /connect_hl.');
        return true;
      }

      const rpcUrl  = process.env.RPC_URL;
      const regAddr = process.env.AGENT_REGISTRY_ADDRESS;
      const pk      = process.env.PRIVATE_KEY; // signer with MANAGER_ROLE
      if (!rpcUrl || !regAddr || !pk) {
        await ctx.reply('⚠️ Registry not configured on server (missing RPC/REGISTRY/KEY). Contact admin.');
        return true;
      }

      const agentID = await ensureAgent({
        rpcUrl: rpcUrl,
        registryAddr: regAddr,
        signerPk: pk,
        ownerAddr: ownerAddr,
        agentLabel: `agent:${telegramId}`,
        metadataURI: '' // optional: later you can store IPFS JSON
      });

      // 3) Persist agentID
      await col.updateOne(
        { telegramId },
        { $set: { agentID } },
        { upsert: true }
      );

      // 4) Mark connected in session
      ctx.session.await = null;
      ctx.session.hlConnected = true;
      ctx.session.agentID = agentID;

      await ctx.reply(
        '✅ Your Hyperliquid account is securely connected and your Agent is registered on-chain.\n' +
        'You can now adjust risk, trade manually, or enable auto trade.\n\n' +
        'For safety, delete your previous message containing the secret.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  } catch (e) {
    console.error('connect_hl handleText error:', e);
    await ctx.reply('❌ Something went wrong while saving your details. Please try again.');
    return true; // keep same step so user can retry
  }

  return false;
}

module.exports = { prompt, handleText, isConnected };
