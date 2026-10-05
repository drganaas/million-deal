import { NextResponse } from "next/server";
import { fetchBinanceTickers } from "@/lib/market/binance";

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

let cache: { at: number; universe: number; hits: LiveCandleHit[] } | null = null;
const TTL_MS = 4_000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      live: true,
      source: "binance",
      universe: cache.universe,
      count: cache.hits.length,
      hits: cache.hits,
    });
  }

  try {
    const tickers = await fetchBinanceTickers({ minQuoteVolume: 0 });
    const hits = tickers
      .filter((t) => t.last > t.open)
      .map((t) => {
        const range = Math.max(t.high - t.low, 1e-12);
        const strength = Math.round((Math.abs(t.last - t.open) / range) * 100);
        return {
          symbol: t.symbol,
          base: t.base,
          price: t.last,
          changePct: t.changePct,
          strength,
          pattern: "صاعدة",
          quoteVolume: t.quoteVolume,
        } satisfies LiveCandleHit;
      })
      .sort((a, b) => b.strength - a.strength || b.changePct - a.changePct);

    cache = { at: Date.now(), universe: tickers.length, hits };
    return NextResponse.json({
      ok: true,
      cached: false,
      live: true,
      source: "binance",
      universe: tickers.length,
      count: hits.length,
      hits,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, live: false, error: error instanceof Error ? error.message : "candle scan failed", hits: [] },
      { status: 500 },
    );
  }
}
