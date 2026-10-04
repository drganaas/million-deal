import type { Candle, SmcState, StrategyVote } from "../types";
import { ema } from "../indicators";

export function detectSmc(candles: Candle[]): SmcState {
  if (candles.length < 50) {
    return { bos: false, choch: false, sweep: false, fvg: false, orderBlock: false };
  }
  const closes = candles.map((c) => c.close);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const i = candles.length - 1;
  const c = candles[i];
  const prevHigh = Math.max(...candles.slice(i - 20, i).map((x) => x.high));
  const prevLow = Math.min(...candles.slice(i - 20, i).map((x) => x.low));
  const bos = c.close > prevHigh * 0.998 && e20[i] >= e50[i] * 0.998;
  const choch = candles[i - 1].close <= e50[i - 1] * 1.002 && c.close > e50[i] && c.close >= c.open;
  const sweep = c.low < prevLow && c.close > prevLow;
  const a = candles[i - 2];
  const b = candles[i - 1];
  const fvg = a.high < c.low || (a.high < b.low && c.close > b.close);
  const orderBlock = b.close < b.open && c.close > b.open && c.close > c.open;
  return { bos, choch, sweep, fvg, orderBlock };
}

/** SMC + BOS/CHOCH confluence. */
export function strategySmc(candles: Candle[]): StrategyVote {
  const smc = detectSmc(candles);
  const hits = [smc.bos, smc.choch, smc.sweep, smc.fvg, smc.orderBlock].filter(Boolean).length;
  const pass = hits >= 2 || ((smc.bos || smc.choch) && (smc.sweep || smc.orderBlock || smc.fvg));
  return {
    id: "smc",
    name: "SMC + BOS/CHOCH",
    pass,
    score: pass ? 85 + hits * 2 : hits * 15,
    detail: pass
      ? `BOS:${smc.bos} CHOCH:${smc.choch} Sweep:${smc.sweep} FVG:${smc.fvg} OB:${smc.orderBlock}`
      : "لا التقاء SMC كافٍ",
  };
}
