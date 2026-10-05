"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveCandleHit = {
  symbol: string;
  base: string;
  price: number;
  changePct: number;
  strength: number;
  pattern: string;
  quoteVolume: number;
};

const WS_URLS = [
  "wss://stream.binance.com:9443/ws/!miniTicker@arr",
  "wss://data-stream.binance.vision/ws/!miniTicker@arr",
  "wss://stream.binance.com:443/ws/!miniTicker@arr",
];

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
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(open)) return null;
  if (last <= open) return null;
  const range = Math.max(high - low, Math.abs(last - open), 1e-12);
  return {
    symbol,
    base: symbol.slice(0, -4),
    price: last,
    changePct: open > 0 ? ((last - open) / open) * 100 : 0,
    strength: Math.min(100, Math.round((Math.abs(last - open) / range) * 100)),
    pattern: "صاعدة",
    quoteVolume: Number(row.q) || 0,
  };
}

export function useCandleScan() {
  const [hits, setHits] = useState<LiveCandleHit[]>([]);
  const [universe, setUniverse] = useState(0);
  const [live, setLive] = useState(false);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastMsg = useRef(0);
  const urlIndex = useRef(0);

  const applyHits = useCallback((next: LiveCandleHit[], uni: number) => {
    setHits(next);
    setUniverse(uni);
  }, []);

  const fetchRest = useCallback(async () => {
    if (!runningRef.current) return;
    try {
      const res = await fetch("/api/candles/scan", { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        hits?: LiveCandleHit[];
        universe?: number;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "scan failed");
      if (!runningRef.current) return;
      applyHits(data.hits ?? [], data.universe ?? 0);
      setError(null);
      if (Date.now() - lastMsg.current > 8_000) setLive(false);
    } catch (e) {
      if (runningRef.current) setError(e instanceof Error ? e.message : "scan failed");
    }
  }, [applyHits]);

  const disconnectWs = useCallback(() => {
    if (retryRef.current != null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const connectWs = useCallback(() => {
    if (!runningRef.current) return;
    disconnectWs();
    const url = WS_URLS[urlIndex.current % WS_URLS.length]!;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      urlIndex.current += 1;
      retryRef.current = window.setTimeout(connectWs, 1500);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!runningRef.current) return;
      setError(null);
    };

    ws.onmessage = (ev) => {
      if (!runningRef.current) return;
      try {
        const raw = JSON.parse(ev.data as string) as MiniTicker[];
        if (!Array.isArray(raw)) return;
        lastMsg.current = Date.now();
        setLive(true);
        const usdt = raw.filter((r) => typeof r?.s === "string" && r.s.endsWith("USDT"));
        applyHits(
          usdt
            .map(analyze)
            .filter((x): x is LiveCandleHit => x !== null)
            .sort((a, b) => b.strength - a.strength || b.changePct - a.changePct),
          usdt.length,
        );
        setError(null);
      } catch {
        /* ignore parse */
      }
    };

    ws.onerror = () => {
      if (runningRef.current) setError("binance ws error");
    };

    ws.onclose = () => {
      setLive(false);
      if (!runningRef.current) return;
      urlIndex.current += 1;
      retryRef.current = window.setTimeout(connectWs, 1200);
    };
  }, [applyHits, disconnectWs]);

  const start = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    setError(null);
    urlIndex.current = 0;
    connectWs();
    void fetchRest();
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (!runningRef.current) return;
      if (Date.now() - lastMsg.current > 6_000) void fetchRest();
    }, 8_000);
  }, [connectWs, fetchRest]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setLive(false);
    disconnectWs();
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [disconnectWs]);

  useEffect(() => {
    start();
    const watchdog = window.setInterval(() => {
      if (!runningRef.current) return;
      if (Date.now() - lastMsg.current > 8_000) setLive(false);
    }, 2000);
    return () => {
      runningRef.current = false;
      window.clearInterval(watchdog);
      if (pollRef.current != null) window.clearInterval(pollRef.current);
      disconnectWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { hits, universe, live, running, error, start, stop };
}
