import { lastFinite, macd, rsi, sma } from "../indicators";
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
  const bouncePct = distToLowPct;
  const lastGreen = last.close > last.open;
  const risingNow = last.close > prev.close && lastGreen;
  const higherLow = last.low > swingLow;
  const volAvg = lastFinite(sma(vols.slice(0, -1), 20)) || 1;
  const volSurge = last.volume / volAvg;
  const ma7 = lastFinite(sma(closes, 7));
  const ma20 = lastFinite(sma(closes, 20));
  const rsi14 = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const stillAtZero = distToLowPct >= 0 && distToLowPct <= 0.5;
  const earlyBounce = distToLowPct > 0.5 && distToLowPct <= 3.0;

  let score = 0;
  if (stillAtZero) score += 3;
  else if (earlyBounce) score += 2;
  else if (distToLowPct > 4) score -= 3;

  if (lastGreen && (stillAtZero || earlyBounce)) score += 1;
  if (risingNow && (stillAtZero || earlyBounce)) score += 1;
  if (prev.close > prev.open && lastGreen && (stillAtZero || earlyBounce)) score += 1;
  if (higherLow && barsSinceLow <= 10 && (stillAtZero || earlyBounce)) score += 1;
  if (volSurge >= 1.2 && volSurge <= 2.8 && (stillAtZero || earlyBounce)) score += 1;
  if (ma7 && ma20 && ma7 >= ma20 && (stillAtZero || earlyBounce)) score += 1;
  if (rsi14 >= 32 && rsi14 <= 58 && (stillAtZero || earlyBounce)) score += 1;
  if (h0 > 0 && (stillAtZero || earlyBounce)) score += 1;

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

  if (peaksBottoms === "HH_HL" && (stillAtZero || earlyBounce)) score += 2;
  if (
    (structure === "ascending_bottoms" || structure === "second_bottom") &&
    (stillAtZero || earlyBounce)
  ) {
    score += 1;
  }

  const status: ZeroReversalInfo["status"] =
    stillAtZero && score >= 5
      ? "confirmed"
      : earlyBounce && score >= 5 && peaksBottoms !== "LH_LL"
        ? "confirmed"
        : (stillAtZero || earlyBounce) && score >= 4
          ? "potential"
          : "none";

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

/** 3) القمم والقيعان · زيرو — LOCKED fix: early bounce + volume band + MACD */
export function strategyPeaksBottomsZero(candles: Candle[]): StrategyVote {
  const z = analyzeZeroReversal(candles);
  const closes = candles.map((c) => c.close);
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  let score = z.score * 8;
  const hits: string[] = [];

  if (z.status === "confirmed") {
    score += 30;
    hits.push("زيرو/بداية صعود مؤكد");
  } else if (z.status === "potential") {
    score += 16;
    hits.push("انعكاس مبكر محتمل");
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
  if (z.distToLowPct <= 3.0) {
    score += 12;
    hits.push(`بداية من القاع ${z.distToLowPct}%`);
  }
  if (z.volSurge >= 1.2 && z.volSurge <= 2.8) {
    score += 10;
    hits.push(`سيولة ${z.volSurge}x`);
  }
  if (h0 > 0) {
    score += 8;
    hits.push("MACD+");
  }
  if (z.peaksBottoms === "LH_LL") score -= 25;

  const pass =
    z.status === "confirmed" &&
    z.peaksBottoms !== "LH_LL" &&
    z.distToLowPct <= 3.0 &&
    z.volSurge >= 1.2 &&
    z.volSurge <= 2.6 &&
    h0 > 0 &&
    candles.at(-1)!.close > candles.at(-1)!.open;

  return {
    id: "peaks_zero",
    name: "القمم والقيعان · زيرو انعكاس",
    pass,
    score: Math.min(100, Math.max(0, score)),
    detail: hits.length
      ? `${hits.join(" · ")} · ${z.structure}`
      : `لا زيرو انعكاس · ${z.peaksBottoms}`,
  };
}
