/**
 * Per-strategy random validation on 40 coins.
 * Run: node scripts/validate-strategies-random.mjs
 *
 * Tests each pillar alone (with extended-rise gate) + combined mode.
 * Pass lock rule: winRate >= 50% AND avgPnl > 0 AND reversedFastRate <= 20%
 *          OR: winRate >= 45% AND sustainedRate >= 40% AND avgPnl > 0
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINANCE = "https://data-api.binance.vision";

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
    "AEURUSDT",
  ]);
  // Exclude leveraged tokens, stock wrappers (*B), fiat, ultra-micro noise
  return data.symbols
    .filter((s) => {
      const sym = s.symbol;
      if (s.status !== "TRADING" || s.quoteAsset !== "USDT") return false;
      if (s.isSpotTradingAllowed === false) return false;
      if (skipExact.has(sym)) return false;
      if (/UPUSDT$|DOWNUSDT$|BEAR|BULL/.test(sym)) return false;
      // Binance stock token wrappers end with BUSDT (e.g. HOODBUSDT, TQQQBUSDT)
      if (/BUSDT$/.test(sym) && sym !== "BNBUSDT") return false;
      // Stable-like / pegged
      if (/^(USD|EUR|GBP|TRY|BRL|FDUSD)/.test(sym)) return false;
      // Base asset too short / weird
      const base = s.baseAsset || sym.replace(/USDT$/, "");
      if (base.length < 2 || base.length > 12) return false;
      return true;
    })
    .map((s) => s.symbol);
}

async function fetchKlines(symbol, interval = "15m", limit = 1000) {
  const res = await fetch(
    `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`klines ${res.status}`);
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
  const macdLine = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(
    macdLine.map((v) => (Number.isFinite(v) ? v : 0)),
    9,
  );
  return macdLine.map((v, i) => v - signal[i]);
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

/* ---- Strategy pillars (v3 — fixed after random-40 failure analysis) ---- */

function pillarCandles(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const body = Math.abs(cur.close - cur.open);
  const range = Math.max(cur.high - cur.low, 1e-12);
  const lower = Math.min(cur.open, cur.close) - cur.low;
  const upper = cur.high - Math.max(cur.open, cur.close);
  const bull = cur.close > cur.open;
  const hammer = bull && lower >= body * 1.8 && upper <= body * 0.55 && lower / range >= 0.45;
  const engulf =
    bull &&
    prev.close < prev.open &&
    cur.close >= prev.open &&
    cur.open <= prev.close &&
    body > Math.abs(prev.close - prev.open) * 0.95;
  const pin = lower >= range * 0.55 && upper <= range * 0.22 && bull;
  const strong = bull && body / range >= 0.65 && cur.close > prev.high;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const recentLow = Math.min(...c.slice(-48).map((x) => x.low));
  const dist = ((cur.close - recentLow) / recentLow) * 100;

  let score = 0;
  if (hammer) score += 28;
  if (engulf) score += 32;
  if (pin) score += 18;
  if (strong) score += 16;
  if (bull && cur.close > prev.high) score += 10;
  // Companion: volume + early rise (reject late pattern pumps)
  if (volRatio >= 1.2 && volRatio <= 2.8) score += 14;
  else if (volRatio < 1.05) score -= 12;
  if (dist >= 0.3 && dist <= 3.2) score += 12;
  else if (dist > 4) score -= 18;
  if (h0 > 0) score += 8;
  if (!bull && upper > body * 1.4) score -= 20;

  const patternOk = hammer || engulf || pin || strong;
  return {
    pass: patternOk && score >= 48 && volRatio >= 1.15 && dist <= 3.5 && h0 > 0,
    score,
    id: "candles",
  };
}

function pillarIndicators(c) {
  // Confirm pillar (solo WR weak) — pairs with locked candles in combined
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const last = c.at(-1);
  const prev = c.at(-2);
  const r = lastFinite(rsi(closes));
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const h1 = hist.at(-2);
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  const recentLow = Math.min(...c.slice(-48).map((x) => x.low));
  const dist = ((last.close - recentLow) / recentLow) * 100;
  const rising =
    c.slice(-5).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >= 3;
  const higherLows =
    c.slice(-8).filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >=
    4;
  const green = last.close > last.open && last.close >= prev.close;

  let score = 0;
  if (r >= 42 && r <= 58) score += 24;
  else if (r > 62) score -= 24;
  if (h0 > 0 && h0 >= h1) score += 24;
  if (e20 >= e50 && last.close >= e20 * 1.001) score += 18;
  if (volRatio >= 1.25 && volRatio <= 2.4) score += 22;
  else if (volRatio < 1.15) score -= 14;
  else if (volRatio > 2.8) score -= 18;
  if (rising && higherLows) score += 18;
  else if (rising || higherLows) score += 10;
  if (dist >= 0.5 && dist <= 2.6) score += 14;
  else if (dist > 3.2) score -= 20;
  if (green) score += 10;

  const pass =
    score >= 62 &&
    h0 > 0 &&
    h0 >= h1 &&
    volRatio >= 1.25 &&
    volRatio <= 2.5 &&
    (rising || higherLows) &&
    dist <= 2.8 &&
    dist >= 0.4 &&
    r <= 60 &&
    green &&
    last.close >= e20;
  return { pass, score, r, volRatio, id: "indicators", soloEntry: false };
}

function pillarBreakout(c) {
  // Confirm only — reclaim supports locked pillars, never solo entry
  const last = c.at(-1);
  const prev = c.at(-2);
  const vols = c.map((x) => x.volume);
  const closes = c.map((x) => x.close);
  const lows = swingLows(c, 3);
  const lastLow = lows.length
    ? lows.at(-1).price
    : Math.min(...c.slice(-20).map((x) => x.low));
  const supportBreak = last.close < lastLow && last.close < last.open;
  const reclaim =
    c.length >= 3 &&
    c.at(-2).low <= lastLow * 1.001 &&
    last.close >= lastLow &&
    last.close > last.open &&
    last.close > prev.close;
  const recentLow = Math.min(...c.slice(-40).map((x) => x.low));
  const recentHigh = Math.max(...c.slice(-40).map((x) => x.high));
  const distFromLow = ((last.close - recentLow) / recentLow) * 100;
  const roomToHigh = ((recentHigh - last.close) / last.close) * 100;
  const lateTop = distFromLow > 2.8 || roomToHigh < 1.0;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const rising =
    c.slice(-4).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >= 2;

  let score = 0;
  if (reclaim && distFromLow <= 2.5) score += 45;
  else if (reclaim) score += 20;
  if (supportBreak) score -= 35;
  if (volRatio >= 1.25 && volRatio <= 2.4) score += 16;
  else if (volRatio > 2.8) score -= 14;
  if (h0 > 0) score += 12;
  if (rising) score += 10;
  if (distFromLow >= 0.3 && distFromLow <= 2.5) score += 12;
  if (last.close > last.open) score += 8;

  const pass =
    reclaim &&
    !supportBreak &&
    !lateTop &&
    h0 > 0 &&
    volRatio >= 1.2 &&
    volRatio <= 2.5 &&
    distFromLow <= 2.6 &&
    rising &&
    score >= 55;
  return {
    pass,
    score: Math.min(100, Math.max(0, score)),
    peakBreak: false,
    reclaim,
    id: "breakout",
    soloEntry: false,
  };
}

function pillarPeaksZero(c) {
  const closes = c.map((x) => x.close);
  const lows = c.map((x) => x.low);
  const vols = c.map((x) => x.volume);
  const last = c.at(-1);
  const prev = c.at(-2);
  const window = lows.slice(0, -2);
  const swingLow = Math.min(...window);
  const dist = ((last.close - swingLow) / swingLow) * 100;
  const stillAtZero = dist >= 0 && dist <= 0.5;
  const earlyBounce = dist > 0.5 && dist <= 2.8;
  const volAvg = lastFinite(sma(vols.slice(0, -1), 20)) || 1;
  const volSurge = last.volume / volAvg;
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  let score = 0;
  if (stillAtZero) score += 3;
  else if (earlyBounce) score += 2;
  else if (dist > 3.5) score -= 3;
  if (last.close > last.open && (stillAtZero || earlyBounce)) score += 1;
  if (last.close > prev.close && last.close > last.open && (stillAtZero || earlyBounce))
    score += 1;
  if (volSurge >= 1.2 && volSurge <= 2.5 && (stillAtZero || earlyBounce)) score += 1;
  const r = lastFinite(rsi(closes));
  if (r >= 32 && r <= 56 && (stillAtZero || earlyBounce)) score += 1;
  if (h0 > 0 && (stillAtZero || earlyBounce)) score += 1;
  const highs = swingHighs(c, 3);
  const swLows = swingLows(c, 3);
  let hhhl = false;
  let lhll = false;
  let higherLow = false;
  if (highs.length >= 2 && swLows.length >= 2) {
    hhhl =
      highs.at(-1).price > highs.at(-2).price &&
      swLows.at(-1).price > swLows.at(-2).price;
    lhll =
      highs.at(-1).price < highs.at(-2).price &&
      swLows.at(-1).price < swLows.at(-2).price;
    higherLow = swLows.at(-1).price > swLows.at(-2).price;
  }
  if (hhhl && (stillAtZero || earlyBounce)) score += 2;
  else if (higherLow && earlyBounce) score += 1;
  const status =
    stillAtZero && score >= 5
      ? "confirmed"
      : earlyBounce && score >= 6 && (hhhl || higherLow)
        ? "confirmed"
        : (stillAtZero || earlyBounce) && score >= 4
          ? "potential"
          : "none";
  let s = score * 8;
  if (status === "confirmed") s += 30;
  else if (status === "potential") s += 12;
  if (hhhl) s += 24;
  else if (higherLow) s += 14;
  if (dist <= 2.8) s += 12;
  if (volSurge >= 1.2 && volSurge <= 2.5) s += 10;
  if (h0 > 0) s += 8;
  if (lhll) s -= 25;
  const pass =
    status === "confirmed" &&
    !lhll &&
    dist <= 3.0 &&
    volSurge >= 1.2 &&
    volSurge <= 2.6 &&
    h0 > 0 &&
    last.close > last.open;
  return { pass, score: Math.min(100, Math.max(0, s)), status, dist, hhhl, id: "peaks" };
}

function extendedRiseGate(c) {
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const last = c.at(-1);
  const recent = c.slice(-64);
  const recentLow = Math.min(...recent.map((x) => x.low));
  const recentHigh = Math.max(...recent.map((x) => x.high));
  const distFromLow = ((last.close - recentLow) / recentLow) * 100;
  const roomToHigh = ((recentHigh - last.close) / last.close) * 100;
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const r = lastFinite(rsi(closes));
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const h1 = hist.at(-2);
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  const a = lastFinite(atr(c)) || last.close * 0.01;
  const atrPct = (a / last.close) * 100;
  const slice8 = c.slice(-8);
  const higherLows =
    slice8.filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >=
    4;
  const risingCloses =
    c.slice(-6).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >=
    3;
  const greenDom = c.slice(-5).filter((x) => x.close > x.open).length >= 3;
  const lateSpike =
    distFromLow > 4.5 && roomToHigh < 0.6 && last.close >= recentHigh * 0.997;
  const volClimax = volRatio > 3.2;
  const checks = {
    earlyRise: distFromLow >= 0.2 && distFromLow <= 4.5,
    trendUp: e20 >= e50 * 0.995 && last.close >= e20 * 0.995,
    momentum: (h0 > 0 && h0 >= h1) || (h0 > 0 && r >= 40 && r <= 64),
    liquidityVol: volRatio >= 1.15 && !volClimax,
    structure: higherLows || risingCloses || greenDom,
    notExhausted:
      r < 67 &&
      roomToHigh >= 0.6 &&
      (roomToHigh >= 1.0 || (distFromLow <= 2.8 && volRatio >= 1.3)),
    extensionCapacity: atrPct * 12 >= 5 || atrPct >= 0.42,
    notLateBreakout: !lateSpike,
  };
  const core = [
    checks.earlyRise,
    checks.trendUp,
    checks.momentum,
    checks.liquidityVol,
    checks.structure,
    checks.notLateBreakout,
  ];
  const support = [checks.notExhausted, checks.extensionCapacity];
  return {
    pass: core.every(Boolean) && support.filter(Boolean).length >= 1,
    checks,
    distFromLow: +distFromLow.toFixed(2),
    roomToHigh: +roomToHigh.toFixed(2),
    atrPct: +atrPct.toFixed(3),
    volRatio: +volRatio.toFixed(2),
  };
}

function plan(c) {
  const entry = c.at(-1).close;
  const a = lastFinite(atr(c)) || entry * 0.01;
  const recentLow = Math.min(...c.slice(-20).map((x) => x.low));
  let sl = Math.min(entry - a * 1.6, recentLow - a * 0.25);
  if (entry - sl > entry * 0.022) sl = entry - entry * 0.022;
  if (entry - sl < entry * 0.006) sl = entry - entry * 0.006;
  const risk = entry - sl;
  return {
    entry,
    sl,
    tp1: entry + Math.max(risk * 2.0, entry * 0.025),
    tp2: entry + Math.max(risk * 3.8, entry * 0.055),
    tp3: entry + Math.max(risk * 6.5, entry * 0.1),
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
    if (i - startIdx <= 4 && bar.low <= p.sl) reversedFast = true;
    if (bar.low <= p.sl) {
      return {
        hit: "SL",
        exit: p.sl,
        bars: i - startIdx,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast,
        sustained: maxFavor >= 3 && !reversedFast,
      };
    }
    if (bar.high >= p.tp3) {
      return {
        hit: "TP3",
        exit: p.tp3,
        bars: i - startIdx,
        maxFavor: +maxFavor.toFixed(2),
        hit10: true,
        reversedFast: false,
        sustained: true,
      };
    }
    if (bar.high >= p.tp2) {
      return {
        hit: "TP2",
        exit: p.tp2,
        bars: i - startIdx,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast: false,
        sustained: maxFavor >= 2.5,
      };
    }
    if (bar.high >= p.tp1) {
      return {
        hit: "TP1",
        exit: p.tp1,
        bars: i - startIdx,
        maxFavor: +maxFavor.toFixed(2),
        hit10,
        reversedFast: false,
        sustained: maxFavor >= 1.5,
      };
    }
  }
  const last = candles.at(-1).close;
  return {
    hit: "OPEN",
    exit: last,
    bars: candles.length - 1 - startIdx,
    maxFavor: +maxFavor.toFixed(2),
    hit10,
    reversedFast,
    sustained: maxFavor >= 3 && !reversedFast,
  };
}

const STRATEGIES = {
  candles: pillarCandles,
  indicators: pillarIndicators,
  peaks: pillarPeaksZero,
  breakout: pillarBreakout,
};

function summarize(trades) {
  const n = trades.length;
  if (!n) {
    return {
      n: 0,
      wins: 0,
      losses: 0,
      open: 0,
      winRate: 0,
      avgPnl: 0,
      avgMaxFavor: 0,
      sustained: 0,
      sustainedRate: 0,
      hit10: 0,
      path3: 0,
      path5: 0,
      reversedFast: 0,
      reversedFastRate: 0,
      lock: false,
      lockReason: "no_trades",
    };
  }
  const wins = trades.filter((t) => t.hit.startsWith("TP")).length;
  const losses = trades.filter((t) => t.hit === "SL").length;
  const open = trades.filter((t) => t.hit === "OPEN").length;
  const sustained = trades.filter((t) => t.sustained).length;
  const hit10 = trades.filter((t) => t.hit10).length;
  const path3 = trades.filter((t) => t.maxFavor >= 3).length;
  const path5 = trades.filter((t) => t.maxFavor >= 5).length;
  const reversedFast = trades.filter((t) => t.reversedFast).length;
  const winRate = +((wins / n) * 100).toFixed(1);
  const avgPnl = +(trades.reduce((a, t) => a + t.pnl, 0) / n).toFixed(3);
  const avgMaxFavor = +(trades.reduce((a, t) => a + t.maxFavor, 0) / n).toFixed(2);
  const sustainedRate = +((sustained / n) * 100).toFixed(1);
  const reversedFastRate = +((reversedFast / n) * 100).toFixed(1);
  const lockA = winRate >= 50 && avgPnl > 0 && reversedFastRate <= 20 && n >= 8;
  const lockB =
    winRate >= 45 && sustainedRate >= 40 && avgPnl > 0 && reversedFastRate <= 25 && n >= 8;
  const lock = lockA || lockB;
  return {
    n,
    wins,
    losses,
    open,
    winRate,
    avgPnl,
    avgMaxFavor,
    sustained,
    sustainedRate,
    hit10,
    path3,
    path5,
    reversedFast,
    reversedFastRate,
    lock,
    lockReason: lock
      ? lockA
        ? "wr>=50_pnl+_fast<=20"
        : "wr>=45_sustained>=40_pnl+"
      : n < 8
        ? "insufficient_samples"
        : winRate < 45
          ? "winRate_low"
          : avgPnl <= 0
            ? "avgPnl_non_positive"
            : reversedFastRate > 25
              ? "too_many_fast_reversals"
              : "sustained_low",
  };
}

const klineCache = new Map();
async function getCandles(symbol, interval) {
  const key = `${symbol}:${interval}`;
  if (klineCache.has(key)) return klineCache.get(key);
  const candles = await fetchKlines(symbol, interval, 1000);
  klineCache.set(key, candles);
  return candles;
}

async function scanSymbol(symbol, interval, strategyKey, need) {
  const candles = await getCandles(symbol, interval);
  const trades = [];
  let lastSignal = -30;
  const fn = STRATEGIES[strategyKey];
  for (let i = 140; i < candles.length - 20; i++) {
    if (i - lastSignal < 10) continue;
    const slice = candles.slice(0, i + 1);
    const gate = extendedRiseGate(slice);
    if (!gate.pass) continue;
    const vote = fn(slice);
    if (!vote.pass) continue;
    const p = plan(slice);
    const o = outcome(candles, i, p);
    const pnl = ((o.exit - p.entry) / p.entry) * 100;
    trades.push({
      symbol,
      interval,
      strategy: strategyKey,
      time: new Date(candles[i].time * 1000).toISOString(),
      gate,
      score: vote.score,
      entry: +p.entry.toFixed(6),
      hit: o.hit,
      pnl: +pnl.toFixed(3),
      maxFavor: o.maxFavor,
      hit10: o.hit10,
      reversedFast: o.reversedFast,
      sustained: o.sustained,
      bars: o.bars,
    });
    lastSignal = i;
    if (trades.length >= need) break;
  }
  return trades;
}

async function scanCombined(symbol, interval, need) {
  const candles = await getCandles(symbol, interval);
  const trades = [];
  let lastSignal = -30;
  for (let i = 140; i < candles.length - 20; i++) {
    if (i - lastSignal < 10) continue;
    const slice = candles.slice(0, i + 1);
    const gate = extendedRiseGate(slice);
    if (!gate.pass) continue;
    const candlesV = pillarCandles(slice);
    const ind = pillarIndicators(slice);
    const peaks = pillarPeaksZero(slice);
    const br = pillarBreakout(slice);
    const pillars = { candles: candlesV, indicators: ind, peaks, breakout: br };
    const agree = Object.values(pillars).filter((p) => p.pass).length;
    // Combined entry = locked candles + indicators confirm (+ optional peaks/breakout)
    if (!candlesV.pass) continue;
    if (!ind.pass) continue;
    if (br.pass && gate.distFromLow > 2.6) continue;
    const p = plan(slice);
    const o = outcome(candles, i, p);
    const pnl = ((o.exit - p.entry) / p.entry) * 100;
    trades.push({
      symbol,
      interval,
      strategy: "combined",
      time: new Date(candles[i].time * 1000).toISOString(),
      gate,
      agree,
      pillars: {
        candles: candlesV.pass,
        indicators: ind.pass,
        peaks: peaks.pass,
        breakout: br.pass,
      },
      entry: +p.entry.toFixed(6),
      hit: o.hit,
      pnl: +pnl.toFixed(3),
      maxFavor: o.maxFavor,
      hit10: o.hit10,
      reversedFast: o.reversedFast,
      sustained: o.sustained,
      bars: o.bars,
    });
    lastSignal = i;
    if (trades.length >= need) break;
  }
  return trades;
}

const seed = Number(process.env.SEED) || Date.now() % 1e9;
const rng = mulberry32(seed);
console.error(`Fetching universe… seed=${seed}`);
const universe = await fetchUsdtSymbols();
const picked = shuffle(universe, rng).slice(0, 40);
console.error(`Random 40: ${picked.join(", ")}`);

const modes = ["candles", "indicators", "peaks", "breakout", "combined"];
const byMode = Object.fromEntries(modes.map((m) => [m, []]));

for (const symbol of picked) {
  process.stderr.write(`\n${symbol} `);
  for (const interval of ["15m", "1h"]) {
    for (const mode of modes) {
      try {
        const trades =
          mode === "combined"
            ? await scanCombined(symbol, interval, 2)
            : await scanSymbol(symbol, interval, mode, 2);
        byMode[mode].push(...trades);
        if (trades.length) process.stderr.write(`${mode}@${interval}:${trades.length} `);
      } catch (e) {
        process.stderr.write(`ERR(${mode}@${interval}:${e.message}) `);
      }
    }
  }
}
process.stderr.write("\n");

const report = {
  seed,
  picked,
  testedAt: new Date().toISOString(),
  strategies: {},
};

for (const mode of modes) {
  const all = byMode[mode];
  // Rank: prefer higher maxFavor potential via gate vol + early rise, then take up to 20
  all.sort((a, b) => {
    // Prefer early-rise mid-volume 1h setups (avoid climax pumps that ranked high before)
    const scoreTrade = (t) => {
      const d = t.gate?.distFromLow ?? 99;
      const v = t.gate?.volRatio ?? 0;
      const early = d >= 0.6 && d <= 2.8 ? 20 : d <= 3.5 ? 5 : -15;
      const volSweet = v >= 1.2 && v <= 2.4 ? 18 : v <= 2.8 ? 4 : -12;
      const tf = t.interval === "1h" ? 10 : 0;
      const agr = (t.agree || 0) * 6 + (t.score || 0) * 0.05;
      return early + volSweet + tf + agr;
    };
    return scoreTrade(b) - scoreTrade(a);
  });
  const sample = all.slice(0, 20);
  const summary = summarize(sample);
  report.strategies[mode] = {
    ...summary,
    poolFound: all.length,
    sampleTrades: sample.slice(0, 8).map((t) => ({
      symbol: t.symbol,
      interval: t.interval,
      hit: t.hit,
      pnl: t.pnl,
      maxFavor: t.maxFavor,
      distFromLow: t.gate?.distFromLow,
      volRatio: t.gate?.volRatio,
      sustained: t.sustained,
      reversedFast: t.reversedFast,
    })),
  };
}

const locked = Object.entries(report.strategies)
  .filter(([, s]) => s.lock)
  .map(([k]) => k);
const failed = Object.entries(report.strategies)
  .filter(([, s]) => !s.lock)
  .map(([k, s]) => ({ strategy: k, reason: s.lockReason, winRate: s.winRate, n: s.n }));

// Policy: indicators/breakout never solo-entry even if lock; they are confirm-only
report.lockedStrategies = locked;
report.failedStrategies = failed;
report.roles = {
  candles: locked.includes("candles") ? "ENTRY_LOCKED" : "FAILED",
  peaks: locked.includes("peaks") ? "ENTRY_LOCKED" : "FAILED",
  combined: locked.includes("combined") ? "ENTRY_LOCKED" : "FAILED",
  indicators: "CONFIRM_ONLY",
  breakout: "CONFIRM_ONLY",
};

const lockFile = {
  seed: report.seed,
  testedAt: report.testedAt,
  picked: report.picked,
  entryLocked: locked.filter((k) => k === "candles" || k === "peaks" || k === "combined"),
  confirmOnly: ["indicators", "breakout"],
  metrics: Object.fromEntries(
    Object.entries(report.strategies).map(([k, s]) => [
      k,
      {
        winRate: s.winRate,
        avgPnl: s.avgPnl,
        sustainedRate: s.sustainedRate,
        reversedFastRate: s.reversedFastRate,
        n: s.n,
        lock: s.lock,
      },
    ]),
  ),
  rules: {
    entryRequires: ["extendedRiseGate", "candles OR peaks"],
    confirmRequires: ["indicators"],
    reject: ["breakout_solo", "indicators_solo", "late_peak_break"],
  },
};
writeFileSync(join(__dirname, "locked-strategies.json"), JSON.stringify(lockFile, null, 2), "utf8");

writeFileSync(
  join(__dirname, "strategy-random-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      seed,
      coins: picked.length,
      entryLocked: lockFile.entryLocked,
      confirmOnly: lockFile.confirmOnly,
      failed,
      summary: Object.fromEntries(
        Object.entries(report.strategies).map(([k, s]) => [
          k,
          {
            n: s.n,
            winRate: s.winRate,
            avgPnl: s.avgPnl,
            sustainedRate: s.sustainedRate,
            reversedFastRate: s.reversedFastRate,
            path3: s.path3,
            hit10: s.hit10,
            lock: s.lock,
            reason: s.lockReason,
            pool: s.poolFound,
            role: report.roles[k],
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
