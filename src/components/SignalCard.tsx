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
      className={`w-full rounded-xl border p-3 text-start transition ${
        active ? "border-gold bg-gold/10" : "border-line bg-surface hover:bg-raised"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-fg">{signal.base}/USDT</p>
          <p className="font-mono text-xs text-muted">{fmt(signal.last)}</p>
        </div>
        <div className="text-end">
          <p className="font-mono text-lg text-gold-soft">{signal.successRate}%</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">{signal.agreeCount}/5</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted">
        <span>قاع: {signal.bottomType}</span>
        <span>بعد: {signal.distanceFromBottomPct}%</span>
        <span>سيولة: {signal.liquidity.totalScore}</span>
        <span>شمعة: {signal.candlePattern}</span>
      </div>
    </button>
  );
}
