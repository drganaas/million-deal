import type { Candle, StrategyVote } from "../types";
import { ema, lastFinite } from "../indicators";

/** Hidden Candle: rejection wick + reclaim near EMA. */
export function strategyHiddenCandle(candles: Candle[]): StrategyVote {
  const c = candles.at(-1);
  const prev = candles.at(-2);
  if (!c || !prev || candles.length < 30) {
    return { id: "hidden_candle", name: "Hidden Candle", pass: false, score: 0, detail: "بيانات غير كافية" };
  }
  const closes = candles.map((x) => x.close);
  const e20 = lastFinite(ema(closes, 20));
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const body = Math.abs(c.close - c.open);
  const hammerLike = lowerWick >= body * 1.4 && upperWick <= body * 0.8;
  const reclaim = c.close >= prev.close * 0.998 && c.close >= e20 * 0.992;
  const pass = hammerLike && reclaim && c.close >= c.open * 0.999;
  return {
    id: "hidden_candle",
    name: "Hidden Candle",
    pass,
    score: pass ? 88 : hammerLike ? 55 : 20,
    detail: pass ? "شمعة إخفاء + استعادة فوق المتوسط" : "لا توجد شمعة إخفاء مؤكدة",
  };
}
