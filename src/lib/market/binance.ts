import type { Candle, DepthLevel, LiquidityInfo } from "../types";

const BINANCE = "https://data-api.binance.vision";
const BYBIT = "https://api.bybit.com";
const OKX = "https://www.okx.com";
const COINGECKO = "https://api.coingecko.com/api/v3";

export type Ticker = {
  symbol: string;
  base: string;
  last: number;
  open: number;
  changePct: number;
  high: number;
  low: number;
  quoteVolume: number;
};

const LEVERAGED = /UP|DOWN|BULL|BEAR/;
const STABLES = /^(USDC|FDUSD|TUSD|BUSD|DAI|USDE|USD1|USDP|USDD|AEUR|EURI|USDT|PAXG|XAUT)$/;

async function getJson<T>(url: string, timeout = 12000): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeout),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchBinanceTickers(opts?: { minQuoteVolume?: number }): Promise<Ticker[]> {
  const minVol = opts?.minQuoteVolume ?? 2_000_000;
  const raw = await getJson<
    Array<{
      symbol: string;
      lastPrice: string;
      openPrice: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      quoteVolume: string;
    }>
  >(`${BINANCE}/api/v3/ticker/24hr`);

  return raw
    .map((row) => {
      if (!row.symbol.endsWith("USDT")) return null;
      const base = row.symbol.slice(0, -4);
      if (LEVERAGED.test(base) || STABLES.test(base)) return null;
      const last = +row.lastPrice;
      const quoteVolume = +row.quoteVolume;
      if (!Number.isFinite(last) || last <= 0 || quoteVolume < minVol) return null;
      if (last > 0.95 && last < 1.05 && /USD|DAI|EUR/.test(base)) return null;
      return {
        symbol: row.symbol,
        base,
        last,
        open: +row.openPrice,
        changePct: +row.priceChangePercent,
        high: +row.highPrice,
        low: +row.lowPrice,
        quoteVolume,
      } satisfies Ticker;
    })
    .filter((t): t is Ticker => t !== null)
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

export async function fetchKlines(
  symbol: string,
  interval = "15m",
  limit = 120,
  timeout = 12000,
): Promise<Candle[]> {
  const raw = await getJson<(string | number)[][]>(
    `${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    timeout,
  );
  return raw.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: +row[1],
    high: +row[2],
    low: +row[3],
    close: +row[4],
    volume: +row[5],
  }));
}

export async function fetchDepth(symbol: string, limit = 50): Promise<LiquidityInfo> {
  try {
    const raw = await getJson<{ bids: string[][]; asks: string[][] }>(
      `${BINANCE}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    );
    const sum = (levels: string[][]) =>
      levels.reduce((acc, [p, q]) => acc + Number(p) * Number(q), 0);
    const bidDepth = sum(raw.bids);
    const askDepth = sum(raw.asks);
    const total = bidDepth + askDepth;
    const imbalance = total ? bidDepth / total : 0.5;
    const totalScore = Math.max(0, Math.min(100, Math.round(Math.log10(total + 1) * 12 + imbalance * 25)));
    return { bidDepth, askDepth, totalScore };
  } catch {
    return { bidDepth: 0, askDepth: 0, totalScore: 0 };
  }
}

export async function fetchSecondaryPrice(symbol: string): Promise<number | null> {
  const base = symbol.replace(/USDT$/i, "");
  try {
    const bybit = await getJson<{ result?: { list?: Array<{ lastPrice?: string }> } }>(
      `${BYBIT}/v5/market/tickers?category=spot&symbol=${base}USDT`,
    );
    const p = Number(bybit.result?.list?.[0]?.lastPrice);
    if (Number.isFinite(p) && p > 0) return p;
  } catch {
    /* fallback */
  }
  try {
    const okx = await getJson<{ data?: Array<{ last?: string }> }>(
      `${OKX}/api/v5/market/ticker?instId=${base}-USDT`,
    );
    const p = Number(okx.data?.[0]?.last);
    if (Number.isFinite(p) && p > 0) return p;
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchCoinGeckoMeta(base: string) {
  try {
    const search = await getJson<{ coins?: Array<{ id: string; symbol: string }> }>(
      `${COINGECKO}/search?query=${encodeURIComponent(base)}`,
    );
    const id = search.coins?.find((c) => c.symbol.toLowerCase() === base.toLowerCase())?.id;
    if (!id) return null;
    const coin = await getJson<{
      market_data?: { ath?: { usd?: number }; atl?: { usd?: number }; market_cap?: { usd?: number } };
    }>(`${COINGECKO}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
    return {
      ath: coin.market_data?.ath?.usd ?? null,
      atl: coin.market_data?.atl?.usd ?? null,
      marketCap: coin.market_data?.market_cap?.usd ?? null,
    };
  } catch {
    return null;
  }
}

export function binanceWsUrl(streams: string[]) {
  // Combined stream endpoint
  return `wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`;
}

export type WsTrade = { symbol: string; price: number; qty: number; time: number };

export function parseDepthLevels(raw: string[][]): DepthLevel[] {
  return raw.map(([price, qty]) => ({ price: Number(price), qty: Number(qty) }));
}
