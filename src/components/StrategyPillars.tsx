"use client";

import type { StrategyVote } from "@/lib/types";
import { CandlestickChart, LineChart, Mountain, TrendingUp } from "lucide-react";

const ICONS = {
  candles: CandlestickChart,
  indicators: LineChart,
  peaks_zero: Mountain,
  breakout: TrendingUp,
} as const;

export function StrategyPillars({ pillars }: { pillars: StrategyVote[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {pillars.map((p) => {
        const Icon = ICONS[p.id as keyof typeof ICONS] ?? TrendingUp;
        return (
          <div
            key={p.id}
            className={`rounded-2xl border p-4 transition ${
              p.pass
                ? "border-teal/40 bg-gradient-to-br from-teal/15 to-transparent"
                : "border-line bg-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-xl ${
                    p.pass ? "bg-teal/20 text-teal" : "bg-inset text-muted"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">{p.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">درجة {p.score}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  p.pass ? "bg-teal/20 text-teal" : "bg-inset text-muted"
                }`}
              >
                {p.pass ? "مفعلة" : "مغلقة"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{p.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
