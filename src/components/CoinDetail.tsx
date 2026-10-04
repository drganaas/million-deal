"use client";

import type { SmartSignal } from "@/lib/types";

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
      <div className="rounded-xl border border-line bg-surface p-4 text-muted">
        اختر عملة من النتائج لعرض البطاقة التفصيلية
      </div>
    );
  }

  const price = livePrice ?? signal.last;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">بطاقة العملة</p>
          <h2 className="text-2xl font-semibold text-fg">
            {signal.base}
            <span className="text-sm text-muted"> / USDT</span>
          </h2>
          <p className="mt-1 font-mono text-gold-soft">{fmt(price)}</p>
        </div>
        <div className="rounded-full bg-teal/15 px-3 py-1 text-sm font-semibold text-teal">
          نجاح متوقع {signal.successRate}%
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info title="السيولة" lines={[`Depth Score ${signal.liquidity.totalScore}`, `Bid ${fmt(signal.liquidity.bidDepth)}`, `Ask ${fmt(signal.liquidity.askDepth)}`]} />
        <Info
          title="القاع والقمة"
          lines={[
            `ATL ${fmt(signal.atl)} · ATH ${fmt(signal.ath)}`,
            `قاع حالي ${fmt(signal.currentLow)} · قمة حالية ${fmt(signal.currentHigh)}`,
            `البعد عن القاع ${signal.distanceFromBottomPct}% · ${signal.bottomType}`,
          ]}
        />
        <Info title="الزخم" lines={[`RSI ${signal.rsi}`, `MACD ${signal.macdHist}`, `Volume ${signal.volumeRatio}x`]} />
        <Info
          title="الشمعة و SMC"
          lines={[
            `Pattern: ${signal.candlePattern}`,
            `BOS ${signal.smc.bos ? "✓" : "—"} · CHOCH ${signal.smc.choch ? "✓" : "—"}`,
            `Sweep ${signal.smc.sweep ? "✓" : "—"} · FVG ${signal.smc.fvg ? "✓" : "—"} · OB ${signal.smc.orderBlock ? "✓" : "—"}`,
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Level label="Entry" value={fmt(signal.entry)} tone="gold" />
        <Level label="SL" value={fmt(signal.sl)} tone="danger" />
        <Level label="TP1" value={fmt(signal.tp1)} tone="teal" />
        <Level label="TP2" value={fmt(signal.tp2)} tone="teal" />
        <Level label="TP3" value={fmt(signal.tp3)} tone="teal" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {signal.votes.map((v) => (
          <span
            key={v.id}
            className={`rounded-full px-2.5 py-1 text-[11px] ${
              v.pass ? "bg-teal/15 text-teal" : "bg-inset text-muted"
            }`}
          >
            {v.name} {v.pass ? "✓" : "×"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg bg-inset p-3">
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
    <div className="rounded-lg bg-inset p-2 text-center">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}
