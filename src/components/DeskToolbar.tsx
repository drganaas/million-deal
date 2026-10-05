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
  X,
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

export type TradeKind = "spot" | "scalp" | "swing" | "futures";

export type CoinHit = {
  symbol: string;
  base: string;
  changePct: number;
  quoteVolume: number;
};

export type BullishHit = {
  time: number;
  strength: number;
  pattern: string;
};

const TOOLS: Array<{ id: DeskToolId; label: string; Icon: typeof Search }> = [
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

const FRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const KINDS: Array<{ id: TradeKind; label: string; src: string }> = [
  { id: "spot", label: "Spot", src: "/icons/spot.svg" },
  { id: "scalp", label: "Scalp", src: "/icons/scalping.svg" },
  { id: "swing", label: "Swing", src: "/icons/swing.svg" },
  { id: "futures", label: "Futures", src: "/icons/futures.svg" },
];

export function DeskToolbar({
  active,
  onSelect,
  version,
  interval,
  onInterval,
  tradeKind,
  onTradeKind,
  query,
  onQuery,
  hits,
  searchBusy,
  onPickCoin,
  watchlist,
  onRemoveCoin,
  overlays,
  candleStrength,
  bullishHits,
}: {
  active?: DeskToolId | null;
  onSelect: (id: DeskToolId) => void;
  version: string;
  interval: string;
  onInterval: (tf: string) => void;
  tradeKind: TradeKind;
  onTradeKind: (k: TradeKind) => void;
  query: string;
  onQuery: (q: string) => void;
  hits: CoinHit[];
  searchBusy: boolean;
  onPickCoin: (symbol: string) => void;
  watchlist: string[];
  onRemoveCoin: (symbol: string) => void;
  overlays: { support: boolean; resistance: boolean; boost: boolean; bottoms: boolean };
  candleStrength: number;
  bullishHits: BullishHit[];
}) {
  const searchOpen = active === "manual-search" || active === "add-coins";

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
              active === id ||
              (id === "support" && overlays.support) ||
              (id === "resistance" && overlays.resistance) ||
              (id === "boost" && overlays.boost) ||
              (id === "bottoms" && overlays.bottoms)
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

      {searchOpen && (
        <div className="rounded-xl border border-line bg-inset p-3">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={active === "add-coins" ? "أضف عملة مثل AVAX أو PEPE…" : "ابحث عن عملة وافتحها فوراً…"}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-gold"
          />
          {searchBusy ? <p className="mt-2 text-[11px] text-muted">جاري البحث…</p> : null}
          <div className="mt-2 max-h-40 overflow-y-auto">
            {hits.map((h) => (
              <button
                key={h.symbol}
                type="button"
                onClick={() => onPickCoin(h.symbol)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
              >
                <span className="font-semibold">{h.base}</span>
                <span className={h.changePct >= 0 ? "text-teal" : "text-danger"}>
                  {h.changePct >= 0 ? "+" : ""}
                  {h.changePct.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
          {watchlist.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {watchlist.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] text-gold-soft"
                >
                  {s.replace("USDT", "")}
                  <button type="button" onClick={() => onRemoveCoin(s)} aria-label="إزالة">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {active === "frames" && (
        <div className="flex flex-wrap gap-1.5">
          {FRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onInterval(tf)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                interval === tf ? "bg-gold text-bg" : "border border-line text-muted"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      {active === "trade-types" && (
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onTradeKind(k.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                tradeKind === k.id ? "border-gold bg-gold/15 text-gold-soft" : "border-line text-muted"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={k.src} alt={k.label} className="h-3.5 w-3.5" />
              {k.label}
            </button>
          ))}
        </div>
      )}

      {active === "bullish-candles" && (
        <div className="rounded-xl border border-line bg-inset px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>قوة آخر شمعة صاعدة</span>
            <span className="font-semibold text-teal">{candleStrength}%</span>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-l from-teal to-gold"
              style={{ width: `${Math.max(0, Math.min(100, candleStrength))}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bullishHits.length ? (
              bullishHits.map((b, i) => (
                <span key={`${b.time}-${i}`} className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] text-teal">
                  {b.pattern} · {b.strength}%
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted">لا شموع صاعدة قوية في آخر 12 شمعة</span>
            )}
          </div>
        </div>
      )}

      {active === "deploy-version" && (
        <p className="text-[11px] text-muted">نسخة النشر الحالية: Million Deal v{version} · Render production</p>
      )}

      {(active === "support" || active === "resistance" || active === "boost" || active === "bottoms") && (
        <p className="text-[11px] text-gold-soft">
          تم تفعيل الرسم على الشارت — اضغط الأيقونة مرة أخرى لإخفاء الخط
        </p>
      )}
    </div>
  );
}
