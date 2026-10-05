import { atr, lastFinite, macd, roundPx, rsi, sma } from "../indicators";
import type { LiquidityInfo, SmartSignal } from "../types";
import type { Candle } from "../types";
import { getActiveGenomeSync, isGenomeEnforced } from "../backtest/activeGenome";
import { evaluateEntryWithGenome } from "../backtest/genomeEntry";
import { strategyBreakoutSupport, analyzeBreakoutSupport } from "./breakoutSupport";
import { detectBottom } from "./bottomDetector";
import { detectCandlePattern, strategyCandles } from "./candlesStrategy";
import { evaluateExtendedRise } from "./extendedRise";
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

  // When user adopts optimized settings, genome becomes a hard entry filter + TP/SL source
  const genome = getActiveGenomeSync();
  const genomeSig = evaluateEntryWithGenome(candles, genome);
  if (isGenomeEnforced() && !genomeSig) return null;

  const extendedRise = evaluateExtendedRise(candles);
  // Hard gate: only beginning of a sustained rise with liquidity + momentum
  if (!extendedRise.pass) return null;

  const pillars = [
    strategyCandles(candles),
    strategyIndicators(candles),
    strategyPeaksBottomsZero(candles),
    strategyBreakoutSupport(candles),
  ];
  const agreeCount = pillars.filter((v) => v.pass).length;
  const indicatorsPass = pillars.find((p) => p.id === "indicators")?.pass ?? false;
  const peaksPass = pillars.find((p) => p.id === "peaks_zero")?.pass ?? false;
  const breakoutPass = pillars.find((p) => p.id === "breakout")?.pass ?? false;
  const candlesPass = pillars.find((p) => p.id === "candles")?.pass ?? false;

  /**
   * LOCKED entry policy (random-40 seed 154120721):
   * ENTRY: candles (45%) OR peaks (50%)
   * CONFIRM: indicators (with candles) — never solo
   * SOFT: breakout reclaim — never solo
   */
  const combinedCandles = candlesPass && indicatorsPass;
  const peaksConfirmed = peaksPass && (indicatorsPass || candlesPass);
  if (!combinedCandles && !peaksConfirmed) return null;
  if (agreeCount < 2) return null;
  if (breakoutPass && extendedRise.distFromLowPct > 2.6) return null;

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
  // Prefer optimized genome risk ladder when available
  let sl: number;
  let tp1: number;
  let tp2: number;
  let tp3: number;
  if (genomeSig && isGenomeEnforced()) {
    sl = genomeSig.sl;
    tp1 = genomeSig.tp1;
    tp2 = genomeSig.tp2;
    tp3 = genomeSig.tp3;
  } else {
    const riskBase = Math.max(atrVal * 1.6, last * 0.009);
    const structureSl = Math.min(bottom.currentLow, zeroReversal.swingLow) - atrVal * 0.25;
    sl = Math.min(entry - riskBase, structureSl);
    const maxRisk = entry * 0.022;
    if (entry - sl > maxRisk) sl = entry - maxRisk;
    if (entry - sl < entry * 0.006) sl = entry - entry * 0.006;
    const risk = entry - sl;
    tp1 = entry + Math.max(risk * 2.0, entry * 0.025);
    tp2 = entry + Math.max(risk * 3.8, entry * 0.055);
    tp3 = entry + Math.max(risk * 6.5, entry * 0.1);
  }

  const avgScore = pillars.reduce((a, p) => a + p.score, 0) / pillars.length;
  const successRate = Math.min(
    96,
    Math.round(62 + agreeCount * 7 + extendedRise.score * 0.12 + avgScore * 0.08),
  );

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
    extendedRise,
    reasons: [
      extendedRise.detail,
      ...pillars.filter((v) => v.pass).map((v) => v.name),
    ],
  };
}

export { strategyCandles } from "./candlesStrategy";
export { strategyIndicators } from "./indicatorsStrategy";
export { strategyPeaksBottomsZero } from "./peaksBottomsZero";
export { strategyBreakoutSupport } from "./breakoutSupport";
export { evaluateExtendedRise } from "./extendedRise";
