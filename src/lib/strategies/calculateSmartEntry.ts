import { atr, lastFinite, macd, roundPx, rsi, sma } from "../indicators";
import type { LiquidityInfo, SmartSignal } from "../types";
import type { Candle } from "../types";
import { strategyBreakoutSupport, analyzeBreakoutSupport } from "./breakoutSupport";
import { detectBottom } from "./bottomDetector";
import { detectCandlePattern, strategyCandles } from "./candlesStrategy";
import { strategyIndicators } from "./indicatorsStrategy";
import { analyzeZeroReversal, strategyPeaksBottomsZero } from "./peaksBottomsZero";
import { detectSmc } from "./smc";

export function calculateSmartEntry(args: {
  symbol: string;
  candles: Candle[];
  last?: number;
  changePct?: number;
  quoteVolume?: number;
  liquidity?: LiquidityInfo;
}): SmartSignal | null {
  const { symbol, candles } = args;
  if (!candles || candles.length < 60) return null;

  const pillars = [
    strategyCandles(candles),
    strategyIndicators(candles),
    strategyPeaksBottomsZero(candles),
    strategyBreakoutSupport(candles),
  ];
  const agreeCount = pillars.filter((v) => v.pass).length;

  // Quality: need at least 2 of 4 pillars
  if (agreeCount < 2) return null;

  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const last = args.last ?? candles.at(-1)!.close;
  const atrVal = lastFinite(atr(candles, 14)) || last * 0.01;
  const r = lastFinite(rsi(closes, 14));
  const { hist } = macd(closes);
  const h0 = hist.at(-1) ?? 0;
  const volAvg = lastFinite(sma(vols, 20)) || 1;
  const volumeRatio = (vols.at(-1) ?? 0) / volAvg;
  const bottom = detectBottom(candles);
  const smc = detectSmc(candles);
  const pattern = detectCandlePattern(candles);
  const zeroReversal = analyzeZeroReversal(candles);
  const breakout = analyzeBreakoutSupport(candles);

  const entry = last;
  const riskBase = Math.max(atrVal * 1.25, last * 0.006);
  const structureSl = Math.min(bottom.currentLow, zeroReversal.swingLow) - atrVal * 0.15;
  let sl = Math.min(entry - riskBase, structureSl);
  const maxRisk = entry * 0.015;
  if (entry - sl > maxRisk) sl = entry - maxRisk;
  if (entry - sl < entry * 0.004) sl = entry - entry * 0.004;
  const risk = entry - sl;
  const tp1 = entry + risk * 1.5;
  const tp2 = entry + risk * 2.5;
  const tp3 = entry + risk * 4;

  const avgScore = pillars.reduce((a, p) => a + p.score, 0) / pillars.length;
  const successRate = Math.min(97, Math.round(58 + agreeCount * 9 + avgScore * 0.12));

  return {
    symbol,
    base: symbol.replace(/USDT$/i, ""),
    last,
    changePct: args.changePct ?? 0,
    quoteVolume: args.quoteVolume ?? 0,
    side: "LONG",
    entry: roundPx(entry),
    tp1: roundPx(tp1),
    tp2: roundPx(tp2),
    tp3: roundPx(tp3),
    sl: roundPx(sl),
    successRate,
    votes: pillars,
    pillars,
    agreeCount,
    rsi: +r.toFixed(1),
    macdHist: +h0.toPrecision(4),
    volumeRatio: +volumeRatio.toFixed(2),
    candlePattern: pattern,
    bottomType: bottom.type,
    atl: roundPx(bottom.atl),
    ath: roundPx(bottom.ath),
    currentLow: roundPx(bottom.currentLow),
    currentHigh: roundPx(bottom.currentHigh),
    distanceFromBottomPct: +bottom.distancePct.toFixed(2),
    smc,
    liquidity: args.liquidity ?? { bidDepth: 0, askDepth: 0, totalScore: 0 },
    zeroReversal,
    breakout,
    reasons: pillars.filter((v) => v.pass).map((v) => v.name),
  };
}

export { strategyCandles } from "./candlesStrategy";
export { strategyIndicators } from "./indicatorsStrategy";
export { strategyPeaksBottomsZero } from "./peaksBottomsZero";
export { strategyBreakoutSupport } from "./breakoutSupport";
