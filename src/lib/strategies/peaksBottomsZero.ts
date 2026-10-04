import { lastFinite, rsi, sma } from "../indicators";
import type { Candle, StrategyVote, ZeroReversalInfo } from "../types";

function findSwingLows(candles: Candle[], look = 3) {
  const out: { i: number; price: number }[] = [];
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

function findSwingHighs(candles: Candle[], look = 3) {
  const out: { i: number; price: number }[] = [];
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

export function analyzeZeroReversal(candles: Candle[]): ZeroReversalInfo {
  const closes = candles.map((c) => c.close);
  const lows = candles.map((c) => c.low);
  const vols = candles.map((c) => c.volume);
  const last = candles.at(-1)!;
  const prev = candles.at(-2)!;
  const window = lows.slice(0, -2);
  const swingLow = window.length ? Math.min(...window) : last.low;
  const swingLowIdx = window.lastIndexOf(swingLow);
  const barsSinceLow = window.length - 1 - swingLowIdx;
  const distToLowPct = ((last.close - swingLow) / Math.max(swingLow, 1e-12)) * 100;
  const bouncePct = ((last.close - swingLow) / Math.max(swingLow, 1e-12)) * 100;
  const lastGreen = last.close > last.open;
  const risingNow = last.close > prev.close && lastGreen;
  const higherLow = last.low > swingLow;
  const volAvg = lastFinite(sma(vols.slice(0, -1), 20)) || 1;
  const volSurge = last.volume / volAvg;
  const ma7 = lastFinite(sma(closes, 7));
  const ma20 = lastFinite(sma(closes, 20));
  const rsi14 = lastFinite(rsi(closes, 14));
  const stillAtZero = distToLowPct >= 0 && distToLowPct <= 0.35;

  let score = 0;
  if (stillAtZero) score += 3;
  else if (distToLowPct <= 1.5) score += 1;
  if (lastGreen && stillAtZero) score += 1;
  if (risingNow && stillAtZero) score += 1;
  if (prev.close > prev.open && lastGreen && stillAtZero) score += 1;
  if (higherLow && barsSinceLow <= 6 && stillAtZero) score += 1;
  if (volSurge >= 1.25 && stillAtZero) score += 1;
  if (ma7 && Math.abs(last.close - ma7) / ma7 <= 0.08 && stillAtZero) score += 1;
  if (ma7 && ma20 && ma7 >= ma20 && stillAtZero) score += 1;
  if (rsi14 >= 28 && rsi14 <= 55 && stillAtZero) score += 1;

  const swings = findSwingLows(candles, 3).slice(-3);
  let structure: ZeroReversalInfo["structure"] = "bounce";
  if (swings.length >= 2) {
    const a = swings[swings.length - 2].price;
    const b = swings[swings.length - 1].price;
    if (Math.abs(a - b) / Math.max(a, b) <= 0.012) structure = "second_bottom";
    else if (b > a) structure = "ascending_bottoms";
  }
  if (swings.length >= 3 && structure === "bounce") structure = "last_bottom";
  if ((swings.length === 1 || stillAtZero) && structure === "bounce") structure = "first_bottom";

  const highs = findSwingHighs(candles, 3);
  const lowsSw = findSwingLows(candles, 3);
  let peaksBottoms: ZeroReversalInfo["peaksBottoms"] = "mixed";
  if (highs.length >= 2 && lowsSw.length >= 2) {
    const h1 = highs.at(-2)!.price;
    const h2 = highs.at(-1)!.price;
    const l1 = lowsSw.at(-2)!.price;
    const l2 = lowsSw.at(-1)!.price;
    if (h2 > h1 && l2 > l1) peaksBottoms = "HH_HL";
    else if (h2 < h1 && l2 < l1) peaksBottoms = "LH_LL";
    else if (l2 > l1) peaksBottoms = "higher_low";
  }

  const status: ZeroReversalInfo["status"] =
    stillAtZero && score >= 5 ? "confirmed" : distToLowPct <= 1.2 && score >= 3 ? "potential" : "none";

  return {
    status,
    score,
    swingLow,
    distToLowPct: +distToLowPct.toFixed(3),
    bouncePct: +bouncePct.toFixed(3),
    structure,
    peaksBottoms,
    volSurge: +volSurge.toFixed(2),
    rsi: +rsi14.toFixed(1),
  };
}

/** 3) القمم والقيعان + زيرو انعكاس */
export function strategyPeaksBottomsZero(candles: Candle[]): StrategyVote {
  const z = analyzeZeroReversal(candles);
  let score = z.score * 8;
  const hits: string[] = [];

  if (z.status === "confirmed") {
    score += 30;
    hits.push("زيرو انعكاس مؤكد");
  } else if (z.status === "potential") {
    score += 16;
    hits.push("زيرو انعكاس محتمل");
  }
  if (z.peaksBottoms === "HH_HL") {
    score += 22;
    hits.push("HH+HL قمم وقيعان صاعدة");
  } else if (z.peaksBottoms === "higher_low") {
    score += 14;
    hits.push("قاع أعلى");
  } else if (z.structure === "ascending_bottoms" || z.structure === "second_bottom") {
    score += 14;
    hits.push(z.structure === "second_bottom" ? "القاع الثاني" : "قيعان صاعدة");
  }
  if (z.distToLowPct <= 1.5) {
    score += 10;
    hits.push(`قرب القاع ${z.distToLowPct}%`);
  }

  const pass = z.status !== "none" || score >= 36;
  return {
    id: "peaks_zero",
    name: "القمم والقيعان · زيرو انعكاس",
    pass,
    score: Math.min(100, score),
    detail: hits.length
      ? `${hits.join(" · ")} · ${z.structure}`
      : `لا زيرو انعكاس · ${z.peaksBottoms}`,
  };
}
