import { NextResponse } from "next/server";
import { fetchBinanceTickers, fetchKlines } from "@/lib/market/binance";
import { detectCandlePattern } from "@/lib/strategies/candlesStrategy";
import type { CandlePattern } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export type LiveCandleHit = {
  symbol: string;
  base: string;
  price: number;
  changePct: number;
  strength: number;
  pattern: string;
  quoteVolume: number;
};

const PATTERN_AR: Record<CandlePattern, string> = {
  Hammer: "مطرقة",
  "Bullish Engulfing": "ابتلاع شرائي",
  "Morning Star": "نجمة الصباح",
  "Pin Bar": "Pin Bar",
  Doji: "دوجي",
  "Strong Bull": "شمعة قوية",
  Neutral: "صاعدة",
};

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

let cache: { key: string; at: number; universe: number; hits: LiveCandleHit[] } | null = null;
const TTL_MS = 18_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const interval = searchParams.get("interval") ?? "15m";
  const key = interval;
  const now = Date.now();
  if (cache && cache.key === key && now - cache.at < TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      universe: cache.universe,
      count: cache.hits.length,
      hits: cache.hits,
    });
  }

  try {
    const tickers = await fetchBinanceTickers({ minQuoteVolume: 0 });
    const scanned = await mapPool(tickers, 18, async (t) => {
      try {
        const candles = await fetchKlines(t.symbol, interval, 3, 4000);
        const c = candles.at(-1);
        if (!c || c.close <= c.open) return null;
        const range = Math.max(c.high - c.low, 1e-12);
        const strength = Math.round((Math.abs(c.close - c.open) / range) * 100);
        if (strength < 40) return null;
        const pattern = detectCandlePattern(candles);
        return {
          symbol: t.symbol,
          base: t.base,
          price: c.close,
          changePct: t.changePct,
          strength,
          pattern: PATTERN_AR[pattern],
          quoteVolume: t.quoteVolume,
        } satisfies LiveCandleHit;
      } catch {
        const range = Math.max(t.high - t.low, 1e-12);
        const bull = t.last > t.open;
        const strength = Math.round((Math.abs(t.last - t.open) / range) * 100);
        if (!bull || strength < 55) return null;
        return {
          symbol: t.symbol,
          base: t.base,
          price: t.last,
          changePct: t.changePct,
          strength,
          pattern: "صاعدة",
          quoteVolume: t.quoteVolume,
        } satisfies LiveCandleHit;
      }
    });

    const hits = scanned
      .filter((x): x is LiveCandleHit => x !== null)
      .sort((a, b) => b.strength - a.strength || b.changePct - a.changePct)
      .slice(0, 60);

    cache = { key, at: Date.now(), universe: tickers.length, hits };
    return NextResponse.json({
      ok: true,
      cached: false,
      universe: tickers.length,
      count: hits.length,
      hits,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "candle scan failed", hits: [] },
      { status: 500 },
    );
  }
}
