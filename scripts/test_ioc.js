#!/usr/bin/env node
require('dotenv').config();
const fetch = require('node-fetch');
const { Hyperliquid } = require('hyperliquid');

// Usage: node scripts/hl_place_ioc.js LONG BTC-PERP 0.001
const SIDE = (process.argv[2] || 'LONG').toUpperCase(); // LONG | SHORT
const COIN = process.argv[3] || 'BTC-PERP';
const SIZE = Number(process.argv[4] || process.env.TEST_SIZE || '0.001'); // BTC size

const pk = process.env.HL_SECRET;   // <-- paste your HL secret here (env)
const addr = process.env.HL_ADDRESS; // <-- your HL wallet address

if (!pk || !addr) {
  console.error('Set HL_SECRET and HL_ADDRESS env vars first.');
  process.exit(1);
}

(async () => {
  const sdk = new Hyperliquid({ privateKey: pk, walletAddress: addr, testnet: false });

  const mids = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' })
  }).then(r => r.json());

  const spot = COIN.replace('-PERP', '');
  const mid = Number(mids[spot]);
  if (!mid) throw new Error('Could not fetch mid price');

  const is_buy = SIDE === 'LONG';
  const px = Math.round(mid * (is_buy ? 1.01 : 0.99)); // 1% through to fill IOC

  const params = {
    coin: COIN,
    is_buy,
    sz: SIZE,
    limit_px: px,
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: false
  };

  console.log('Placing order:', params);
  const res = await sdk.exchange.placeOrder(params);
  console.log('Result:', JSON.stringify(res, null, 2));
})().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
