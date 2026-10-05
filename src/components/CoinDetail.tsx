"use client";

import type { SmartSignal } from "@/lib/types";
import { StrategyPillars } from "@/components/StrategyPillars";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function CoinDetail({ signal, livePrice }: { signal: SmartSignal | null; livePrice?: number | null }) {
  if (!signal) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-muted">
        اختر عملة من لوحة النتائج لعرض البطاقة التفصيلية والاستراتيجيات
      </div>
    );
  }

  const price = livePrice ?? signal.last;
  const z = signal.zeroReversal;
  const b = signal.breakout;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">تفاصيل الإشارة</p>
          <h2 className="text-2xl font-bold text-fg md:text-3xl">
            {signal.base}
            <span className="text-base font-medium text-muted"> / USDT</span>
          </h2>
          <p className="mt-1 font-mono text-xl text-gold-soft">{fmt(price)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full bg-teal/15 px-3 py-1 text-sm font-semibold text-teal">
            {signal.genomeAdopted ? "WR معتمد" : "نجاح متوقع"} {signal.successRate}%
          </div>
          {signal.genomeAdopted ? (
            <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {signal.adoptedLabel ?? "النتيجة المعتمدة ✅"}
            </div>
          ) : (
            <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">
              توافق {signal.agreeCount}/4 ركائز
            </div>
          )}
          {signal.genomeAdopted ? (
            <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">
              توافق عرضي {signal.agreeCount}/4 · RSI {signal.rsi}
            </div>
          ) : null}
        </div>
      </div>

      <StrategyPillars pillars={signal.pillars} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          title="صعود ممتد"
          lines={[
            signal.extendedRise.detail,
            `بعد القاع ${signal.extendedRise.distFromLowPct}% · مساحة ${signal.extendedRise.roomToHighPct}%`,
            `زخم حجم ${signal.extendedRise.volRatio}x · ATR ${signal.extendedRise.atrPct ?? "-"}% · درجة ${signal.extendedRise.score}`,
          ]}
        />
        <Info
          title="السيولة"
          lines={[
            `Depth Score ${signal.liquidity.totalScore}`,
            `Bid ${fmt(signal.liquidity.bidDepth)}`,
            `Ask ${fmt(signal.liquidity.askDepth)}`,
          ]}
        />
        <Info
          title="القاع والقمة"
          lines={[
            `ATL ${fmt(signal.atl)} · ATH ${fmt(signal.ath)}`,
            `قاع ${fmt(signal.currentLow)} · قمة ${fmt(signal.currentHigh)}`,
            `${signal.bottomType} · بعد ${signal.distanceFromBottomPct}%`,
          ]}
        />
        <Info
          title="زيرو انعكاس"
          lines={[
            `الحالة: ${z.status}`,
            `الهيكل: ${z.structure} · ${z.peaksBottoms}`,
            `قرب القاع ${z.distToLowPct}% · RSI ${z.rsi}`,
          ]}
        />
        <Info
          title="اختراق / دعم"
          lines={[
            `كسر قمة: ${b.peakBreak ? "نعم" : "لا"}`,
            `استعادة دعم: ${b.supportReclaim ? "نعم" : "لا"}`,
            `قمة ${fmt(b.lastHigh)} · دعم ${fmt(b.lastLow)}`,
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Level label="Entry" value={fmt(signal.entry)} tone="gold" />
        <Level label="SL" value={fmt(signal.sl)} tone="danger" />
        <Level label="TP1" value={fmt(signal.tp1)} tone="teal" />
        <Level label="TP2" value={fmt(signal.tp2)} tone="teal" />
        <Level label="TP3" value={fmt(signal.tp3)} tone="teal" />
      </div>
    </div>
  );
}

function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-line/70 bg-inset p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-1 space-y-1 text-xs text-fg">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function Level({ label, value, tone }: { label: string; value: string; tone: "gold" | "teal" | "danger" }) {
  const color = tone === "gold" ? "text-gold-soft" : tone === "teal" ? "text-teal" : "text-danger";
  return (
    <div className="rounded-xl bg-inset p-2.5 text-center">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`font-mono text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
