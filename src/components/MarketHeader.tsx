"use client";

import Image from "next/image";
import { Radio, RefreshCw } from "lucide-react";
import { CHART_FRAMES } from "@/lib/market/frames";

export function MarketHeader({
  email,
  interval,
  onInterval,
  loading,
  onRefresh,
  live,
  version = "1.0.0",
}: {
  email: string;
  interval: string;
  onInterval: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
  live: boolean;
  version?: string;
}) {
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
              live ? "border-teal bg-teal/15 text-teal" : "border-danger bg-danger/15 text-danger"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "bg-teal" : "bg-danger"}`} />
            <Radio size={12} />
            {live ? "على الهواء" : "منقطع"}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm hover:border-gold"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            مسح السوق
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
