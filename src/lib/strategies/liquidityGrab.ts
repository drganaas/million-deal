import type { Candle, StrategyVote } from "../types";

/** Liquidity Grab: sweep of recent lows then close back inside range. */
export function strategyLiquidityGrab(candles: Candle[]): StrategyVote {
  if (candles.length < 40) {
    return { id: "liquidity_grab", name: "Liquidity Grab", pass: false, score: 0, detail: "بيانات غير كافية" };
  }
  const c = candles.at(-1)!;
  const window = candles.slice(-21, -1);
  const swingLow = Math.min(...window.map((x) => x.low));
  const swingHigh = Math.max(...window.map((x) => x.high));
  const swept = c.low <= swingLow * 1.001;
  const reclaimed = c.close > swingLow && c.close > Math.min(c.open, swingLow);
  const notBlowOff = c.close < swingHigh * 1.01;
  const pass = swept && reclaimed && notBlowOff;
  return {
    id: "liquidity_grab",
    name: "Liquidity Grab",
    pass,
    score: pass ? 90 : swept ? 50 : 18,
    detail: pass ? "سحب سيولة أسفل القاع ثم إغلاق داخلي" : "لا يوجد سحب سيولة نظيف",
  };
}
