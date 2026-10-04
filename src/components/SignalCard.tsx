"use client";

import type { SmartSignal } from "@/lib/types";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function SignalCard({
  signal,
  active,
  onSelect,
}: {
  signal: SmartSignal;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3 text-start transition ${
        active
          ? "border-gold bg-gradient-to-br from-gold/15 to-transparent shadow-[0_0_24px_rgba(212,160,23,0.12)]"
          : "border-line bg-surface hover:border-gold/40 hover:bg-raised"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-fg">{signal.base}/USDT</p>
          <p className="font-mono text-xs text-muted">{fmt(signal.last)}</p>
        </div>
        <div className="text-end">
          <p className="font-mono text-lg font-bold text-gold-soft">{signal.successRate}%</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">{signal.agreeCount}/4</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {signal.pillars.map((p) => (
          <span
            key={p.id}
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              p.pass ? "bg-teal/15 text-teal" : "bg-inset text-muted"
            }`}
          >
            {p.id === "candles"
              ? "شموع"
              : p.id === "indicators"
                ? "مؤشرات"
                : p.id === "peaks_zero"
                  ? "زيرو"
                  : "اختراق"}
          </span>
        ))}
      </div>
    </button>
  );
}
