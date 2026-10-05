import { atr, ema, lastFinite, macd, rsi, sma } from "../indicators";
import type { Candle } from "../types";
import { detectSmc } from "../strategies/smc";
import type { StrategyGenome } from "./types";

export type GenomeSignal = {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  score: number;
};

function swingLow(candles: Candle[], look = 3) {
  const out: number[] = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].low;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].low <= v || candles[i + j].low < v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(v);
  }
  return out;
}

function swingHigh(candles: Candle[], look = 3) {
  const out: number[] = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].high;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].high >= v || candles[i + j].high > v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(v);
  }
  return out;
}

/**
 * Parameterized smart-entry used by the backtest / genetic optimizer.
 * Mirrors production confluence logic with genome-tunable thresholds.
 */
export function evaluateEntryWithGenome(
  candles: Candle[],
  g: StrategyGenome,
): GenomeSignal | null {
  if (candles.length < Math.max(60, g.emaSlow + 5)) return null;

  const last = candles.at(-1)!;
  const prev = candles.at(-2)!;
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const recent = candles.slice(-64);
  const recentLow = Math.min(...recent.map((c) => c.low));
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const dist = ((last.close - recentLow) / Math.max(recentLow, 1e-12)) * 100;
  const room = ((recentHigh - last.close) / Math.max(last.close, 1e-12)) * 100;

  if (dist < g.distFromLowMin || dist > g.distFromLowMax) return null;
  if (room < 0.5) return null;

  const r = lastFinite(rsi(closes, 14));
  if (r < g.rsiLow || r > g.rsiHigh) return null;

  const eFast = lastFinite(ema(closes, Math.round(g.emaFast)));
  const eSlow = lastFinite(ema(closes, Math.round(g.emaSlow)));
  if (!(eFast >= eSlow * 0.997 && last.close >= eFast * 0.996)) return null;

  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const h1 = hist.at(-2) ?? 0;
  if (g.macdRequired && !(h0 > 0 && h0 >= h1)) return null;

  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volRatio = (vols.at(-1) ?? 0) / volAvg;
  if (volRatio < g.volumeMult || volRatio > Math.max(3.2, g.volumeMult * 2.2)) return null;

  const higherLows =
    candles.slice(-8).filter((x, i, arr) => i > 0 && arr[i].low >= arr[i - 1].low * 0.997)
      .length >= 4;
  if (g.higherLowsRequired && !higherLows) return null;

  const smc = detectSmc(candles);
  const smcHits = [smc.bos, smc.choch, smc.sweep, smc.fvg, smc.orderBlock].filter(Boolean)
    .length;
  if (g.bosRequired && !smc.bos) return null;
  if (g.fvgRequired && !smc.fvg) return null;
  if (g.orderBlockRequired && !smc.orderBlock) return null;
  if (smcHits < g.smcMinHits) return null;

  // Pillar votes (simplified but aligned with locked production rules)
  const body = Math.abs(last.close - last.open);
  const range = Math.max(last.high - last.low, 1e-12);
  const lower = Math.min(last.open, last.close) - last.low;
  const bull = last.close > last.open;
  const hammer = bull && lower >= body * 1.6 && lower / range >= 0.4;
  const engulf =
    bull &&
    prev.close < prev.open &&
    last.close >= prev.open &&
    last.open <= prev.close;
  const strong = bull && body / range >= 0.6 && last.close > prev.high;
  const candlesPass = hammer || engulf || strong;

  const lows = swingLow(candles, 3);
  const highs = swingHigh(candles, 3);
  let hhhl = false;
  if (highs.length >= 2 && lows.length >= 2) {
    hhhl =
      highs[highs.length - 1] > highs[highs.length - 2] &&
      lows[lows.length - 1] > lows[lows.length - 2];
  }
  const peaksPass =
    (dist <= 3.0 && bull && (hhhl || higherLows) && volRatio >= g.volumeMult) ||
    (dist <= 0.6 && bull && volRatio >= g.volumeMult);

  const lastSwingLow = lows.length ? lows[lows.length - 1] : recentLow;
  const reclaim =
    candles.length >= 3 &&
    candles.at(-2)!.low <= lastSwingLow * 1.001 &&
    last.close >= lastSwingLow &&
    bull;
  const breakoutPass = reclaim && dist <= g.distFromLowMax;

  const indicatorsPass =
    r >= g.rsiLow &&
    r <= g.rsiHigh &&
    h0 > 0 &&
    volRatio >= g.volumeMult &&
    eFast >= eSlow;

  const pillars = [candlesPass, indicatorsPass, peaksPass, breakoutPass].filter(Boolean)
    .length;
  if (pillars < g.minPillars) return null;
  if (g.requireIndicators && !indicatorsPass) return null;
  if (g.requireCandlesOrPeaks && !(candlesPass || peaksPass)) return null;

  const atrVal = lastFinite(atr(candles, 14)) || last.close * 0.01;
  const entry = last.close;
  let sl = Math.min(entry - atrVal * g.slAtrMult, lastSwingLow - atrVal * 0.2);
  const maxRisk = entry * g.maxRiskPct;
  if (entry - sl > maxRisk) sl = entry - maxRisk;
  if (entry - sl < entry * 0.005) sl = entry - entry * 0.005;
  const risk = entry - sl;
  if (risk <= 0) return null;

  const score =
    pillars * 18 +
    smcHits * 6 +
    (hhhl ? 10 : 0) +
    Math.min(20, (volRatio - g.volumeMult) * 10);

  return {
    entry,
    sl,
    tp1: entry + risk * g.tp1R,
    tp2: entry + risk * g.tp2R,
    tp3: entry + risk * g.tp3R,
    score,
  };
}
