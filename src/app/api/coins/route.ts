import { NextResponse } from "next/server";
import { fetchBinanceTickers } from "@/lib/market/binance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let cache: { at: number; coins: Array<{ symbol: string; base: string; changePct: number; quoteVolume: number }> } | null =
  null;
const TTL_MS = 60_000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const limit = Math.min(40, Math.max(5, Number(searchParams.get("limit") ?? 20) || 20));

    const now = Date.now();
    if (!cache || now - cache.at > TTL_MS) {
      const tickers = await fetchBinanceTickers();
      cache = {
        at: now,
        coins: tickers.map((t) => ({
          symbol: t.symbol,
          base: t.base,
          changePct: t.changePct,
          quoteVolume: t.quoteVolume,
        })),
      };
    }

    let list = cache.coins;
    if (q) {
      const qUsdt = q.endsWith("USDT") ? q : `${q}USDT`;
      list = list.filter(
        (c) =>
          c.symbol === qUsdt ||
          c.base.startsWith(q) ||
          c.symbol.startsWith(q) ||
          c.base.includes(q),
      );
      list.sort((a, b) => {
        const aExact = a.symbol === qUsdt || a.base === q ? 0 : a.base.startsWith(q) ? 1 : 2;
        const bExact = b.symbol === qUsdt || b.base === q ? 0 : b.base.startsWith(q) ? 1 : 2;
        if (aExact !== bExact) return aExact - bExact;
        return b.quoteVolume - a.quoteVolume;
      });
    }

    return NextResponse.json({
      ok: true,
      count: list.length,
      coins: list.slice(0, limit),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "coins_failed", coins: [] },
      { status: 500 },
    );
  }
}
