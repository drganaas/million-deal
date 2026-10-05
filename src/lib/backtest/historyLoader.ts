import type { Candle } from "../types";
import type { HistoryBundle } from "./types";

const BINANCE = "https://data-api.binance.vision";

export class CancelledError extends Error {
  constructor(message = "أوقفه المستخدم") {
    super(message);
    this.name = "CancelledError";
  }
}

async function fetchPage(
  symbol: string,
  interval: string,
  endTime?: number,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: "1000",
  });
  if (endTime) params.set("endTime", String(endTime));
  const res = await fetch(`${BINANCE}/api/v3/klines?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Binance ${res.status} ${symbol} ${interval}`);
  const raw = (await res.json()) as unknown[];
  return raw.map((row) => {
    const r = row as (string | number)[];
    return {
      time: Math.floor(Number(r[0]) / 1000),
      open: +r[1],
      high: +r[2],
      low: +r[3],
      close: +r[4],
      volume: +r[5],
    };
  });
}

/**
 * Load ~`years` of OHLCV by paging Binance klines (max 1000/req).
 * When maxBars is set (e.g. 1500 for optimize), stop early after enough bars.
 */
export async function loadHistoricalCandles(
  symbol: string,
  interval: "1h" | "4h" | "1d",
  years = 3,
  onProgress?: (msg: string) => void,
  shouldCancel?: () => boolean,
  maxBars?: number,
): Promise<Candle[]> {
  const msPerBar =
    interval === "1h" ? 3_600_000 : interval === "4h" ? 14_400_000 : 86_400_000;
  const targetBars = maxBars
    ? maxBars
    : Math.ceil((years * 365.25 * 24 * 3_600_000) / msPerBar);
  const maxPages = Math.min(40, Math.ceil(targetBars / 900) + 2);

  let endTime: number | undefined;
  const chunks: Candle[][] = [];
  for (let page = 0; page < maxPages; page++) {
    if (shouldCancel?.()) throw new CancelledError();
    const batch = await fetchPage(symbol, interval, endTime);
    if (!batch.length) break;
    chunks.push(batch);
    endTime = batch[0].time * 1000 - 1;
    const loaded = chunks.reduce((a, c) => a + c.length, 0);
    onProgress?.(`${symbol} ${interval} · صفحة ${page + 1}/${maxPages} (${loaded} شمعة)`);
    if (batch.length < 1000) break;
    if (maxBars && loaded >= maxBars + 50) break;
    await new Promise((r) => setTimeout(r, 35));
  }

  const map = new Map<number, Candle>();
  for (const chunk of chunks.reverse()) {
    for (const c of chunk) map.set(c.time, c);
  }
  let all = Array.from(map.values()).sort((a, b) => a.time - b.time);
  if (maxBars && all.length > maxBars) all = all.slice(-maxBars);
  return all;
}

export const OPTIMIZE_UNIVERSE = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "MATICUSDT",
  "NEARUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "INJUSDT",
  "ATOMUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "FILUSDT",
  "RENDERUSDT",
  "FETUSDT",
  "PEPEUSDT",
  "WIFUSDT",
  "TIAUSDT",
  "SEIUSDT",
  "ORDIUSDT",
  "TONUSDT",
] as const;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!, idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

export async function loadOptimizeDataset(
  years = 3,
  intervals: Array<"1h" | "4h" | "1d"> = ["1h"],
  symbols: readonly string[] = OPTIMIZE_UNIVERSE,
  onProgress?: (msg: string) => void,
  shouldCancel?: () => boolean,
  maxBars = 1500,
): Promise<HistoryBundle[]> {
  type Job = { symbol: string; interval: "1h" | "4h" | "1d" };
  // Optimize path: force 1h only (per anti-overfit redesign)
  const useIntervals = intervals.includes("1h") ? (["1h"] as const) : intervals;
  const jobs: Job[] = [];
  for (const symbol of symbols) {
    for (const interval of useIntervals) jobs.push({ symbol, interval });
  }

  let done = 0;
  const results = await mapPool(jobs, 3, async (job) => {
    if (shouldCancel?.()) throw new CancelledError();
    try {
      const candles = await loadHistoricalCandles(
        job.symbol,
        job.interval,
        years,
        (msg) => {
          onProgress?.(`تحميل ${done + 1}/${jobs.length} · ${msg}`);
        },
        shouldCancel,
        job.interval === "1h" ? maxBars : undefined,
      );
      done += 1;
      onProgress?.(
        `تحميل ${done}/${jobs.length} · اكتمل ${job.symbol} ${job.interval} (${candles.length} شمعة)`,
      );
      if (candles.length >= 200) {
        return { symbol: job.symbol, interval: job.interval, candles } satisfies HistoryBundle;
      }
      return null;
    } catch (e) {
      if (e instanceof CancelledError) throw e;
      done += 1;
      onProgress?.(
        `تحميل ${done}/${jobs.length} · تخطي ${job.symbol} ${job.interval}: ${e instanceof Error ? e.message : "err"}`,
      );
      return null;
    }
  });

  return results.filter((b): b is HistoryBundle => b !== null);
}
