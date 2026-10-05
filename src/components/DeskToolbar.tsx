"use client";

import {
  CandlestickChart,
  Clock,
  GitCommit,
  Layers,
  Mountain,
  Plus,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
} from "lucide-react";

export type DeskToolId =
  | "manual-search"
  | "add-coins"
  | "support"
  | "resistance"
  | "boost"
  | "bottoms"
  | "frames"
  | "trade-types"
  | "bullish-candles"
  | "deploy-version";

const TOOLS: Array<{
  id: DeskToolId;
  label: string;
  Icon: typeof Search;
}> = [
  { id: "manual-search", label: "بحث يدوي", Icon: Search },
  { id: "add-coins", label: "إضافة عملات", Icon: Plus },
  { id: "support", label: "الدعم", Icon: Shield },
  { id: "resistance", label: "المقاومة", Icon: TrendingDown },
  { id: "boost", label: "التعزيز", Icon: Sparkles },
  { id: "bottoms", label: "القيعان", Icon: Mountain },
  { id: "frames", label: "الفريمات", Icon: Clock },
  { id: "trade-types", label: "أنواع الصفقات", Icon: Layers },
  { id: "bullish-candles", label: "الشموع الصاعدة", Icon: CandlestickChart },
  { id: "deploy-version", label: "نسخة النشر", Icon: GitCommit },
];

export function DeskToolbar({
  active,
  onSelect,
  version,
  candleStrength,
}: {
  active?: DeskToolId | null;
  onSelect: (id: DeskToolId) => void;
  version: string;
  candleStrength?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onSelect(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              active === id
                ? "border-gold bg-gold/15 text-gold-soft"
                : "border-line bg-inset text-muted hover:border-gold/50 hover:text-fg"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
            {id === "deploy-version" ? <span className="font-mono text-gold">v{version}</span> : null}
          </button>
        ))}
      </div>

      {active === "bullish-candles" && candleStrength != null ? (
        <div className="rounded-xl border border-line bg-inset px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>قوة الشمعة الصاعدة</span>
            <span className="font-semibold text-teal">{candleStrength}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-l from-teal to-gold"
              style={{ width: `${Math.max(0, Math.min(100, candleStrength))}%` }}
            />
          </div>
        </div>
      ) : null}

      {active === "frames" ? (
        <p className="text-[11px] text-muted">الفريمات جاهزة في الشريط العلوي: 5m · 15m · 1h · 4h</p>
      ) : null}

      {active === "trade-types" ? (
        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <img src="/icons/spot.svg" alt="" className="h-3.5 w-3.5" /> Spot
          </span>
          <span className="inline-flex items-center gap-1">
            <img src="/icons/scalping.svg" alt="" className="h-3.5 w-3.5" /> Scalp
          </span>
          <span className="inline-flex items-center gap-1">
            <img src="/icons/swing.svg" alt="" className="h-3.5 w-3.5" /> Swing
          </span>
          <span className="inline-flex items-center gap-1">
            <img src="/icons/futures.svg" alt="" className="h-3.5 w-3.5" /> Futures
          </span>
        </div>
      ) : null}

      {active && !["bullish-candles", "frames", "trade-types", "deploy-version"].includes(active) ? (
        <p className="text-[11px] text-gold-soft">الأيقونة جاهزة — بانتظار أمرك لتفعيل {TOOLS.find((t) => t.id === active)?.label}</p>
      ) : null}
    </div>
  );
}
