"use client";

import { useEffect, useState } from "react";

type TickerItem = { symbol: string; last: number; changePct: number };

export function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", { cache: "no-store" });
        const data = (await res.json()) as Array<{
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
        }>;
        if (cancelled || !Array.isArray(data)) return;
        const wanted = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];
        setItems(
          wanted
            .map((s) => data.find((d) => d.symbol === s))
            .filter(Boolean)
            .map((d) => ({
              symbol: d!.symbol.replace("USDT", ""),
              last: Number(d!.lastPrice),
              changePct: Number(d!.priceChangePercent),
            })),
        );
      } catch {
        /* ignore */
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="overflow-hidden border-b border-line bg-inset/80">
      <div className="flex animate-[ticker_28s_linear_infinite] gap-8 whitespace-nowrap px-4 py-2 text-xs">
        {[...items, ...items].map((t, i) => (
          <span key={`${t.symbol}-${i}`} className="inline-flex items-center gap-2">
            <span className="font-semibold text-gold-soft">{t.symbol}</span>
            <span className="font-mono text-fg">{t.last.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className={t.changePct >= 0 ? "text-teal" : "text-danger"}>
              {t.changePct >= 0 ? "+" : ""}
              {t.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
