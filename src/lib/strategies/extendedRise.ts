import { atr, ema, lastFinite, macd, rsi, sma } from "../indicators";
import type { Candle } from "../types";

export type ExtendedRiseGate = {
  pass: boolean;
  score: number;
  passCount: number;
  distFromLowPct: number;
  roomToHighPct: number;
  volRatio: number;
  atrPct: number;
  checks: {
    earlyRise: boolean;
    trendUp: boolean;
    momentum: boolean;
    liquidityVol: boolean;
    structure: boolean;
    notExhausted: boolean;
    extensionCapacity: boolean;
    notLateBreakout: boolean;
  };
  detail: string;
};

/**
 * Gate: entry only at the START of a sustained/extended rise (~10% path),
 * confirmed by trend + momentum + liquidity — reject short pumps & late tops.
 */
export function evaluateExtendedRise(candles: Candle[]): ExtendedRiseGate {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const last = candles.at(-1)!;
  const recent = candles.slice(-64);
  const recentLow = Math.min(...recent.map((c) => c.low));
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const distFromLowPct = ((last.close - recentLow) / Math.max(recentLow, 1e-12)) * 100;
  const roomToHighPct = ((recentHigh - last.close) / Math.max(last.close, 1e-12)) * 100;

  const e20 = lastFinite(ema(closes, 20));
  const e50 = lastFinite(ema(closes, 50));
  const r = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const h1 = hist.at(-2) ?? 0;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  const atrVal = lastFinite(atr(candles, 14)) || last.close * 0.01;
  const atrPct = (atrVal / last.close) * 100;

  const slice8 = candles.slice(-8);
  const higherLows =
    slice8.filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997).length >= 4;
  const risingCloses =
    candles.slice(-6).filter((x, i, arr) => i > 0 && arr[i].close > arr[i - 1].close).length >= 3;
  const greenDom =
    candles.slice(-5).filter((c) => c.close > c.open).length >= 3;

  // Late spike: already ran hard and sitting on the local high
  const lateSpike =
    distFromLowPct > 4.5 &&
    roomToHighPct < 0.6 &&
    last.close >= recentHigh * 0.997;

  // Volume climax often marks short pump top
  const volClimax = volRatio > 3.2;

  const checks = {
    // Beginning of rise: lifted off low, not mid/late pump
    earlyRise: distFromLowPct >= 0.2 && distFromLowPct <= 4.5,
    // Trend must already be turning up
    trendUp: e20 >= e50 * 0.995 && last.close >= e20 * 0.995,
    // Momentum proving the rise
    momentum:
      (h0 > 0 && h0 >= h1) ||
      (h0 > 0 && r >= 40 && r <= 64),
    // Liquidity / volume confirmation (not climax dump)
    liquidityVol: volRatio >= 1.15 && !volClimax,
    // Structure of continuous rise (not one spike)
    structure: higherLows || risingCloses || greenDom,
    // Not exhausted
    notExhausted:
      r < 67 &&
      roomToHighPct >= 0.6 &&
      (roomToHighPct >= 1.0 || (distFromLowPct <= 2.8 && volRatio >= 1.3)),
    extensionCapacity: atrPct * 12 >= 5 || atrPct >= 0.42,
    notLateBreakout: !lateSpike,
  };

  const core = [
    checks.earlyRise,
    checks.trendUp,
    checks.momentum,
    checks.liquidityVol,
    checks.structure,
    checks.notLateBreakout,
  ];
  const support = [checks.notExhausted, checks.extensionCapacity];
  const passCount = [...core, ...support].filter(Boolean).length;
  const pass = core.every(Boolean) && support.filter(Boolean).length >= 1;

  let score = passCount * 11;
  if (checks.earlyRise && distFromLowPct <= 2.5) score += 8;
  if (checks.liquidityVol && volRatio >= 1.6) score += 6;
  if (checks.structure && checks.trendUp) score += 8;
  if (checks.extensionCapacity && atrPct >= 0.8) score += 5;

  const fails = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return {
    pass,
    score: Math.min(100, score),
    passCount,
    distFromLowPct: +distFromLowPct.toFixed(2),
    roomToHighPct: +roomToHighPct.toFixed(2),
    volRatio: +volRatio.toFixed(2),
    atrPct: +atrPct.toFixed(3),
    checks,
    detail: pass
      ? `صعود مبكر ممتد · بعد القاع ${distFromLowPct.toFixed(1)}% · زخم+سيولة ${volRatio.toFixed(1)}x · سعة ATR ${atrPct.toFixed(2)}%`
      : `مرفوض · صعود قصير/متأخر · ناقص: ${fails.join(", ")}`,
  };
}
