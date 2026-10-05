import type { Candle } from "./types";

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  if (!values.length) return out;
  const k = 2 / (period + 1);
  const n = Math.min(period, values.length);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) out[i] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out = new Array(closes.length).fill(50);
  if (closes.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atr(candles: Candle[], period = 14): number[] {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return ema(tr, period);
}

export function macd(closes: number[]) {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(line, 9);
  const hist = line.map((v, i) => v - signal[i]);
  return { line, signal, hist };
}

/** Wilder Parabolic SAR — dots that flip with trend and follow price. */
export function parabolicSar(candles: Candle[], step = 0.02, maxStep = 0.2): number[] {
  const n = candles.length;
  const out = new Array(n).fill(Number.NaN);
  if (n < 3) return out;

  let up = candles[1].close >= candles[0].close;
  let af = step;
  let ep = up ? candles[0].high : candles[0].low;
  let sar = up ? candles[0].low : candles[0].high;
  out[0] = sar;

  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1];
    const older = candles[i - 2] ?? prev;
    const c = candles[i];
    sar = sar + af * (ep - sar);

    if (up) {
      sar = Math.min(sar, prev.low, older.low);
      if (c.low < sar) {
        up = false;
        sar = ep;
        ep = c.low;
        af = step;
      } else if (c.high > ep) {
        ep = c.high;
        af = Math.min(maxStep, af + step);
      }
    } else {
      sar = Math.max(sar, prev.high, older.high);
      if (c.high > sar) {
        up = true;
        sar = ep;
        ep = c.high;
        af = step;
      } else if (c.low < ep) {
        ep = c.low;
        af = Math.min(maxStep, af + step);
      }
    }
    out[i] = sar;
  }
  return out;
}

export function lastFinite(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return 0;
}

export function roundPx(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  if (n >= 0.01) return Math.round(n * 1e6) / 1e6;
  return Number(n.toPrecision(6));
}
