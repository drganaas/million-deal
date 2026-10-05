/**
 * Validate ~20 trades with the 4 strategy pillars + measure sustained rise.
 * Run: node scripts/validate-trades.mjs
 */
const BINANCE = "https://data-api.binance.vision";

async function fetchKlines(symbol, interval = "15m", limit = 1000) {
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
  const line = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(line, 9);
  return line.map((v, i) => v - signal[i]);
}

function swingHighs(candles, look = 3) {
  const out = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].high;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].high >= v || candles[i + j].high > v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ i, price: v });
  }
  return out;
}

function swingLows(candles, look = 3) {
  const out = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].low;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].low <= v || candles[i + j].low < v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ i, price: v });
  }
  return out;
}

function pillarCandles(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);
  const body = Math.abs(cur.close - cur.open);
  const range = Math.max(cur.high - cur.low, 1e-12);
  const lower = Math.min(cur.open, cur.close) - cur.low;
  const bull = cur.close > cur.open;
  const hammer = bull && lower >= body * 2 && lower / range >= 0.5;
  const engulf =
    bull &&
    prev.close < prev.open &&
    cur.close >= prev.open &&
    cur.open <= prev.close &&
    body > Math.abs(prev.close - prev.open);
  const strong = bull && body / range > 0.65;
  const pin = bull && lower >= range * 0.55;
  let score = 0;
  if (hammer) score += 28;
  if (engulf) score += 30;
  if (pin) score += 18;
  if (strong) score += 16;
  if (bull && cur.close > prev.high) score += 10;
  return { pass: score >= 28 || [hammer, engulf, pin, strong].filter(Boolean).length >= 2, score };
}

function pillarIndicators(c) {
  const closes = c.map((x) => x.close);
  const vols = c.map((x) => x.volume);
  const last = c.at(-1);
  const r = lastFinite(rsi(closes));
  const hist = macdHist(closes);
  const h0 = hist.at(-1);
  const h1 = hist.at(-2);
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = vols.at(-1) / volAvg;
  let score = 0;
  if (r >= 40 && r <= 62) score += 20;
  else if (r > 68) score -= 18;
  if (h0 > 0 && h0 >= h1) score += 22;
  if (e20 >= e50 && last.close >= e20) score += 18;
  if (volRatio >= 1.15) score += 20;
  else if (volRatio < 1.05) score -= 10;
  const momentumOk = h0 > 0 && h0 >= h1;
  const liquidityOk = volRatio >= 1.15;
  return {
    pass: score >= 42 && momentumOk && liquidityOk && r <= 67,
    score,
    r,
    volRatio,
    h0,
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
  const stillAtZero = dist >= 0 && dist <= 0.45;
  const earlyBounce = dist > 0.45 && dist <= 3.5;
  const volAvg = lastFinite(sma(vols.slice(0, -1), 20)) || 1;
  let score = 0;
  if (stillAtZero) score += 3;
  else if (earlyBounce) score += 2;
  else if (dist > 5) score -= 2;
  if (last.close > last.open && (stillAtZero || earlyBounce)) score += 1;
  if (last.close > prev.close && last.close > last.open && (stillAtZero || earlyBounce)) score += 1;
  if (last.volume / volAvg >= 1.2 && (stillAtZero || earlyBounce)) score += 1;
  const r = lastFinite(rsi(closes));
  if (r >= 30 && r <= 60 && (stillAtZero || earlyBounce)) score += 1;
  const highs = swingHighs(c, 3);
  const swLows = swingLows(c, 3);
  let hhhl = false;
  let lhll = false;
  if (highs.length >= 2 && swLows.length >= 2) {
    hhhl =
      highs.at(-1).price > highs.at(-2).price && swLows.at(-1).price > swLows.at(-2).price;
    lhll =
      highs.at(-1).price < highs.at(-2).price && swLows.at(-1).price < swLows.at(-2).price;
  }
  if (hhhl && earlyBounce) score += 2;
  const status =
    stillAtZero && score >= 5
      ? "confirmed"
      : earlyBounce && score >= 5 && !lhll
        ? "confirmed"
        : (stillAtZero || earlyBounce) && score >= 3
          ? "potential"
          : "none";
  let s = score * 8;
  if (status === "confirmed") s += 30;
  else if (status === "potential") s += 16;
  if (hhhl) s += 22;
  if (dist <= 3.5) s += 12;
  if (lhll) s -= 20;
  const pass =
    (status === "confirmed" || status === "potential" || s >= 40) && !lhll && dist <= 4.5;
  return { pass, score: Math.min(100, Math.max(0, s)), status, dist, hhhl };
}

function pillarBreakout(c) {
  const last = c.at(-1);
  const highs = swingHighs(c, 3);
  const lows = swingLows(c, 3);
  const lastHigh = highs.length ? highs.at(-1).price : Math.max(...c.slice(-20).map((x) => x.high));
  const lastLow = lows.length ? lows.at(-1).price : Math.min(...c.slice(-20).map((x) => x.low));
  const lookbackHigh = Math.max(...c.slice(-21, -1).map((x) => x.high));
  const peakBreak = last.close > lastHigh && last.close > last.open;
  const mss = last.close > lookbackHigh && last.close > last.open;
  const supportBreak = last.close < lastLow && last.close < last.open;
  const reclaim =
    c.length >= 3 &&
    c.at(-2).low <= lastLow * 1.001 &&
    last.close >= lastLow &&
    last.close > last.open;
  const recentLow = Math.min(...c.slice(-40).map((x) => x.low));
  const recentHigh = Math.max(...c.slice(-40).map((x) => x.high));
  const distFromLow = ((last.close - recentLow) / recentLow) * 100;
  const roomToHigh = ((recentHigh - last.close) / last.close) * 100;
  const lateTop = distFromLow > 3.5 || roomToHigh < 1.2;
  let score = 0;
  if (reclaim) score += 36;
  if ((peakBreak || mss) && !lateTop) score += 28;
  else if (peakBreak || mss) score -= 15;
  if (last.close > lastHigh && last.close > last.open && !lateTop) score += 14;
  if (supportBreak && !reclaim) score -= 25;
  if (last.close > c.at(-2).high && last.close > last.open && !lateTop) score += 10;
  return {
    pass: score >= 28 && !supportBreak && !lateTop,
    score: Math.min(100, Math.max(0, score)),
    peakBreak: (peakBreak || mss) && !lateTop,
  };
}

/** Extended-rise quality gate: early + trend + momentum + liquidity + capacity */
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
    slice8.filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >= 4;
  const risingCloses =
    c.slice(-6).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >= 3;
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
  const passCount = [...core, ...support].filter(Boolean).length;
  return {
    pass: core.every(Boolean) && support.filter(Boolean).length >= 1,
    passCount,
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
        hit10: hit10 || ((p.tp3 - p.entry) / p.entry) * 100 >= 10,
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

function evaluateAt(c) {
  const candles = pillarCandles(c);
  const indicators = pillarIndicators(c);
  const peaks = pillarPeaksZero(c);
  const breakout = pillarBreakout(c);
  const pillars = { candles, indicators, peaks, breakout };
  const agree = [candles, indicators, peaks, breakout].filter((p) => p.pass).length;
  const gate = extendedRiseGate(c);
  // contradictions
  const contradictions = [];
  if (breakout.pass && peaks.status === "none" && peaks.dist > 3.5) {
    contradictions.push("breakout_far_from_bottom");
  }
  if (indicators.r > 66 && candles.pass) contradictions.push("overbought_candle_conflict");
  if (peaks.pass && breakout.peakBreak && peaks.dist > 3.5) {
    contradictions.push("zero_vs_late_breakout");
  }
  if (breakout.pass && !indicators.pass) contradictions.push("breakout_without_momentum");
  return { pillars, agree, gate, contradictions };
}

async function validateSymbol(symbol, need, interval = "15m") {
  const candles = await fetchKlines(symbol, interval, 1000);
  const trades = [];
  let lastSignal = -20;
  for (let i = 120; i < candles.length - 16; i++) {
    if (i - lastSignal < 6) continue;
    const slice = candles.slice(0, i + 1);
    const ev = evaluateAt(slice);
    if (ev.agree < 2) continue;
    if (!ev.gate.pass) continue;
    // Momentum + liquidity always required
    if (!ev.pillars.indicators.pass) continue;
    if (!ev.pillars.peaks.pass && !ev.pillars.candles.pass && !ev.pillars.breakout.pass)
      continue;
    if (ev.pillars.breakout.pass && ev.gate.distFromLow > 3.5) continue;
    if (ev.agree < 3 && !ev.pillars.peaks.pass) continue;
    if (ev.contradictions.length) continue;
    const p = plan(slice);
    const o = outcome(candles, i, p);
    const pnl = ((o.exit - p.entry) / p.entry) * 100;
    trades.push({
      symbol,
      interval,
      time: new Date(candles[i].time * 1000).toISOString(),
      agree: ev.agree,
      pillars: {
        candles: ev.pillars.candles.pass,
        indicators: ev.pillars.indicators.pass,
        peaks: ev.pillars.peaks.pass,
        breakout: ev.pillars.breakout.pass,
      },
      gate: ev.gate,
      contradictions: ev.contradictions,
      entry: +p.entry.toFixed(6),
      sl: +p.sl.toFixed(6),
      tp1: +p.tp1.toFixed(6),
      tp2: +p.tp2.toFixed(6),
      tp3: +p.tp3.toFixed(6),
      hit: o.hit,
      pnl: +pnl.toFixed(3),
      bars: o.bars,
      maxFavor: o.maxFavor,
      hit10: o.hit10,
      reversedFast: o.reversedFast,
      sustained: o.sustained,
    });
    lastSignal = i;
    if (trades.length >= need) break;
  }
  return trades;
}

const symbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
  "NEARUSDT",
  "APTUSDT",
  "ARBUSDT",
  "SUIUSDT",
  "INJUSDT",
  "OPUSDT",
  "ATOMUSDT",
  "FILUSDT",
  "LTCUSDT",
  "AAVEUSDT",
  "UNIUSDT",
  "RENDERUSDT",
  "FETUSDT",
  "TIAUSDT",
  "SEIUSDT",
  "WLDUSDT",
  "PEPEUSDT",
  "WIFUSDT",
  "BONKUSDT",
  "ORDIUSDT",
];
const all = [];
for (const s of symbols) {
  try {
    const t15 = await validateSymbol(s, 3, "15m");
    all.push(...t15);
    const t1h = await validateSymbol(s, 3, "1h");
    all.push(...t1h);
  } catch (e) {
    console.error(s, e.message);
  }
}

function quality(t) {
  let q = t.agree * 12 + t.gate.passCount * 4;
  if (t.pillars.peaks) q += 15;
  if (t.pillars.indicators) q += 12;
  if (t.pillars.candles) q += 6;
  if (t.pillars.breakout) q += 4;
  if (t.gate.volRatio >= 1.4) q += 8;
  if (t.gate.distFromLow >= 0.5 && t.gate.distFromLow <= 3.0) q += 10;
  if (t.gate.roomToHigh >= 1.5) q += 6;
  if (t.interval === "1h") q += 5;
  if (t.contradictions.length) q -= 30;
  return q;
}

all.sort((a, b) => quality(b) - quality(a));
// Prefer 1h for extended-rise path, fill remainder with best 15m
const hourly = all.filter((t) => t.interval === "1h");
const m15 = all.filter((t) => t.interval === "15m");
const sample = [...hourly.slice(0, 14), ...m15.slice(0, 6)].slice(0, 20);
if (sample.length < 20) {
  for (const t of all) {
    if (sample.length >= 20) break;
    if (!sample.includes(t)) sample.push(t);
  }
}
const wins = sample.filter((t) => t.hit.startsWith("TP")).length;
const losses = sample.filter((t) => t.hit === "SL").length;
const sustained = sample.filter((t) => t.sustained).length;
const hit10 = sample.filter((t) => t.hit10).length;
const fastFail = sample.filter((t) => t.reversedFast).length;
const conflicts = sample.filter((t) => t.contradictions.length).length;
const path5 = sample.filter((t) => t.maxFavor >= 5).length;
const path3 = sample.filter((t) => t.maxFavor >= 3).length;

const report = {
  testedSignals: sample.length,
  wins,
  losses,
  open: sample.filter((t) => t.hit === "OPEN").length,
  sustained,
  hit10PctMove: hit10,
  pathToward5pct: path5,
  pathToward3pct: path3,
  reversedFast: fastFail,
  withContradictions: conflicts,
  winRate: sample.length ? +((wins / sample.length) * 100).toFixed(1) : 0,
  avgPnl: sample.length
    ? +(sample.reduce((a, t) => a + t.pnl, 0) / sample.length).toFixed(3)
    : 0,
  avgMaxFavor: sample.length
    ? +(sample.reduce((a, t) => a + t.maxFavor, 0) / sample.length).toFixed(2)
    : 0,
  trades: sample,
  poolFound: all.length,
};

const { writeFileSync } = await import("fs");
writeFileSync(
  new URL("./last-validate.json", import.meta.url),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(
  JSON.stringify(
    {
      testedSignals: report.testedSignals,
      wins: report.wins,
      losses: report.losses,
      winRate: report.winRate,
      sustained: report.sustained,
      hit10PctMove: report.hit10PctMove,
      pathToward5pct: report.pathToward5pct,
      pathToward3pct: report.pathToward3pct,
      reversedFast: report.reversedFast,
      withContradictions: report.withContradictions,
      avgPnl: report.avgPnl,
      avgMaxFavor: report.avgMaxFavor,
      poolFound: report.poolFound,
      peaksPass: sample.filter((t) => t.pillars.peaks).length,
      indicatorsPass: sample.filter((t) => t.pillars.indicators).length,
    },
    null,
    2,
  ),
);
