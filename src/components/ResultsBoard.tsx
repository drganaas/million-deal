"use client";

import type { SmartSignal } from "@/lib/types";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function ResultsBoard({
  rows,
  onShow,
}: {
  rows: SmartSignal[];
  onShow: (symbol: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-inset text-left text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2">العملة</th>
            <th className="px-3 py-2">الدخول</th>
            <th className="px-3 py-2">TP1 / TP2 / TP3</th>
            <th className="px-3 py-2">SL</th>
            <th className="px-3 py-2">نجاح</th>
            <th className="px-3 py-2">القاع</th>
            <th className="px-3 py-2">الشمعة</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-line/70">
              <td className="px-3 py-2 font-semibold">{row.base}</td>
              <td className="px-3 py-2 font-mono">{fmt(row.entry)}</td>
              <td className="px-3 py-2 font-mono text-teal">
                {fmt(row.tp1)} · {fmt(row.tp2)} · {fmt(row.tp3)}
              </td>
              <td className="px-3 py-2 font-mono text-danger">{fmt(row.sl)}</td>
              <td className="px-3 py-2 font-mono text-gold-soft">{row.successRate}%</td>
              <td className="px-3 py-2">{row.bottomType}</td>
              <td className="px-3 py-2">{row.candlePattern}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-bg"
                  onClick={() => onShow(row.symbol)}
                >
                  عرض على الشارت
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted">
                لا عملات في بداية صعود مؤكدة حالياً (أقل من 3/5 استراتيجيات)
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
