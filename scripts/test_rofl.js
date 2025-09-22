// scripts/test_rofl.js
require('dotenv').config();
const fetch = require('node-fetch');

const BASE = process.env.ROFL_GATEWAY_URL;
const APP  = process.env.ROFL_APP_ID;

(async () => {
  try {
    if (!BASE || !APP) throw new Error('ROFL_GATEWAY_URL/ROFL_APP_ID missing in .env');

    console.log('BASE:', BASE);
    console.log('APP :', APP);

    const h = await fetch(`${BASE}/health`);
    console.log('health:', h.status, await h.text());

    const encRes = await fetch(`${BASE}/v1/apps/${APP}/encrypt`, {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ userId: 'selftest', plaintext: 'hello' })
    });
    const enc = await encRes.json();
    console.log('encrypt:', encRes.status, enc);

    const decRes = await fetch(`${BASE}/v1/apps/${APP}/decrypt`, {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ userId: 'selftest', ...enc })
    });
    const dec = await decRes.json();
    console.log('decrypt:', decRes.status, dec);
  } catch (e) {
    console.error('ROFL test error:', e);
    process.exit(1);
  }
})();

