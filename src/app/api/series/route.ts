import { NextResponse } from "next/server";
import { fetchKlines, fetchDepth, fetchSecondaryPrice, fetchCoinGeckoMeta } from "@/lib/market/binance";
import { calculateSmartEntry } from "@/lib/strategies/calculateSmartEntry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  const interval = searchParams.get("interval") ?? "15m";

  try {
    const [candles, liquidity, secondary] = await Promise.all([
      fetchKlines(symbol, interval, 150),
      fetchDepth(symbol, 50),
      fetchSecondaryPrice(symbol),
    ]);
    const last = secondary ?? candles.at(-1)?.close ?? 0;
    const signal = calculateSmartEntry({
      symbol,
      candles,
      last,
      liquidity,
      quoteVolume: 0,
    });
    const gecko = await fetchCoinGeckoMeta(symbol.replace(/USDT$/i, ""));
    return NextResponse.json({ ok: true, candles, signal, liquidity, secondary, gecko });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "series failed" },
      { status: 500 },
    );
  }
}
