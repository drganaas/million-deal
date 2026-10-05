"use client";

import { Eye } from "lucide-react";
import type { SmartSignal } from "@/lib/types";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex min-w-[1.6rem] justify-center rounded px-1 py-0.5 text-[10px] font-bold ${
        ok ? "bg-teal/20 text-teal" : "bg-inset text-muted"
      }`}
      title={label}
    >
      {ok ? "✓" : "×"}
    </span>
  );
}

export function ResultsBoard({
  rows,
  selected,
  watchlist,
  onShow,
  onWatch,
}: {
  rows: SmartSignal[];
  selected?: string;
  watchlist: string[];
  onShow: (symbol: string) => void;
  onWatch: (symbol: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[0_0_0_1px_rgba(212,160,23,0.06)]">
      <table className="min-w-full text-sm">
        <thead className="bg-inset/90 text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-3 text-start">العملة</th>
            <th className="px-3 py-3 text-start">شموع</th>
            <th className="px-3 py-3 text-start">مؤشرات</th>
            <th className="px-3 py-3 text-start">قمم/زيرو</th>
            <th className="px-3 py-3 text-start">اختراق</th>
            <th className="px-3 py-3 text-start">الدخول</th>
            <th className="px-3 py-3 text-start">TP1 / TP2 / TP3</th>
            <th className="px-3 py-3 text-start">SL</th>
            <th className="px-3 py-3 text-start">نجاح</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const byId = Object.fromEntries(row.pillars.map((p) => [p.id, p]));
            return (
              <tr
                key={row.symbol}
                className={`border-t border-line/70 transition ${
                  selected === row.symbol ? "bg-gold/10" : "hover:bg-raised/50"
                }`}
              >
                <td className="px-3 py-3">
                  <p className="font-semibold">{row.base}</p>
                  <p className={`font-mono text-[11px] ${row.changePct >= 0 ? "text-teal" : "text-danger"}`}>
                    {row.changePct >= 0 ? "+" : ""}
                    {row.changePct.toFixed(2)}%
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Pill ok={!!byId.candles?.pass} label={byId.candles?.detail ?? ""} />
                </td>
                <td className="px-3 py-3">
                  <Pill ok={!!byId.indicators?.pass} label={byId.indicators?.detail ?? ""} />
                </td>
                <td className="px-3 py-3">
                  <Pill ok={!!byId.peaks_zero?.pass} label={byId.peaks_zero?.detail ?? ""} />
                </td>
                <td className="px-3 py-3">
                  <Pill ok={!!byId.breakout?.pass} label={byId.breakout?.detail ?? ""} />
                </td>
                <td className="px-3 py-3 font-mono">{fmt(row.entry)}</td>
                <td className="px-3 py-3 font-mono text-teal">
                  {fmt(row.tp1)} · {fmt(row.tp2)} · {fmt(row.tp3)}
                </td>
                <td className="px-3 py-3 font-mono text-danger">{fmt(row.sl)}</td>
                <td className="px-3 py-3 font-mono text-gold-soft">{row.successRate}%</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="وضع تحت المراقبة"
                      className={`rounded-full border p-1.5 ${
                        watchlist.includes(row.symbol) ? "border-gold text-gold" : "border-line text-muted"
                      }`}
                      onClick={() => onWatch(row.symbol)}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-bg"
                      onClick={() => onShow(row.symbol)}
                    >
                      فتح
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-10 text-center text-muted">
                لا إشارات قوية حالياً — يلزم موافقة ركيزتين على الأقل من أصل 4
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
