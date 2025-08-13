// bot/forecast.js
require('dotenv').config();

async function fetchLatestForecast() {
  const url = process.env.SIGNAL_API_URL;
  if (!url) throw new Error('SIGNAL_API_URL not set');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast fetch failed: ${res.status}`);
  const j = await res.json();

  const arr = j.forecast_today_hourly || [];
  if (!Array.isArray(arr) || arr.length === 0) return null;

  // pick the newest by time
  const latest = arr.reduce((a, b) => (new Date(a.time) > new Date(b.time) ? a : b));
  // normalize a tiny shape the rest of the bot understands
  return {
    iso: latest.time,                    // "2025-08-13T12:00:00+00:00"
    symbol: 'BTC',                       // change if your API sends this
    side: latest.signal.toUpperCase(),   // LONG | SHORT | HOLD
    entry: Number(latest.entry_price),
    tp: Number(latest.take_profit),
    sl: Number(latest.stop_loss)
  };
}

module.exports = { fetchLatestForecast };

