"use client";

import { useEffect, useRef } from "react";
import { binanceWsUrl } from "@/lib/market/binance";

export function useBinanceTicker(symbol: string, onPrice: (price: number) => void) {
  const cb = useRef(onPrice);
  cb.current = onPrice;

  useEffect(() => {
    if (!symbol) return;
    const stream = `${symbol.toLowerCase()}@trade`;
    const ws = new WebSocket(binanceWsUrl([stream]));
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data as string) as {
          data?: { p?: string; s?: string };
        };
        const price = Number(payload.data?.p);
        if (Number.isFinite(price) && price > 0) cb.current(price);
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [symbol]);
}
