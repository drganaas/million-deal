"use client";

import { useEffect, useRef, useState } from "react";

export type LiveCandleHit = {
  symbol: string;
  base: string;
  price: number;
  changePct: number;
  strength: number;
  pattern: string;
  quoteVolume: number;
};

const WS_URL = "wss://stream.binance.com:9443/ws/!miniTicker@arr";

type MiniTicker = {
  s: string;
  c: string;
  o: string;
  h: string;
  l: string;
  q?: string;
};

function analyze(row: MiniTicker): LiveCandleHit | null {
  const symbol = row.s;
  if (!symbol.endsWith("USDT")) return null;
  const last = Number(row.c);
  const open = Number(row.o);
  const high = Number(row.h);
  const low = Number(row.l);
  if (!Number.isFinite(last) || last <= 0) return null;
  if (last <= open) return null;
  const range = Math.max(high - low, 1e-12);
  return {
    symbol,
    base: symbol.slice(0, -4),
    price: last,
    changePct: open > 0 ? ((last - open) / open) * 100 : 0,
    strength: Math.round((Math.abs(last - open) / range) * 100),
    pattern: "صاعدة",
    quoteVolume: Number(row.q) || 0,
  };
}

export function useCandleScan() {
  const [hits, setHits] = useState<LiveCandleHit[]>([]);
  const [universe, setUniverse] = useState(0);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = useRef(false);
  const lastMsg = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    closed.current = false;
    let retry: number | null = null;

    function connect() {
      if (closed.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!closed.current) setError(null);
      };

      ws.onmessage = (ev) => {
        if (closed.current) return;
        try {
          const raw = JSON.parse(ev.data as string) as MiniTicker[];
          if (!Array.isArray(raw)) return;
          lastMsg.current = Date.now();
          setLive(true);
          const usdt = raw.filter((r) => typeof r.s === "string" && r.s.endsWith("USDT"));
          setUniverse(usdt.length);
          setHits(
            usdt
              .map(analyze)
              .filter((x): x is LiveCandleHit => x !== null)
              .sort((a, b) => b.strength - a.strength || b.changePct - a.changePct),
          );
        } catch {
          /* ignore parse */
        }
      };

      ws.onerror = () => {
        if (!closed.current) setError("binance ws error");
      };

      ws.onclose = () => {
        if (closed.current) return;
        setLive(false);
        retry = window.setTimeout(connect, 1500);
      };
    }

    connect();

    const watchdog = window.setInterval(() => {
      if (closed.current) return;
      if (Date.now() - lastMsg.current > 8_000) setLive(false);
    }, 2000);

    return () => {
      closed.current = true;
      if (retry != null) window.clearTimeout(retry);
      window.clearInterval(watchdog);
      wsRef.current?.close();
      wsRef.current = null;
      setLive(false);
    };
  }, []);

  return { hits, universe, live, error };
}
