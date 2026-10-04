import type { Candle, StrategyVote } from "../types";
import { lastFinite, macd, rsi, sma } from "../indicators";

/** Volume + Momentum: RSI zone + MACD + volume surge. */
export function strategyVolumeMomentum(candles: Candle[]): StrategyVote {
  if (candles.length < 40) {
    return { id: "volume_momentum", name: "Volume + Momentum", pass: false, score: 0, detail: "بيانات غير كافية" };
  }
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const r = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const h1 = hist.at(-2) ?? 0;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  const macdRising = h0 > h1 || h0 > 0;
  const rsiOk = r >= 38 && r <= 68;
  const volOk = volRatio >= 1.15;
  const pass = macdRising && rsiOk && volOk;
  return {
    id: "volume_momentum",
    name: "Volume + Momentum",
    pass,
    score: pass ? 87 : Math.round((Number(rsiOk) + Number(volOk) + Number(h0 > 0)) * 28),
    detail: pass
      ? `RSI ${r.toFixed(1)} · MACD ${h0.toFixed(4)} · Vol ${volRatio.toFixed(2)}x`
      : "الزخم/الحجم غير مكتمل",
  };
}
