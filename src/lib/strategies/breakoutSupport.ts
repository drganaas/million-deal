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
  const lastHigh = highs.length ? highs[highs.length - 1].price : Math.max(...candles.slice(-20).map((c) => c.high));
  const lastLow = lows.length ? lows[lows.length - 1].price : Math.min(...candles.slice(-20).map((c) => c.low));
  const lookbackHigh = Math.max(...candles.slice(-21, -1).map((c) => c.high));
  const peakBreak = last.close > lastHigh && last.close > last.open;
  const mssBreak = last.close > lookbackHigh && last.close > last.open;
  const supportBreakDown = last.close < lastLow && last.close < last.open;

  // Bullish support reclaim after pierce (liquidity grab style)
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

/** 4) اختراق القمم وكسر/استعادة الدعم */
export function strategyBreakoutSupport(candles: Candle[]): StrategyVote {
  const b = analyzeBreakoutSupport(candles);
  let score = 0;
  const hits: string[] = [];

  if (b.peakBreak) {
    score += 34;
    hits.push("اختراق القمة الأخيرة");
  }
  if (b.resistanceBreak) {
    score += 18;
    hits.push("كسر مقاومة بإغلاق");
  }
  if (b.supportReclaim) {
    score += 28;
    hits.push("استعادة الدعم بعد كسر وهمي");
  }
  // For LONG board we treat pure support-break-down as negative (not a pass)
  if (b.supportBreak && !b.supportReclaim) {
    score -= 20;
    hits.push("كسر دعم هابط");
  }

  const last = candles.at(-1)!;
  const prev = candles.at(-2)!;
  if (last.close > prev.high && last.close > last.open) {
    score += 12;
    hits.push("إغلاق فوق قمة الشمعة السابقة");
  }

  const pass = score >= 28 && !b.supportBreak;
  return {
    id: "breakout",
    name: "اختراق القمم · كسر الدعم",
    pass,
    score: Math.min(100, Math.max(0, score)),
    detail: hits.length
      ? hits.join(" · ")
      : `لا اختراق · قمة ${b.lastHigh.toPrecision(6)} · دعم ${b.lastLow.toPrecision(6)}`,
  };
}
