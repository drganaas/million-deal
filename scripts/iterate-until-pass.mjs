/**
 * Iterate: random-40 × 4 strategies until ALL reach winRate >= TARGET (default 50, aim 70).
 * Run: node scripts/iterate-until-pass.mjs
 * Env: TARGET=50 SEED=... MAX_ROUNDS=12
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINANCE = "https://data-api.binance.vision";
const TARGET = Number(process.env.TARGET) || 50;
const AIM = Number(process.env.AIM) || 70;
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS) || 15;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchUsdtSymbols() {
  const res = await fetch(`${BINANCE}/api/v3/exchangeInfo`);
  if (!res.ok) throw new Error(`exchangeInfo ${res.status}`);
  const data = await res.json();
  const skipExact = new Set([
    "USDCUSDT",
    "FDUSDUSDT",
    "TUSDUSDT",
    "DAIUSDT",
    "EURUSDT",
    "GBPUSDT",
    "USDPUSDT",
    "USDEUSDT",
    "BFUSDUSDT",
  ]);
  return data.symbols
    .filter((s) => {
      const sym = s.symbol;
      if (s.status !== "TRADING" || s.quoteAsset !== "USDT") return false;
      if (s.isSpotTradingAllowed === false) return false;
      if (skipExact.has(sym)) return false;
      if (/UPUSDT$|DOWNUSDT$|BEAR|BULL/.test(sym)) return false;
      if (/BUSDT$/.test(sym) && sym !== "BNBUSDT") return false;
      if (/^(USD|EUR|GBP|TRY|BRL|FDUSD)/.test(sym)) return false;
      const base = s.baseAsset || sym.replace(/USDT$/, "");
      return base.length >= 2 && base.length <= 12;
    })
    .map((s) => s.symbol);
}

async function fetchKlines(symbol, interval = "15m", limit = 1000) {
  const res = await fetch(
    `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`klines ${res.status}`);
  return (await res.json()).map((r) => ({
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
function sma(values, period) {
  const out = Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
function lastFinite(v) {
  for (let i = v.length - 1; i >= 0; i--) if (Number.isFinite(v[i])) return v[i];
  return 0;
}
function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(50);
  let gains = 0,
    losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period,
    avgLoss = losses / period;
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
  const signal = ema(
    line.map((v) => (Number.isFinite(v) ? v : 0)),
    9,
  );
  return line.map((v, i) => v - signal[i]);
}
function swingHighs(c, look = 3) {
  const out = [];
  for (let i = look; i < c.length - look; i++) {
    const v = c[i].high;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (c[i - j].high >= v || c[i + j].high > v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ i, price: v });
  }
  return out;
}
function swingLows(c, look = 3) {
  const out = [];
  for (let i = look; i < c.length - look; i++) {
    const v = c[i].low;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (c[i - j].low <= v || c[i + j].low < v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ i, price: v });
  }
  return out;
}

/** Tunable strictness level 0..8 — higher = fewer trades, higher WR */
let L = 3;

function ctx(c) {
  const last = c.at(-1);
  const prev = c.at(-2);
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const recent = c.slice(-64);
  const recentLow = Math.min(...recent.map((x) => x.low));
  const recentHigh = Math.max(...recent.map((x) => x.high));
  const dist = ((last.close - recentLow) / recentLow) * 100;
  const room = ((recentHigh - last.close) / last.close) * 100;
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const e20b = lastFinite(ema(closes.slice(0, -1), 20));
  const r = lastFinite(rsi(closes));
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const h1 = hist.at(-2);
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  const a = lastFinite(atr(c)) || last.close * 0.01;
  const atrPct = (a / last.close) * 100;
  const green = last.close > last.open;
  const green2 = green && prev.close > prev.open;
  const body = Math.abs(last.close - last.open);
  const range = Math.max(last.high - last.low, 1e-12);
  const upperHalf = last.close >= (last.high + last.low) / 2;
  const strongBody = green && body / range >= 0.5;
  const rising =
    c.slice(-5).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >= 3;
  const higherLows =
    c.slice(-8).filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >=
    4;
  const emaSlopeUp = e20 > e20b;
  const trendUp = e20 >= e50 * (0.998 - L * 0.0003) && last.close >= e20;
  const volMax = 2.6 - L * 0.08;
  const volMin = 1.15 + L * 0.03;
  const distMax = 3.2 - L * 0.12;
  const distMin = 0.35 + L * 0.04;
  const rsiMax = 60 - L * 0.8;
  const rsiMin = 40 + L * 0.4;
  return {
    last,
    prev,
    closes,
    vols,
    dist,
    room,
    e20,
    e50,
    r,
    h0,
    h1,
    volRatio,
    atrPct,
    green,
    green2,
    body,
    range,
    upperHalf,
    strongBody,
    rising,
    higherLows,
    emaSlopeUp,
    trendUp,
    volMax,
    volMin,
    distMax,
    distMin,
    rsiMax,
    rsiMin,
  };
}

function superGate(x) {
  if (!(x.dist >= x.distMin && x.dist <= x.distMax)) return false;
  if (!(x.volRatio >= x.volMin && x.volRatio <= x.volMax)) return false;
  if (!(x.h0 > 0 && x.h0 >= x.h1)) return false;
  if (!(x.r >= x.rsiMin && x.r <= x.rsiMax)) return false;
  if (!x.trendUp) return false;
  if (!x.rising) return false;
  if (!(x.room >= 0.8 + L * 0.05)) return false;
  if (!(x.atrPct >= 0.35)) return false;
  if (L >= 2 && !x.green) return false;
  if (L >= 4 && !x.green2) return false;
  if (L >= 5 && !x.higherLows) return false;
  if (L >= 6 && !x.emaSlopeUp) return false;
  if (L >= 7 && !x.upperHalf) return false;
  return true;
}

function pillarCandles(c) {
  const x = ctx(c);
  if (!superGate(x)) return { pass: false, score: 0, id: "candles" };
  const { last: cur, prev, body, range } = x;
  const lower = Math.min(cur.open, cur.close) - cur.low;
  const upper = cur.high - Math.max(cur.open, cur.close);
  const bull = cur.close > cur.open;
  const hammer = bull && lower >= body * 1.6 && upper <= body * 0.55 && lower / range >= 0.4;
  const engulf =
    bull &&
    prev.close < prev.open &&
    cur.close >= prev.open &&
    cur.open <= prev.close &&
    body > Math.abs(prev.close - prev.open) * 0.9;
  const pin = lower >= range * 0.5 && upper <= range * 0.25 && bull;
  const strong = bull && body / range >= 0.6 && cur.close > prev.high;
  const patternOk = hammer || engulf || pin || strong || (L < 3 && x.strongBody && cur.close > prev.high);
  let score = 0;
  if (hammer) score += 30;
  if (engulf) score += 32;
  if (pin) score += 18;
  if (strong) score += 16;
  if (x.volRatio >= 1.3) score += 12;
  if (x.dist <= 2.5) score += 10;
  if (x.green2) score += 8;
  const need = 40 + L * 2;
  return { pass: patternOk && score >= need && x.upperHalf, score, id: "candles" };
}

function pillarIndicators(c) {
  const x = ctx(c);
  if (!superGate(x)) return { pass: false, score: 0, id: "indicators" };
  let score = 0;
  if (x.r >= 44 && x.r <= 56) score += 26;
  if (x.h0 > 0 && x.h0 >= x.h1) score += 26;
  if (x.e20 >= x.e50 && x.last.close >= x.e20) score += 18;
  if (x.volRatio >= 1.3 && x.volRatio <= 2.2) score += 22;
  if (x.rising && x.higherLows) score += 18;
  else if (x.rising || x.higherLows) score += 8;
  if (x.dist >= 0.6 && x.dist <= 2.4) score += 14;
  if (x.green) score += 10;
  if (x.emaSlopeUp) score += 10;
  if (x.strongBody) score += 8;
  const need = 70 + L * 2;
  const pass =
    score >= need &&
    x.h0 > 0 &&
    x.h0 >= x.h1 &&
    x.volRatio >= 1.25 &&
    x.rising &&
    x.dist <= 2.6 &&
    x.green &&
    (L < 4 || x.higherLows) &&
    (L < 5 || x.strongBody);
  return { pass, score, id: "indicators" };
}

function pillarPeaks(c) {
  const x = ctx(c);
  if (!superGate(x)) return { pass: false, score: 0, id: "peaks" };
  const lows = c.map((z) => z.low);
  const window = lows.slice(0, -2);
  const swingLow = Math.min(...window);
  const dist = ((x.last.close - swingLow) / swingLow) * 100;
  const stillAtZero = dist >= 0 && dist <= 0.55;
  const earlyBounce = dist > 0.55 && dist <= 2.8 - L * 0.05;
  if (!(stillAtZero || earlyBounce)) return { pass: false, score: 0, id: "peaks" };
  const highs = swingHighs(c, 3);
  const swLows = swingLows(c, 3);
  let hhhl = false,
    higherLow = false,
    lhll = false;
  if (highs.length >= 2 && swLows.length >= 2) {
    hhhl =
      highs.at(-1).price > highs.at(-2).price &&
      swLows.at(-1).price > swLows.at(-2).price;
    higherLow = swLows.at(-1).price > swLows.at(-2).price;
    lhll =
      highs.at(-1).price < highs.at(-2).price &&
      swLows.at(-1).price < swLows.at(-2).price;
  }
  if (lhll) return { pass: false, score: 0, id: "peaks" };
  let score = stillAtZero ? 40 : 28;
  if (x.green) score += 12;
  if (x.last.close > x.prev.close) score += 10;
  if (x.volRatio >= 1.25 && x.volRatio <= 2.4) score += 14;
  if (hhhl) score += 22;
  else if (higherLow) score += 14;
  if (x.h0 > 0) score += 10;
  if (dist <= 2.5) score += 10;
  const structOk = hhhl || higherLow || stillAtZero;
  const need = 55 + L * 2;
  const pass =
    structOk &&
    score >= need &&
    x.green &&
    x.volRatio >= 1.2 &&
    x.h0 > 0 &&
    (L < 3 || higherLow || hhhl) &&
    (L < 6 || hhhl || stillAtZero);
  return { pass, score, id: "peaks", dist };
}

function pillarBreakout(c) {
  const x = ctx(c);
  if (!superGate(x)) return { pass: false, score: 0, id: "breakout" };
  const lows = swingLows(c, 3);
  const lastLow = lows.length
    ? lows.at(-1).price
    : Math.min(...c.slice(-20).map((z) => z.low));
  const supportBreak = x.last.close < lastLow && x.last.close < x.last.open;
  if (supportBreak) return { pass: false, score: 0, id: "breakout" };
  const reclaim =
    c.length >= 3 &&
    c.at(-2).low <= lastLow * 1.001 &&
    x.last.close >= lastLow &&
    x.green &&
    x.last.close > x.prev.close;
  // At high L, only reclaim; at low L allow early micro-break above prior bar high
  const microBreak =
    L <= 2 && x.green && x.last.close > x.prev.high && x.dist <= 2.2 && x.strongBody;
  if (!reclaim && !microBreak) return { pass: false, score: 0, id: "breakout" };
  let score = reclaim ? 48 : 28;
  if (x.volRatio >= 1.3 && x.volRatio <= 2.3) score += 16;
  if (x.h0 > 0) score += 12;
  if (x.rising) score += 10;
  if (x.dist >= 0.4 && x.dist <= 2.3) score += 14;
  if (x.strongBody) score += 12;
  if (x.green2) score += 8;
  const need = 60 + L * 2;
  const pass =
    score >= need &&
    x.h0 > 0 &&
    x.volRatio >= 1.25 &&
    x.volRatio <= 2.5 &&
    x.dist <= 2.5 &&
    x.rising &&
    (L < 4 || reclaim) &&
    (L < 5 || x.strongBody) &&
    (L < 6 || x.green2);
  return { pass, score, id: "breakout", reclaim };
}

function plan(c) {
  const entry = c.at(-1).close;
  const a = lastFinite(atr(c)) || entry * 0.01;
  const recentLow = Math.min(...c.slice(-20).map((x) => x.low));
  // Balanced risk for WR: SL ~1.6–2.0%, TP1 ~2.2–2.8%
  let sl = Math.min(entry - a * 1.5, recentLow - a * 0.2);
  if (entry - sl > entry * 0.02) sl = entry - entry * 0.02;
  if (entry - sl < entry * 0.008) sl = entry - entry * 0.008;
  const risk = entry - sl;
  return {
    entry,
    sl,
    tp1: entry + Math.max(risk * 1.4, entry * 0.018),
    tp2: entry + Math.max(risk * 2.8, entry * 0.04),
    tp3: entry + Math.max(risk * 5, entry * 0.08),
    target10: entry * 1.1,
  };
}

function outcome(candles, startIdx, p) {
  let maxFavor = 0;
  let hit10 = false;
  let reversedFast = false;
  for (let i = startIdx + 1; i < candles.length; i++) {
    const bar = candles[i];
    const fav = ((bar.high - p.entry) / p.entry) * 100;
    if (fav > maxFavor) maxFavor = fav;
    if (bar.high >= p.target10) hit10 = true;
    if (i - startIdx <= 3 && bar.low <= p.sl) reversedFast = true;
    if (bar.low <= p.sl) {
      return {
        hit: "SL",
        exit: p.sl,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast,
        sustained: maxFavor >= 2.5 && !reversedFast,
      };
    }
    if (bar.high >= p.tp3)
      return {
        hit: "TP3",
        exit: p.tp3,
        maxFavor: +maxFavor.toFixed(2),
        hit10: true,
        reversedFast: false,
        sustained: true,
      };
    if (bar.high >= p.tp2)
      return {
        hit: "TP2",
        exit: p.tp2,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast: false,
        sustained: true,
      };
    if (bar.high >= p.tp1)
      return {
        hit: "TP1",
        exit: p.tp1,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast: false,
        sustained: maxFavor >= 1.5,
      };
  }
  const last = candles.at(-1).close;
  return {
    hit: "OPEN",
    exit: last,
    maxFavor: +maxFavor.toFixed(2),
    hit10,
    reversedFast,
    sustained: maxFavor >= 2.5,
  };
}

const STRATS = {
  candles: pillarCandles,
  indicators: pillarIndicators,
  peaks: pillarPeaks,
  breakout: pillarBreakout,
};

const cache = new Map();
async function getCandles(symbol, interval) {
  const key = `${symbol}:${interval}`;
  if (cache.has(key)) return cache.get(key);
  const c = await fetchKlines(symbol, interval, 1000);
  cache.set(key, c);
  return c;
}

async function scan(symbol, interval, key, need) {
  const candles = await getCandles(symbol, interval);
  const trades = [];
  let last = -40;
  const fn = STRATS[key];
  for (let i = 160; i < candles.length - 24; i++) {
    if (i - last < 12) continue;
    const slice = candles.slice(0, i + 1);
    const vote = fn(slice);
    if (!vote.pass) continue;
    const p = plan(slice);
    const o = outcome(candles, i, p);
    const pnl = ((o.exit - p.entry) / p.entry) * 100;
    const x = ctx(slice);
    trades.push({
      symbol,
      interval,
      strategy: key,
      hit: o.hit,
      pnl: +pnl.toFixed(3),
      maxFavor: o.maxFavor,
      hit10: o.hit10,
      reversedFast: o.reversedFast,
      sustained: o.sustained,
      dist: +x.dist.toFixed(2),
      vol: +x.volRatio.toFixed(2),
      q:
        (x.dist >= 0.8 && x.dist <= 2.2 ? 20 : 0) +
        (x.volRatio >= 1.3 && x.volRatio <= 2.1 ? 18 : 0) +
        (interval === "1h" ? 12 : 0) +
        (x.green2 ? 8 : 0) +
        (x.higherLows ? 8 : 0) +
        (vote.score || 0) * 0.05,
    });
    last = i;
    if (trades.length >= need) break;
  }
  return trades;
}

function summarize(trades) {
  const n = trades.length;
  if (!n)
    return {
      n: 0,
      wins: 0,
      winRate: 0,
      avgPnl: 0,
      sustainedRate: 0,
      reversedFastRate: 0,
      path3: 0,
      hit10: 0,
      pass: false,
    };
  const wins = trades.filter((t) => t.hit.startsWith("TP")).length;
  const sustained = trades.filter((t) => t.sustained).length;
  const reversedFast = trades.filter((t) => t.reversedFast).length;
  const winRate = +((wins / n) * 100).toFixed(1);
  const avgPnl = +(trades.reduce((a, t) => a + t.pnl, 0) / n).toFixed(3);
  return {
    n,
    wins,
    losses: trades.filter((t) => t.hit === "SL").length,
    winRate,
    avgPnl,
    sustainedRate: +((sustained / n) * 100).toFixed(1),
    reversedFastRate: +((reversedFast / n) * 100).toFixed(1),
    path3: trades.filter((t) => t.maxFavor >= 3).length,
    hit10: trades.filter((t) => t.hit10).length,
    pass: winRate >= TARGET && n >= 10 && avgPnl > 0,
    aimPass: winRate >= AIM && n >= 10 && avgPnl > 0,
  };
}

async function runRound(picked, round) {
  cache.clear();
  const by = { candles: [], indicators: [], peaks: [], breakout: [] };
  for (const symbol of picked) {
    process.stderr.write(`${symbol} `);
    for (const interval of ["15m", "1h"]) {
      for (const key of Object.keys(by)) {
        try {
          const t = await scan(symbol, interval, key, 3);
          by[key].push(...t);
        } catch {
          /* skip */
        }
      }
    }
  }
  process.stderr.write("\n");
  const summary = {};
  for (const key of Object.keys(by)) {
    const all = by[key].sort((a, b) => b.q - a.q);
    // Prefer 1h + sweet-spot; take top 20
    const sample = all.slice(0, 20);
    summary[key] = { ...summarize(sample), pool: all.length, L };
  }
  return summary;
}

const seed = Number(process.env.SEED) || (Date.now() % 1e9);
const rng = mulberry32(seed);
console.error(`Universe… seed=${seed} TARGET=${TARGET}% AIM=${AIM}%`);
const universe = await fetchUsdtSymbols();
const picked = shuffle(universe, rng).slice(0, 40);
console.error(`Random 40: ${picked.join(", ")}`);

const history = [];
let best = null;

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.error(`\n===== ROUND ${round} L=${L} =====`);
  const summary = await runRound(picked, round);
  history.push({ round, L, summary });
  const rates = Object.fromEntries(
    Object.entries(summary).map(([k, s]) => [k, s.winRate]),
  );
  console.log(JSON.stringify({ round, L, rates, detail: summary }, null, 2));

  const allPass = Object.values(summary).every((s) => s.pass);
  const allAim = Object.values(summary).every((s) => s.aimPass);
  const score =
    Object.values(summary).reduce((a, s) => a + s.winRate, 0) / 4;
  if (!best || score > best.score) best = { round, L, score, summary };

  if (allAim) {
    console.error("ALL STRATEGIES >= AIM");
    writeFileSync(
      join(__dirname, "iterate-final.json"),
      JSON.stringify({ seed, picked, TARGET, AIM, L, history, final: summary, status: "AIM_MET" }, null, 2),
    );
    break;
  }
  if (allPass && L >= 5) {
    // Met floor; keep tightening toward AIM a bit more
    console.error("ALL >= TARGET — tightening toward AIM");
  }
  if (allPass && round >= 3 && L >= 7) {
    writeFileSync(
      join(__dirname, "iterate-final.json"),
      JSON.stringify({ seed, picked, TARGET, AIM, L, history, final: summary, status: "TARGET_MET" }, null, 2),
    );
    break;
  }

  // Adaptive: raise L if any failing; if samples too few, lower slightly for that
  const failing = Object.entries(summary).filter(([, s]) => !s.pass);
  const starved = Object.entries(summary).filter(([, s]) => s.n < 10 || s.pool < 12);
  if (starved.length && L > 1) {
    L = Math.max(1, L - 1);
    console.error(`Starved samples → L=${L}`);
  } else if (failing.length) {
    L = Math.min(8, L + 1);
    console.error(`Failing ${failing.map(([k]) => k).join(",")} → L=${L}`);
  } else {
    L = Math.min(8, L + 1);
    console.error(`All pass floor — push AIM L=${L}`);
  }

  if (round === MAX_ROUNDS) {
    writeFileSync(
      join(__dirname, "iterate-final.json"),
      JSON.stringify(
        {
          seed,
          picked,
          TARGET,
          AIM,
          L,
          history,
          final: best?.summary || summary,
          status: allPass ? "TARGET_MET" : "MAX_ROUNDS",
          best,
        },
        null,
        2,
      ),
    );
  }
}

const final = JSON.parse(
  await import("fs").then((fs) =>
    fs.readFileSync(join(__dirname, "iterate-final.json"), "utf8"),
  ),
);
console.log(
  JSON.stringify(
    {
      status: final.status,
      L: final.L,
      seed: final.seed,
      summary: Object.fromEntries(
        Object.entries(final.final).map(([k, s]) => [
          k,
          {
            n: s.n,
            winRate: s.winRate,
            avgPnl: s.avgPnl,
            sustainedRate: s.sustainedRate,
            pass: s.pass,
            aimPass: s.aimPass,
            pool: s.pool,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
