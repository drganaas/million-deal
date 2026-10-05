import { ema, lastFinite, macd, rsi, sma } from "../indicators";
import type { Candle, StrategyVote } from "../types";

function typicalVwap(candles: Candle[]): number | null {
  let pv = 0;
  let vol = 0;
  const start = Math.max(0, candles.length - 48);
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    vol += c.volume;
  }
  return vol ? pv / vol : null;
}

/**
 * 2) المؤشرات — CONFIRM ONLY (solo WR failed random-40).
 * Used with locked candles/peaks; never alone for entry.
 */
export function strategyIndicators(candles: Candle[]): StrategyVote {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const last = candles.at(-1)!;
  const prev = candles.at(-2)!;
  const r = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const h1 = hist.at(-2) ?? 0;
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  const vwap = typicalVwap(candles);
  const recentLow = Math.min(...candles.slice(-48).map((c) => c.low));
  const dist = ((last.close - recentLow) / Math.max(recentLow, 1e-12)) * 100;
  const rising =
    candles.slice(-5).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close)
      .length >= 3;
  const higherLows =
    candles
      .slice(-8)
      .filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >= 4;
  const green = last.close > last.open && last.close >= prev.close;

  let score = 0;
  const hits: string[] = [];

  if (r >= 42 && r <= 58) {
    score += 24;
    hits.push(`RSI ${r.toFixed(0)}`);
  } else if (r > 62) {
    score -= 24;
    hits.push(`تشبع RSI ${r.toFixed(0)}`);
  }
  if (h0 > 0 && h0 >= h1) {
    score += 24;
    hits.push("MACD صاعد");
  }
  if (e20 > 0 && e50 > 0 && e20 >= e50 && last.close >= e20 * 1.001) {
    score += 18;
    hits.push("EMA20≥EMA50");
  }
  if (volRatio >= 1.25 && volRatio <= 2.4) {
    score += 22;
    hits.push(`سيولة ${volRatio.toFixed(1)}x`);
  } else if (volRatio < 1.15) score -= 14;
  else if (volRatio > 2.8) score -= 18;

  if (rising && higherLows) {
    score += 18;
    hits.push("هيكل صاعد");
  } else if (rising || higherLows) score += 10;

  if (dist >= 0.5 && dist <= 2.6) {
    score += 14;
    hits.push(`بعد القاع ${dist.toFixed(1)}%`);
  } else if (dist > 3.2) score -= 20;

  if (green) score += 10;
  if (vwap && last.close > vwap) score += 4;

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

  return {
    id: "indicators",
    name: "استراتيجية المؤشرات",
    pass,
    score: Math.min(100, Math.max(0, score)),
    detail: hits.length ? hits.join(" · ") : "تأكيد مؤشرات غير مكتمل",
  };
}
