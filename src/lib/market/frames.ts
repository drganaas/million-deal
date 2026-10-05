/** فريمات الشارت فقط — البحث التلقائي لا يستخدم هذه القائمة. */
export const CHART_FRAMES = [
  "1s",
  "5s",
  "15s",
  "30s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
  "1y",
] as const;

export type ChartFrame = (typeof CHART_FRAMES)[number];

export const BINANCE_KLINE_INTERVALS = new Set([
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

export function toBinanceKlineInterval(interval: string): { interval: string; limit?: number } {
  return { interval };
}
