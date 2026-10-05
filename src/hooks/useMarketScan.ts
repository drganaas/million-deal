"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SmartSignal } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

/** فترات المسح التلقائي (الفرق الزمني بين كل مسح) */
export const SCAN_EVERY_OPTIONS = [
  { id: "1m", label: "1د", ms: 60_000 },
  { id: "5m", label: "5د", ms: 5 * 60_000 },
  { id: "15m", label: "15د", ms: 15 * 60_000 },
  { id: "30m", label: "30د", ms: 30 * 60_000 },
  { id: "1h", label: "1س", ms: 60 * 60_000 },
  { id: "2h", label: "2س", ms: 2 * 60 * 60_000 },
  { id: "4h", label: "4س", ms: 4 * 60 * 60_000 },
] as const;

export type ScanEveryId = (typeof SCAN_EVERY_OPTIONS)[number]["id"];

function everyMs(id: ScanEveryId): number {
  return SCAN_EVERY_OPTIONS.find((o) => o.id === id)?.ms ?? 15 * 60_000;
}

export function useMarketScan(candleInterval = "15m") {
  const setSignals = useAppStore((s) => s.setSignals);
  const setLoading = useAppStore((s) => s.setLoading);
  const setAlert = useAppStore((s) => s.setAlert);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [live, setLive] = useState(false);
  const [scanEvery, setScanEveryState] = useState<ScanEveryId>("15m");
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [nextScanAt, setNextScanAt] = useState<number | null>(null);

  const runningRef = useRef(true);
  const scanEveryRef = useRef<ScanEveryId>("15m");
  const candleIntervalRef = useRef(candleInterval);
  const timerRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const runScanRef = useRef<() => Promise<void>>(async () => undefined);
  const scheduleRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    candleIntervalRef.current = candleInterval;
  }, [candleInterval]);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runScan = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scan?interval=${encodeURIComponent(candleIntervalRef.current)}&limit=28`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as { ok: boolean; signals?: SmartSignal[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "scan failed");
      const rows = data.signals ?? [];
      setSignals(rows);
      const now = Date.now();
      setLastScanAt(now);
      if (runningRef.current) {
        setLive(true);
        setNextScanAt(now + everyMs(scanEveryRef.current));
      }
      const strong = rows.find((r) => r.successRate >= 70);
      if (strong) {
        setAlert(`بداية صعود مؤكدة: ${strong.base} · نجاح ${strong.successRate}%`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      if (runningRef.current) setLive(false);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [setAlert, setLoading, setSignals]);

  const scheduleNext = useCallback(() => {
    clearTimer();
    if (!runningRef.current) return;
    const delay = everyMs(scanEveryRef.current);
    setNextScanAt(Date.now() + delay);
    timerRef.current = window.setTimeout(() => {
      void (async () => {
        if (!runningRef.current) return;
        await runScanRef.current();
        if (runningRef.current) scheduleRef.current();
      })();
    }, delay);
  }, [clearTimer]);

  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  useEffect(() => {
    scheduleRef.current = scheduleNext;
  }, [scheduleNext]);

  const refresh = useCallback(async () => {
    await runScan();
    if (runningRef.current) scheduleNext();
  }, [runScan, scheduleNext]);

  const start = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    setError(null);
    void (async () => {
      await runScan();
      if (runningRef.current) scheduleNext();
    })();
  }, [runScan, scheduleNext]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setLive(false);
    setNextScanAt(null);
    clearTimer();
  }, [clearTimer]);

  const setScanEvery = useCallback(
    (id: ScanEveryId) => {
      scanEveryRef.current = id;
      setScanEveryState(id);
      if (runningRef.current) scheduleNext();
    },
    [scheduleNext],
  );

  useEffect(() => {
    start();
    return () => {
      runningRef.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    refresh,
    error,
    running,
    live,
    scanEvery,
    setScanEvery,
    lastScanAt,
    nextScanAt,
    start,
    stop,
  };
}
