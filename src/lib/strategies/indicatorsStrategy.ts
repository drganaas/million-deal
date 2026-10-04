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

function stochasticK(candles: Candle[], kPeriod = 14): number | null {
  if (candles.length < kPeriod + 3) return null;
  const slice = candles.slice(-kPeriod);
  const last = candles.at(-1)!;
  const hh = Math.max(...slice.map((c) => c.high));
  const ll = Math.min(...slice.map((c) => c.low));
  if (hh === ll) return 50;
  return ((last.close - ll) / (hh - ll)) * 100;
}

/** 2) استراتيجية المؤشرات — RSI / MACD / EMA / VWAP / حجم */
export function strategyIndicators(candles: Candle[]): StrategyVote {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const last = candles.at(-1)!;
  const r = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const h1 = hist.at(-2) ?? 0;
  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  const vwap = typicalVwap(candles);
  const stoch = stochasticK(candles, 14);

  let score = 0;
  const hits: string[] = [];

  if (r >= 35 && r <= 62) {
    score += 18;
    hits.push(`RSI ${r.toFixed(0)}`);
  }
  if (h0 > 0 && h0 >= h1) {
    score += 20;
    hits.push("MACD صاعد");
  }
  if (e20 > 0 && e50 > 0 && e20 >= e50 && last.close >= e20) {
    score += 18;
    hits.push("EMA20≥EMA50");
  }
  if (volRatio >= 1.15) {
    score += 16;
    hits.push(`حجم ${volRatio.toFixed(1)}x`);
  }
  if (vwap && last.close > vwap && last.close > last.open) {
    const wasBelow = candles.slice(-12, -1).filter((c) => c.close < vwap!).length >= 5;
    if (wasBelow) {
      score += 16;
      hits.push("اختراق VWAP");
    } else {
      score += 8;
      hits.push("فوق VWAP");
    }
  }
  if (stoch != null && stoch >= 20 && stoch <= 55) {
    score += 12;
    hits.push(`Stoch ${stoch.toFixed(0)}`);
  }

  const pass = score >= 40 || hits.length >= 3;
  return {
    id: "indicators",
    name: "استراتيجية المؤشرات",
    pass,
    score: Math.min(100, score),
    detail: hits.length ? hits.join(" · ") : "المؤشرات لم تتحول للصعود بعد",
  };
}
