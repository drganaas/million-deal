import type { Candle, CandlePattern, StrategyVote } from "../types";

export function detectCandlePattern(candles: Candle[]): CandlePattern {
  const c = candles.at(-1);
  const p = candles.at(-2);
  if (!c || !p) return "Neutral";
  const body = Math.abs(c.close - c.open);
  const range = Math.max(c.high - c.low, 1e-12);
  const lower = Math.min(c.open, c.close) - c.low;
  const upper = c.high - Math.max(c.open, c.close);
  if (lower >= body * 2 && upper <= body * 0.5) return "Hammer";
  if (p.close < p.open && c.close > c.open && c.close >= p.open && c.open <= p.close) {
    return "Bullish Engulfing";
  }
  if (body / range < 0.12) return "Doji";
  if (lower >= range * 0.55 && c.close > c.open) return "Pin Bar";
  if (body / range > 0.65 && c.close > c.open) return "Strong Bull";
  const a = candles.at(-3);
  if (
    a &&
    a.close < a.open &&
    Math.abs(p.close - p.open) / Math.max(p.high - p.low, 1e-12) < 0.3 &&
    c.close > c.open &&
    c.close > a.open
  ) {
    return "Morning Star";
  }
  return "Neutral";
}

/** 1) استراتيجية الشموع — أنماط انعكاس/زخم شرائي منفصلة */
export function strategyCandles(candles: Candle[]): StrategyVote {
  const pattern = detectCandlePattern(candles);
  const c = candles.at(-1)!;
  const p = candles.at(-2)!;
  const body = Math.abs(c.close - c.open);
  const range = Math.max(c.high - c.low, 1e-12);
  const lower = Math.min(c.open, c.close) - c.low;
  const bull = c.close > c.open;
  const hammer = bull && lower >= body * 2 && lower / range >= 0.5;
  const engulf =
    bull &&
    p.close < p.open &&
    c.close >= p.open &&
    c.open <= p.close &&
    body > Math.abs(p.close - p.open);
  const strong = bull && body / range > 0.65;
  const pin = bull && lower >= range * 0.55;
  const morning = pattern === "Morning Star";

  let score = 0;
  const hits: string[] = [];
  if (hammer || pattern === "Hammer") {
    score += 28;
    hits.push("مطرقة");
  }
  if (engulf || pattern === "Bullish Engulfing") {
    score += 30;
    hits.push("ابتلاع شرائي");
  }
  if (morning) {
    score += 26;
    hits.push("نجمة الصباح");
  }
  if (pin || pattern === "Pin Bar") {
    score += 18;
    hits.push("Pin Bar");
  }
  if (strong || pattern === "Strong Bull") {
    score += 16;
    hits.push("شمعة خضراء قوية");
  }
  if (bull && c.close > p.high) {
    score += 10;
    hits.push("إغلاق فوق قمة السابقة");
  }

  const pass = score >= 28 || hits.length >= 2;
  return {
    id: "candles",
    name: "استراتيجية الشموع",
    pass,
    score: Math.min(100, score),
    detail: hits.length ? `${pattern} · ${hits.join(" + ")}` : `لا نمط شرائي واضح (${pattern})`,
  };
}
