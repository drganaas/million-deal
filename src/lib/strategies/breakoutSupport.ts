import { lastFinite, macd, sma } from "../indicators";
import type { BreakoutInfo, Candle, StrategyVote } from "../types";

function swingHighs(candles: Candle[], look = 3) {
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

function swingLows(candles: Candle[], look = 3) {
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

export function analyzeBreakoutSupport(candles: Candle[]): BreakoutInfo {
  const last = candles.at(-1)!;
  const highs = swingHighs(candles, 3);
  const lows = swingLows(candles, 3);
  const lastHigh = highs.length
    ? highs[highs.length - 1].price
    : Math.max(...candles.slice(-20).map((c) => c.high));
  const lastLow = lows.length
    ? lows[lows.length - 1].price
    : Math.min(...candles.slice(-20).map((c) => c.low));
  const lookbackHigh = Math.max(...candles.slice(-21, -1).map((c) => c.high));
  const peakBreak = last.close > lastHigh && last.close > last.open;
  const mssBreak = last.close > lookbackHigh && last.close > last.open;
  const supportBreakDown = last.close < lastLow && last.close < last.open;
  const pierced =
    candles.length >= 3 &&
    candles.at(-2)!.low <= lastLow * 1.001 &&
    last.close >= lastLow &&
    last.close > last.open;
  const resistanceBreakClose = last.close > lastHigh && last.close > last.open;

  return {
    peakBreak: peakBreak || mssBreak,
    supportBreak: supportBreakDown,
    supportReclaim: pierced,
    resistanceBreak: resistanceBreakClose,
    lastHigh,
    lastLow,
    lookbackHigh,
  };
}

/**
 * 4) اختراق/استعادة — CONFIRM ONLY (solo WR failed random-40).
 * Reclaim-only soft vote; never generates entry alone.
 */
export function strategyBreakoutSupport(candles: Candle[]): StrategyVote {
  const b = analyzeBreakoutSupport(candles);
  const last = candles.at(-1)!;
  const prev = candles.at(-2)!;
  const vols = candles.map((c) => c.volume);
  const closes = candles.map((c) => c.close);
  const recentLow = Math.min(...candles.slice(-40).map((c) => c.low));
  const recentHigh = Math.max(...candles.slice(-40).map((c) => c.high));
  const distFromLow = ((last.close - recentLow) / Math.max(recentLow, 1e-12)) * 100;
  const roomToHigh = ((recentHigh - last.close) / Math.max(last.close, 1e-12)) * 100;
  const lateTop = distFromLow > 2.8 || roomToHigh < 1.0;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const rising =
    candles.slice(-4).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close)
      .length >= 2;
  const reclaim =
    b.supportReclaim && last.close > prev.close;

  let score = 0;
  const hits: string[] = [];

  if (reclaim && distFromLow <= 2.5) {
    score += 45;
    hits.push("استعادة دعم مبكرة");
  } else if (reclaim) {
    score += 20;
    hits.push("استعادة دعم");
  }
  if (b.supportBreak && !reclaim) {
    score -= 35;
    hits.push("كسر دعم هابط");
  }
  if (b.peakBreak) {
    score -= 10;
    hits.push("اختراق قمة (تأكيد فقط)");
  }
  if (volRatio >= 1.25 && volRatio <= 2.4) {
    score += 16;
    hits.push(`حجم ${volRatio.toFixed(1)}x`);
  } else if (volRatio > 2.8) score -= 14;
  if (h0 > 0) {
    score += 12;
    hits.push("MACD+");
  }
  if (rising) score += 10;
  if (distFromLow >= 0.3 && distFromLow <= 2.5) score += 12;
  if (last.close > last.open) score += 8;

  const pass =
    reclaim &&
    !b.supportBreak &&
    !lateTop &&
    h0 > 0 &&
    volRatio >= 1.2 &&
    volRatio <= 2.5 &&
    distFromLow <= 2.6 &&
    rising &&
    score >= 55;

  return {
    id: "breakout",
    name: "اختراق القمم · كسر الدعم",
    pass,
    score: Math.min(100, Math.max(0, score)),
    detail: hits.length
      ? hits.join(" · ")
      : `لا استعادة دعم · قمة ${b.lastHigh.toPrecision(6)} · دعم ${b.lastLow.toPrecision(6)}`,
  };
}
