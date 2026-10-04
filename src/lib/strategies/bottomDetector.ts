import type { BottomType, Candle, StrategyVote } from "../types";
import { lastFinite, rsi } from "../indicators";

export function detectBottom(candles: Candle[]): {
  type: BottomType;
  atl: number;
  ath: number;
  currentLow: number;
  currentHigh: number;
  distancePct: number;
} {
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const atl = Math.min(...lows);
  const ath = Math.max(...highs);
  const recent = candles.slice(-40);
  const currentLow = Math.min(...recent.map((c) => c.low));
  const currentHigh = Math.max(...recent.map((c) => c.high));
  const last = candles.at(-1)!.close;
  const distancePct = currentLow > 0 ? ((last - currentLow) / currentLow) * 100 : 99;
  const nearAtl = Math.abs(currentLow - atl) / atl < 0.03;
  const prior = candles.slice(-80, -20);
  const priorLow = Math.min(...prior.map((c) => c.low));
  const double = Math.abs(currentLow - priorLow) / priorLow < 0.018;
  let type: BottomType = "Local";
  if (nearAtl) type = "Historical";
  else if (double) type = "Double";
  else if (distancePct < 3.5) type = "First";
  return { type, atl, ath, currentLow, currentHigh, distancePct };
}

/** Bottom Detector: near local/historical bottom with RSI not overbought. */
export function strategyBottomDetector(candles: Candle[]): StrategyVote {
  if (candles.length < 50) {
    return { id: "bottom_detector", name: "Bottom Detector", pass: false, score: 0, detail: "بيانات غير كافية" };
  }
  const bottom = detectBottom(candles);
  const r = lastFinite(rsi(candles.map((c) => c.close), 14));
  const near = bottom.distancePct <= 6;
  const rsiOk = r < 60;
  const pass =
    near &&
    rsiOk &&
    (bottom.type === "Historical" || bottom.type === "Double" || bottom.type === "First" || bottom.distancePct <= 3.5);
  return {
    id: "bottom_detector",
    name: "Bottom Detector",
    pass,
    score: pass ? 92 : near ? 58 : 22,
    detail: pass
      ? `قاع ${bottom.type} · بعد ${bottom.distancePct.toFixed(2)}%`
      : `بعيد عن القاع (${bottom.distancePct.toFixed(2)}%)`,
  };
}
