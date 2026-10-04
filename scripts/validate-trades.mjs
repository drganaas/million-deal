/**
 * Historical validation: find bars where >=3 strategies agree, simulate TP/SL.
 * Run: node scripts/validate-trades.mjs
 */
const BINANCE = "https://data-api.binance.vision";

async function fetchKlines(symbol, interval = "15m", limit = 200) {
  const res = await fetch(
    `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const raw = await res.json();
  return raw.map((r) => ({
    time: Math.floor(r[0] / 1000),
    open: +r[1],
    high: +r[2],
    low: +r[3],
    close: +r[4],
    volume: +r[5],
  }));
}

function ema(values, period) {
  const out = Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  const n = Math.min(period, values.length);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) out[i] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function lastFinite(v) {
  for (let i = v.length - 1; i >= 0; i--) if (Number.isFinite(v[i])) return v[i];
  return 0;
}

function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function atr(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const p = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - p), Math.abs(c.low - p));
  });
  return ema(tr, period);
}

function macdHist(closes) {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(line, 9);
  return line.map((v, i) => v - signal[i]);
}

function votesAt(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const i = c.length - 1;

  const range = Math.max(cur.high - cur.low, 1e-12);
  const lower = Math.min(cur.open, cur.close) - cur.low;
  const upper = cur.high - Math.max(cur.open, cur.close);
  const body = Math.abs(cur.close - cur.open);
  const hammer = lower >= body * 1.4 && upper <= body * 0.8;
  const reclaim = cur.close >= lastFinite(e20) * 0.992 && cur.close >= prev.close * 0.998;
  const hidden = hammer && reclaim && cur.close >= cur.open * 0.999;

  const w = c.slice(-21, -1);
  const swingLow = Math.min(...w.map((x) => x.low));
  const swingHigh = Math.max(...w.map((x) => x.high));
  const liq =
    cur.low <= swingLow * 1.001 &&
    cur.close > swingLow &&
    cur.close > Math.min(cur.open, swingLow) &&
    cur.close < swingHigh * 1.01;

  const prevHigh = Math.max(...c.slice(i - 20, i).map((x) => x.high));
  const prevLow = Math.min(...c.slice(i - 20, i).map((x) => x.low));
  const bos = cur.close > prevHigh * 0.998 && e20[i] >= e50[i] * 0.998;
  const choch = c[i - 1].close <= e50[i - 1] * 1.002 && cur.close > e50[i] && cur.close >= cur.open;
  const sweep = cur.low < prevLow && cur.close > prevLow;
  const a = c[i - 2];
  const b = c[i - 1];
  const fvg = a.high < cur.low || (a.high < b.low && cur.close > b.close);
  const ob = b.close < b.open && cur.close > b.open;
  const smcHits = [bos, choch, sweep, fvg, ob].filter(Boolean).length;
  const smc = smcHits >= 2 || ((bos || choch) && (sweep || ob || fvg));

  const r = lastFinite(rsi(closes));
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const h1 = hist.at(-2);
  const volAvg = vols.slice(-21, -1).reduce((s, v) => s + v, 0) / 20 || 1;
  const ratio = vols.at(-1) / volAvg;
  const volMom = (h0 > h1 || h0 > 0) && r >= 38 && r <= 68 && ratio >= 1.15;

  const lows = c.map((x) => x.low);
  const atl = Math.min(...lows);
  const recentLow = Math.min(...c.slice(-40).map((x) => x.low));
  const dist = ((cur.close - recentLow) / recentLow) * 100;
  const nearAtl = Math.abs(recentLow - atl) / atl < 0.03;
  const priorLow = Math.min(...c.slice(-80, -20).map((x) => x.low));
  const dbl = Math.abs(recentLow - priorLow) / priorLow < 0.018;
  const bottom = dist <= 6 && r < 60 && (nearAtl || dbl || dist <= 3.5);

  return {
    hidden,
    liq,
    smc,
    volMom,
    bottom,
    agree: [hidden, liq, smc, volMom, bottom].filter(Boolean).length,
  };
}

function plan(c) {
  const entry = c.at(-1).close;
  const a = lastFinite(atr(c)) || entry * 0.01;
  const recentLow = Math.min(...c.slice(-20).map((x) => x.low));
  let sl = Math.min(entry - a * 1.25, recentLow - a * 0.15);
  if (entry - sl > entry * 0.015) sl = entry - entry * 0.015;
  if (entry - sl < entry * 0.004) sl = entry - entry * 0.004;
  const risk = entry - sl;
  return {
    entry,
    sl,
    tp1: entry + risk * 1.5,
    tp2: entry + risk * 2.5,
    tp3: entry + risk * 4,
  };
}

function outcome(candles, startIdx, p) {
  for (let i = startIdx + 1; i < candles.length; i++) {
    const bar = candles[i];
    if (bar.low <= p.sl) return { hit: "SL", exit: p.sl, bars: i - startIdx };
    if (bar.high >= p.tp3) return { hit: "TP3", exit: p.tp3, bars: i - startIdx };
    if (bar.high >= p.tp2) return { hit: "TP2", exit: p.tp2, bars: i - startIdx };
    if (bar.high >= p.tp1) return { hit: "TP1", exit: p.tp1, bars: i - startIdx };
  }
  const last = candles.at(-1).close;
  return { hit: "OPEN", exit: last, bars: candles.length - 1 - startIdx };
}

async function validateSymbol(symbol) {
  const candles = await fetchKlines(symbol, "15m", 200);
  const trades = [];
  for (let i = 80; i < candles.length - 5; i++) {
    const slice = candles.slice(0, i + 1);
    const v = votesAt(slice);
    if (v.agree < 3) continue;
    const p = plan(slice);
    const o = outcome(candles, i, p);
    const pnl = ((o.exit - p.entry) / p.entry) * 100;
    trades.push({
      symbol,
      time: new Date(candles[i].time * 1000).toISOString(),
      agree: v.agree,
      votes: v,
      entry: +p.entry.toFixed(6),
      sl: +p.sl.toFixed(6),
      tp1: +p.tp1.toFixed(6),
      tp2: +p.tp2.toFixed(6),
      tp3: +p.tp3.toFixed(6),
      hit: o.hit,
      pnl: +pnl.toFixed(3),
      bars: o.bars,
    });
    if (trades.length >= 3) break;
  }
  return trades;
}

const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"];
const all = [];
for (const s of symbols) {
  try {
    const t = await validateSymbol(s);
    all.push(...t);
  } catch (e) {
    console.error(s, e.message);
  }
}

const sample = all.slice(0, 3);
const wins = sample.filter((t) => t.hit.startsWith("TP")).length;
const losses = sample.filter((t) => t.hit === "SL").length;

console.log(JSON.stringify({ testedSignals: sample.length, wins, losses, open: sample.filter((t) => t.hit === "OPEN").length, trades: sample, poolFound: all.length }, null, 2));
