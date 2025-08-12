require('dotenv').config();

function b64(buf) { return Buffer.from(buf).toString('base64'); }
function ub64(s)   { return Buffer.from(s, 'base64'); }

const base = process.env.ROFL_GATEWAY_URL;
const app  = process.env.ROFL_APP_ID;

async function roflEncrypt(userId, utf8String) {
  const res = await fetch(`${base}/v1/apps/${app}/encrypt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: String(userId),
      plaintext: b64(Buffer.from(utf8String, 'utf8')),
    }),
  });
  if (!res.ok) throw new Error(`ROFL encrypt failed: ${res.status}`);
  const out = await res.json(); // { iv, tag, ciphertext } base64
  return { iv: ub64(out.iv), tag: ub64(out.tag), ciphertext: ub64(out.ciphertext) };
}

async function roflDecrypt(userId, iv, tag, ciphertext) {
  const res = await fetch(`${base}/v1/apps/${app}/decrypt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: String(userId),
      iv: b64(iv), tag: b64(tag), ciphertext: b64(ciphertext),
    }),
  });
  if (!res.ok) throw new Error(`ROFL decrypt failed: ${res.status}`);
  const out = await res.json(); // { plaintext }
  return Buffer.from(out.plaintext, 'base64').toString('utf8');
}

module.exports = { roflEncrypt, roflDecrypt };

