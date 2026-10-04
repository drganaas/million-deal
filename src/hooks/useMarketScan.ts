"use client";

import { useCallback, useEffect, useState } from "react";
import type { SmartSignal } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function useMarketScan(interval = "15m") {
  const setSignals = useAppStore((s) => s.setSignals);
  const setLoading = useAppStore((s) => s.setLoading);
  const setAlert = useAppStore((s) => s.setAlert);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scan?interval=${interval}&limit=28`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; signals?: SmartSignal[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "scan failed");
      const rows = data.signals ?? [];
      setSignals(rows);
      const strong = rows.find((r) => r.successRate >= 90);
      if (strong) {
        setAlert(`بداية صعود مؤكدة: ${strong.base} · نجاح ${strong.successRate}%`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [interval, setAlert, setLoading, setSignals]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { refresh, error };
}
