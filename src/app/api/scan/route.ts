import { NextResponse } from "next/server";
import { calculateSmartEntry } from "@/lib/strategies/calculateSmartEntry";
import { fetchBinanceTickers, fetchDepth, fetchKlines } from "@/lib/market/binance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(40, Number(searchParams.get("limit") ?? 28) || 28);
  const interval = searchParams.get("interval") ?? "15m";

  try {
    const { refreshActiveGenome } = await import("@/lib/backtest/activeGenome");
    await refreshActiveGenome();
  } catch {
    /* optional genome */
  }

  try {
    const tickers = await fetchBinanceTickers();
    const universe = tickers.slice(0, limit);

    const scanned = await mapPool(universe, 6, async (ticker) => {
      try {
        const [candles, liquidity] = await Promise.all([
          fetchKlines(ticker.symbol, interval, 120),
          fetchDepth(ticker.symbol, 50),
        ]);
        return calculateSmartEntry({
          symbol: ticker.symbol,
          candles,
          last: ticker.last,
          changePct: ticker.changePct,
          quoteVolume: ticker.quoteVolume,
          liquidity,
        });
      } catch {
        return null;
      }
    });

    const signals = scanned
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (a.distanceFromBottomPct !== b.distanceFromBottomPct) {
          return a.distanceFromBottomPct - b.distanceFromBottomPct;
        }
        if (b.liquidity.totalScore !== a.liquidity.totalScore) {
          return b.liquidity.totalScore - a.liquidity.totalScore;
        }
        return b.volumeRatio - a.volumeRatio;
      });

    return NextResponse.json({ ok: true, count: signals.length, signals });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "scan failed" },
      { status: 500 },
    );
  }
}
