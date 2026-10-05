"use client";

import { useCallback, useEffect, useState } from "react";

export type LiveCandleHit = {
  symbol: string;
  base: string;
  price: number;
  changePct: number;
  strength: number;
  pattern: string;
  quoteVolume: number;
};

export function useCandleScan(interval: string) {
  const [hits, setHits] = useState<LiveCandleHit[]>([]);
  const [universe, setUniverse] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candles/scan?interval=${encodeURIComponent(interval)}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        hits?: LiveCandleHit[];
        universe?: number;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "scan failed");
      setHits(data.hits ?? []);
      setUniverse(data.universe ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setBusy(false);
    }
  }, [interval]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { hits, universe, busy, error, refresh };
}
