import { atr, lastFinite, macd, roundPx, rsi, sma } from "../indicators";
import type { Candle, CandlePattern, LiquidityInfo, SmartSignal } from "../types";
import { detectBottom, strategyBottomDetector } from "./bottomDetector";
import { strategyHiddenCandle } from "./hiddenCandle";
import { strategyLiquidityGrab } from "./liquidityGrab";
import { detectSmc, strategySmc } from "./smc";
import { strategyVolumeMomentum } from "./volumeMomentum";

function detectPattern(candles: Candle[]): CandlePattern {
  const c = candles.at(-1);
  const p = candles.at(-2);
  if (!c || !p) return "Neutral";
  const body = Math.abs(c.close - c.open);
  const range = Math.max(c.high - c.low, 1e-12);
  const lower = Math.min(c.open, c.close) - c.low;
  const upper = c.high - Math.max(c.open, c.close);
  if (lower >= body * 2 && upper <= body * 0.5) return "Hammer";
  if (p.close < p.open && c.close > c.open && c.close >= p.open && c.open <= p.close) return "Bullish Engulfing";
  if (body / range < 0.12) return "Doji";
  if (lower >= range * 0.55 && c.close > c.open) return "Pin Bar";
  if (body / range > 0.65 && c.close > c.open) return "Strong Bull";
  const a = candles.at(-3);
  if (a && a.close < a.open && Math.abs(p.close - p.open) / Math.max(p.high - p.low, 1e-12) < 0.3 && c.close > c.open && c.close > a.open) {
    return "Morning Star";
  }
  return "Neutral";
}

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

  const votes = [
    strategyHiddenCandle(candles),
    strategyLiquidityGrab(candles),
    strategySmc(candles),
    strategyVolumeMomentum(candles),
    strategyBottomDetector(candles),
  ];
  const agreeCount = votes.filter((v) => v.pass).length;

  // Quality filter: hide if fewer than 3 strategies agree
  if (agreeCount < 3) return null;

  const successRate = agreeCount >= 4 ? Math.min(97, 90 + (agreeCount - 4) * 3) : 70 + (agreeCount - 3) * 5;
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
  const pattern = detectPattern(candles);

  // Dynamic entry near retest of EMA20 / current close
  const entry = last;
  const riskBase = Math.max(atrVal * 1.25, last * 0.006);
  const structureSl = bottom.currentLow - atrVal * 0.15;
  let sl = Math.min(entry - riskBase, structureSl);
  const maxRisk = entry * 0.015;
  if (entry - sl > maxRisk) sl = entry - maxRisk;
  if (entry - sl < entry * 0.004) sl = entry - entry * 0.004;
  const risk = entry - sl;
  const tp1 = entry + risk * 1.5;
  const tp2 = entry + risk * 2.5;
  const tp3 = entry + risk * 4;

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
    votes,
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
    reasons: votes.filter((v) => v.pass).map((v) => v.name),
  };
}

export { strategyHiddenCandle, strategyLiquidityGrab, strategySmc, strategyVolumeMomentum, strategyBottomDetector };
