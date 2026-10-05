"use client";

import { useState } from "react";
import {
  CandlestickChart,
  Check,
  Clock,
  Copy,
  Droplets,
  Eye,
  GitCommit,
  Layers,
  Mountain,
  Plus,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  Zap,
  X,
} from "lucide-react";
import type { LiveCandleHit } from "@/hooks/useCandleScan";
import { roundPx } from "@/lib/indicators";
import {
  copyText,
  formatLiquidityVolume,
  formatTradeCopy,
  isConfirmedBullishCandle,
} from "@/lib/formatTradeCopy";
import { CHART_FRAMES } from "@/lib/market/frames";
import type { SmartSignal } from "@/lib/types";

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
  bottomType: string | null;
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
  onAddCoin,
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
  onAddCoin: (symbol: string) => void;
  watchlist: string[];
  onRemoveCoin: (symbol: string) => void;
  levels: LevelInfo;
  selectedBase: string;
  candleStrength: number;
  liveCandles: LiveCandleHit[];
  positive: Partial<Record<DeskToolId, boolean>>;
}) {
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
            {id === "support" && hasCoin ? (
              <span className="font-mono text-[10px] text-teal">{px(levels.support)}</span>
            ) : null}
            {id === "resistance" && hasCoin ? (
              <span className="font-mono text-[10px] text-orange-400">{px(levels.resistance)}</span>
            ) : null}
            {id === "bottoms" && hasCoin ? (
              <span className="font-mono text-[10px] text-sky-400">
                {px(levels.bottom)}
                {levels.bottomType ? ` · ${levels.bottomType}` : ""}
              </span>
            ) : null}
            {id === "deploy-version" ? <span className="font-mono text-gold">v{version}</span> : null}
            {id === "bullish-candles" && topStrength > 0 ? (
              <span className="rounded-full bg-teal/20 px-1.5 py-0.5 font-mono text-[10px] text-teal">{topStrength}%</span>
            ) : null}
          </button>
        ))}
      </div>

      {active === "manual-search" && (
        <div className="rounded-xl border border-line bg-inset p-3">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="ابحث عن عملة وافتحها فوراً…"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-gold"
          />
          {searchBusy ? <p className="mt-2 text-[11px] text-muted">جاري البحث…</p> : null}
          <div className="mt-2 max-h-40 overflow-y-auto">
            {hits.map((h) => (
              <div key={h.symbol} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <button type="button" onClick={() => onPickCoin(h.symbol)} className="font-semibold">
                  {h.base}
                </button>
                <span className={h.changePct >= 0 ? "text-teal" : "text-danger"}>
                  {h.changePct >= 0 ? "+" : ""}
                  {h.changePct.toFixed(1)}%
                </span>
                <button
                  type="button"
                  title="وضع تحت المراقبة"
                  onClick={() => onAddCoin(h.symbol)}
                  className={watchlist.includes(h.symbol) ? "text-gold" : "text-muted hover:text-gold-soft"}
                >
                  <Eye size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "add-coins" && (
        <div className="rounded-xl border border-line bg-inset p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const raw = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (!raw) return;
              onAddCoin(raw.endsWith("USDT") ? raw : `${raw}USDT`);
              onQuery("");
            }}
          >
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="أدخل رمز العملة ثم إضافة…"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-gold"
            />
            <button
              type="submit"
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gold/50 bg-gold/15 px-3 py-1.5 text-[11px] font-semibold text-gold-soft"
            >
              <Plus size={12} />
              إضافة
            </button>
          </form>
          {searchBusy ? <p className="mt-2 text-[11px] text-muted">جاري البحث في بينانس…</p> : null}
          <div className="mt-2 max-h-40 overflow-y-auto">
            {hits.map((h) => (
              <div key={h.symbol} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <span className="font-semibold">{h.base}</span>
                <span className={h.changePct >= 0 ? "text-teal" : "text-danger"}>
                  {h.changePct >= 0 ? "+" : ""}
                  {h.changePct.toFixed(1)}%
                </span>
                <button
                  type="button"
                  title="إضافة"
                  onClick={() => onAddCoin(h.symbol)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-0.5 text-[11px] text-gold-soft hover:border-gold"
                >
                  <Plus size={12} />
                  إضافة
                </button>
              </div>
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
          {CHART_FRAMES.map((tf) => (
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
            { label: "نوع القاع", value: levels.bottomType ?? "—", color: "text-gold-soft" },
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

function fmtShortVol(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

export function CandleScanStrip({
  hits,
  universe,
  watchlist,
  running,
  live,
  interval,
  tradeKind,
  onStart,
  onStop,
  onPick,
  onWatch,
}: {
  hits: LiveCandleHit[];
  universe: number;
  watchlist: string[];
  running: boolean;
  live: boolean;
  interval: string;
  tradeKind: TradeKind;
  onStart: () => void;
  onStop: () => void;
  onPick: (symbol: string) => void;
  onWatch: (symbol: string) => void;
}) {
  const [copying, setCopying] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyTradeCard(c: LiveCandleHit) {
    if (!isConfirmedBullishCandle(c)) return;
    setCopying(c.symbol);
    try {
      onPick(c.symbol);
      const res = await fetch(`/api/series?symbol=${encodeURIComponent(c.symbol)}&interval=${encodeURIComponent(interval)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; signal?: SmartSignal | null };
      if (!data.ok || !data.signal) throw new Error("no signal");
      const text = formatTradeCopy(data.signal, {
        tradeKind,
        interval,
        candleStrength: c.strength,
        momentumPct: c.changePct,
        quoteVolume: c.quoteVolume,
      });
      const ok = await copyText(text);
      if (ok) {
        setCopied(c.symbol);
        window.setTimeout(() => setCopied((s) => (s === c.symbol ? null : s)), 2000);
      }
    } catch {
      /* keep UI calm */
    } finally {
      setCopying(null);
    }
  }

  return (
    <div className="border-t border-line bg-inset px-3 py-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>بحث تلقائي لحظي · شموع صاعدة · كل أزواج Binance</span>
        <div className="flex items-center gap-2">
          <span className={live && running ? "text-teal" : "text-danger"}>
            {running ? (live ? "بث مباشر" : "يتصل…") : "متوقف"}
            {" · "}
            {universe} زوج · {hits.length} نتيجة
          </span>
          <button
            type="button"
            onClick={onStart}
            disabled={running}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
              running
                ? "cursor-not-allowed border-line text-muted opacity-50"
                : "border-teal/50 bg-teal/15 text-teal hover:border-teal"
            }`}
          >
            تشغيل البحث
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!running}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
              !running
                ? "cursor-not-allowed border-line text-muted opacity-50"
                : "border-danger/50 bg-danger/15 text-danger hover:border-danger"
            }`}
          >
            إيقاف البحث
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {hits.map((c) => {
          const watched = watchlist.includes(c.symbol);
          const confirmed = isConfirmedBullishCandle(c);
          const momSign = c.changePct >= 0 ? "+" : "";
          return (
            <div
              key={c.symbol}
              className={`w-[148px] shrink-0 rounded-lg border px-2 py-1.5 ${
                confirmed
                  ? watched
                    ? "border-gold bg-gold/10"
                    : "border-teal/40 bg-bg"
                  : watched
                    ? "border-gold/50 bg-gold/5 opacity-80"
                    : "border-line bg-bg opacity-70"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmed) void copyTradeCard(c);
                    else onPick(c.symbol);
                  }}
                  className="text-[11px] font-semibold"
                  title={confirmed ? "اختيار + نسخ الصفقة" : "اختيار العملة"}
                >
                  {c.base}
                </button>
                <div className="flex items-center gap-1">
                  {confirmed ? (
                    <button
                      type="button"
                      title="نسخ الدخول والأهداف ووقف الخسارة"
                      disabled={copying === c.symbol}
                      onClick={() => void copyTradeCard(c)}
                      className={
                        copied === c.symbol ? "text-teal" : "text-gold-soft hover:text-gold disabled:opacity-50"
                      }
                    >
                      {copied === c.symbol ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="وضع تحت المراقبة"
                    onClick={() => onWatch(c.symbol)}
                    className={watched ? "text-gold" : "text-muted hover:text-gold-soft"}
                  >
                    <Eye size={12} />
                  </button>
                </div>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1 font-mono text-[10px]">
                <span className="text-teal">{c.strength}%</span>
                {confirmed ? (
                  <span className="rounded bg-teal/15 px-1 text-[9px] font-semibold text-teal">مؤكدة ✅</span>
                ) : (
                  <span className="text-[9px] text-muted">صاعدة</span>
                )}
              </div>
              <div
                className="mt-1 flex items-center gap-1 rounded border border-line/60 bg-black/25 px-1 py-0.5 text-[9px]"
                title={`💧 حجم السيولة: ${formatLiquidityVolume(c.quoteVolume)} · ⚡ نسبة الزخم: ${momSign}${c.changePct.toFixed(2)}%`}
              >
                <span className="inline-flex items-center gap-0.5 text-sky-300" title="حجم السيولة">
                  <Droplets size={9} />
                  {fmtShortVol(c.quoteVolume)}
                </span>
                <span className="text-muted">·</span>
                <span className="inline-flex items-center gap-0.5 text-amber-300" title="نسبة الزخم %">
                  <Zap size={9} />
                  {momSign}
                  {c.changePct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-teal to-gold"
                  style={{ width: `${Math.max(8, Math.min(100, c.strength))}%` }}
                />
              </div>
            </div>
          );
        })}
        {!hits.length ? (
          <p className="py-1 text-[11px] text-muted">
            {running ? "بانتظار شموع صاعدة من البث اللحظي…" : "البحث متوقف — اضغط تشغيل البحث"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
