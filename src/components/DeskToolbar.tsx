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
import type { LiveCandleHit } from "@/hooks/useCandleScan";
import { roundPx } from "@/lib/indicators";

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

export type LevelInfo = {
  support: number | null;
  resistance: number | null;
  bottom: number | null;
  boost: number | null;
  price: number | null;
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

function px(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return String(roundPx(n));
}

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
  levels,
  selectedBase,
  candleStrength,
  liveCandles,
  positive,
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
  levels: LevelInfo;
  selectedBase: string;
  candleStrength: number;
  liveCandles: LiveCandleHit[];
  positive: Partial<Record<DeskToolId, boolean>>;
}) {
  const searchOpen = active === "manual-search" || active === "add-coins";
  const topStrength = liveCandles[0]?.strength ?? candleStrength;
  const hasCoin = Boolean(selectedBase);

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
              positive[id]
                ? "service-glow border-teal bg-teal/15 text-teal"
                : active === id
                  ? "border-gold bg-gold/15 text-gold-soft"
                  : "border-line bg-inset text-muted hover:border-gold/50 hover:text-fg"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
            {id === "deploy-version" ? <span className="font-mono text-gold">v{version}</span> : null}
            {id === "bullish-candles" && topStrength > 0 ? (
              <span className="rounded-full bg-teal/20 px-1.5 py-0.5 font-mono text-[10px] text-teal">{topStrength}%</span>
            ) : null}
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

      {active === "support" && (
        <LevelCard
          title={`الدعم · ${selectedBase || "اختر عملة"}`}
          ready={hasCoin}
          rows={[{ label: "مستوى الدعم", value: px(levels.support), color: "text-teal" }]}
        />
      )}
      {active === "resistance" && (
        <LevelCard
          title={`المقاومة · ${selectedBase || "اختر عملة"}`}
          ready={hasCoin}
          rows={[{ label: "مستوى المقاومة", value: px(levels.resistance), color: "text-orange-400" }]}
        />
      )}
      {active === "bottoms" && (
        <LevelCard
          title={`القيعان · ${selectedBase || "اختر عملة"}`}
          ready={hasCoin}
          rows={[
            { label: "آخر قاع", value: px(levels.bottom), color: "text-sky-400" },
            { label: "الدعم الحالي", value: px(levels.support), color: "text-teal" },
          ]}
        />
      )}
      {active === "boost" && (
        <LevelCard
          title={`التعزيز · ${selectedBase || "اختر عملة"}`}
          ready={hasCoin}
          rows={[
            {
              label: "حجم مقابل المتوسط",
              value: levels.boost != null ? `${levels.boost.toFixed(1)}x` : "—",
              color: "text-fuchsia-300",
            },
          ]}
        />
      )}

      {active === "deploy-version" && (
        <p className="text-[11px] text-muted">نسخة النشر الحالية: Million Deal v{version} · Render production</p>
      )}
    </div>
  );
}

function LevelCard({
  title,
  ready,
  rows,
}: {
  title: string;
  ready: boolean;
  rows: Array<{ label: string; value: string; color: string }>;
}) {
  return (
    <div className="rounded-xl border border-line bg-inset px-3 py-2">
      <p className="mb-1 text-[11px] font-semibold text-gold-soft">{title}</p>
      {ready ? (
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-muted">{r.label}</span>
              <span className={`font-mono font-semibold ${r.color}`}>{r.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">ابحث واختر عملة أولاً ليظهر الرقم هنا داخل الأيقونة</p>
      )}
    </div>
  );
}

export function CandleScanStrip({
  hits,
  universe,
  busy,
  onPick,
}: {
  hits: LiveCandleHit[];
  universe: number;
  busy: boolean;
  onPick: (symbol: string) => void;
}) {
  return (
    <div className="border-t border-line bg-inset px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>شموع صاعدة لحظية · Binance</span>
        <span className="text-teal">{busy ? "مسح…" : `${universe} زوج · ${hits.length} شمعة`}</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {hits.slice(0, 14).map((c) => (
          <button
            key={c.symbol}
            type="button"
            onClick={() => onPick(c.symbol)}
            className="w-[108px] shrink-0 rounded-lg border border-line bg-bg px-2 py-1.5 text-start hover:border-gold/50"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold">{c.base}</span>
              <span className="font-mono text-[10px] text-teal">{c.strength}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-l from-teal to-gold"
                style={{ width: `${Math.max(8, Math.min(100, c.strength))}%` }}
              />
            </div>
          </button>
        ))}
        {!hits.length ? (
          <p className="py-1 text-[11px] text-muted">{busy ? "يتصل ببينانس…" : "لا شموع صاعدة قوية الآن"}</p>
        ) : null}
      </div>
    </div>
  );
}
