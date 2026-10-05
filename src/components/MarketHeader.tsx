"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Play, Radio, RefreshCw, Square } from "lucide-react";
import { CHART_FRAMES } from "@/lib/market/frames";
import { SCAN_EVERY_OPTIONS, type ScanEveryId } from "@/hooks/useMarketScan";

export function MarketHeader({
  email,
  interval,
  onInterval,
  loading,
  onRefresh,
  live,
  running,
  onStart,
  onStop,
  scanEvery,
  onScanEvery,
  nextScanAt,
  version = "1.0.0",
}: {
  email: string;
  interval: string;
  onInterval: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
  live: boolean;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  scanEvery: ScanEveryId;
  onScanEvery: (v: ScanEveryId) => void;
  nextScanAt: number | null;
  version?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running || nextScanAt == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [running, nextScanAt]);

  const onAir = running && live;
  const nextIn =
    running && nextScanAt != null
      ? Math.max(0, Math.ceil((nextScanAt - Date.now()) / 60_000))
      : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-xl">
      <div className="flex w-full flex-wrap items-center gap-3 px-3 py-2">
        <div className="flex items-center gap-3">
          <Image src="/icon-192.png" alt="Million Deal" width={40} height={40} className="rounded-xl" />
          <div>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-gold uppercase">Million Deal</p>
            <h1 className="text-base font-bold text-fg md:text-lg">صفقة المليون · مكتب التداول</h1>
          </div>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="flex max-w-full flex-wrap items-center gap-1 rounded-full border border-line bg-inset p-1">
            {CHART_FRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onInterval(tf)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  interval === tf ? "bg-gold text-bg" : "text-muted hover:text-fg"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              onAir ? "border-teal bg-teal/15 text-teal" : "border-danger bg-danger/15 text-danger"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${onAir ? "bg-teal animate-pulse" : "bg-danger"}`} />
            <Radio size={12} />
            {running ? (onAir ? "على الهواء" : loading ? "يتصل…" : "منقطع") : "متوقف"}
          </span>

          <div className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-inset p-1">
            <span className="px-1.5 text-[10px] text-muted">كل</span>
            {SCAN_EVERY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onScanEvery(opt.id)}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  scanEvery === opt.id ? "bg-teal text-bg" : "text-muted hover:text-fg"
                }`}
                title={`مسح تلقائي كل ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onStart}
            disabled={running}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              running
                ? "cursor-not-allowed border-line text-muted opacity-50"
                : "border-teal/50 bg-teal/15 text-teal hover:border-teal"
            }`}
          >
            <Play size={14} />
            تشغيل
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={!running}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              !running
                ? "cursor-not-allowed border-line text-muted opacity-50"
                : "border-danger/50 bg-danger/15 text-danger hover:border-danger"
            }`}
          >
            <Square size={14} />
            إيقاف
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm hover:border-gold disabled:opacity-50"
            title={nextIn != null ? `المسح التالي خلال ~${nextIn} د` : "مسح فوري"}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            مسح السوق
            {running && nextIn != null ? (
              <span className="text-[10px] text-muted">· {nextIn}د</span>
            ) : null}
          </button>

          <a href="/admin" className="rounded-full border border-gold/40 px-3 py-1.5 text-sm text-gold">
            المالك
          </a>
          <span className="hidden font-mono text-[11px] text-gold lg:inline">v{version}</span>
          <span className="hidden text-xs text-muted lg:inline">{email}</span>
        </div>
      </div>
    </header>
  );
}
