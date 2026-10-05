"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { CoinDetail } from "@/components/CoinDetail";
import { DeskToolbar, type CoinHit, type DeskToolId, type TradeKind } from "@/components/DeskToolbar";
import { LiveTicker } from "@/components/LiveTicker";
import { MarketHeader } from "@/components/MarketHeader";
import { ResultsBoard } from "@/components/ResultsBoard";
import { SignalCard } from "@/components/SignalCard";
import { TradingChart, type ChartGuide } from "@/components/TradingChart";
import { useBinanceTicker } from "@/hooks/useBinanceTicker";
import { useMarketScan } from "@/hooks/useMarketScan";
import { lastFinite, sma } from "@/lib/indicators";
import { detectCandlePattern } from "@/lib/strategies/candlesStrategy";
import type { Candle, SmartSignal } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const SESSION_KEY = "md.session";
const APP_VERSION = "1.0.0";
const KIND_TF: Record<TradeKind, string> = {
  scalp: "5m",
  spot: "15m",
  futures: "1h",
  swing: "4h",
};

function swingLows(candles: Candle[], look = 3) {
  const out: number[] = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].low;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].low <= v || candles[i + j].low < v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(v);
  }
  return out;
}

function swingHighs(candles: Candle[], look = 3) {
  const out: number[] = [];
  for (let i = look; i < candles.length - look; i++) {
    const v = candles[i].high;
    let ok = true;
    for (let j = 1; j <= look; j++) {
      if (candles[i - j].high >= v || candles[i + j].high > v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(v);
  }
  return out;
}

export function Dashboard() {
  const router = useRouter();
  const signals = useAppStore((s) => s.signals);
  const loading = useAppStore((s) => s.loading);
  const alert = useAppStore((s) => s.alert);
  const selected = useAppStore((s) => s.selected);
  const setSelected = useAppStore((s) => s.setSelected);
  const livePrice = useAppStore((s) => s.livePrice);
  const setLivePrice = useAppStore((s) => s.setLivePrice);
  const setAlert = useAppStore((s) => s.setAlert);
  const setSignals = useAppStore((s) => s.setSignals);
  const [interval, setIntervalTf] = useState("15m");
  const { refresh, error } = useMarketScan(interval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [detail, setDetail] = useState<SmartSignal | null>(null);
  const [email, setEmail] = useState("");
  const [wsLive, setWsLive] = useState(false);
  const [activeTool, setActiveTool] = useState<DeskToolId | null>("frames");
  const [tradeKind, setTradeKind] = useState<TradeKind>("spot");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CoinHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [overlays, setOverlays] = useState({
    support: true,
    resistance: true,
    boost: false,
    bottoms: true,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        router.replace("/");
        return;
      }
      const parsed = JSON.parse(raw) as { email?: string };
      if (!parsed.email) {
        router.replace("/");
        return;
      }
      setEmail(parsed.email);
    } catch {
      router.replace("/");
    }
  }, [router]);

  useBinanceTicker(selected, (price) => {
    setLivePrice(price);
    setWsLive(true);
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/series?symbol=${selected}&interval=${interval}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; candles?: Candle[]; signal?: SmartSignal | null };
      if (!cancelled && data.ok) {
        setCandles(data.candles ?? []);
        setDetail(data.signal ?? null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selected, interval]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setSearchBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coins?q=${encodeURIComponent(q)}&limit=12`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; coins?: CoinHit[] };
        setHits(data.ok ? data.coins ?? [] : []);
      } catch {
        setHits([]);
      } finally {
        setSearchBusy(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const pickCoin = useCallback(
    async (symbol: string) => {
      setSelected(symbol);
      setWatchlist((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
      setQuery("");
      setHits([]);
      try {
        const res = await fetch(`/api/series?symbol=${symbol}&interval=${interval}`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; signal?: SmartSignal | null };
        if (data.ok && data.signal) {
          setSignals([data.signal, ...signals.filter((s) => s.symbol !== symbol)]);
        }
      } catch {
        /* keep selection even if scan vote is empty */
      }
    },
    [interval, selected, setSelected, setSignals, signals],
  );

  const active = useMemo(
    () => detail ?? signals.find((s) => s.symbol === selected) ?? null,
    [detail, selected, signals],
  );

  const chartLevels = useMemo(() => {
    if (!active) return undefined;
    return { entry: active.entry, sl: active.sl, tp1: active.tp1, tp2: active.tp2, tp3: active.tp3 };
  }, [active]);

  const lastCandle = candles.at(-1);
  const candleStrength = lastCandle
    ? Math.round(
        (Math.abs(lastCandle.close - lastCandle.open) / Math.max(lastCandle.high - lastCandle.low, 1e-12)) * 100,
      )
    : 0;

  const bullishHits = useMemo(() => {
    const slice = candles.slice(-12);
    return slice
      .map((c, i) => {
        const window = candles.slice(0, candles.length - slice.length + i + 1);
        const pattern = detectCandlePattern(window);
        const bull = c.close > c.open;
        const strength = Math.round(
          (Math.abs(c.close - c.open) / Math.max(c.high - c.low, 1e-12)) * 100,
        );
        if (!bull || strength < 45) return null;
        return { time: c.time, strength, pattern: pattern === "Neutral" ? "صاعدة" : pattern };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(-6);
  }, [candles]);

  const guides = useMemo(() => {
    const out: ChartGuide[] = [];
    if (!candles.length) return out;
    const lows = swingLows(candles);
    const highs = swingHighs(candles);
    const lastLow = lows.at(-1);
    const lastHigh = highs.at(-1);
    const vols = candles.map((c) => c.volume);
    const volAvg = lastFinite(sma(vols, 20));
    const volRatio = (vols.at(-1) ?? 0) / Math.max(volAvg, 1e-9);
    if (overlays.support && lastLow) out.push({ price: lastLow, color: "#22c55e", title: "دعم" });
    if (overlays.resistance && lastHigh) out.push({ price: lastHigh, color: "#f97316", title: "مقاومة" });
    if (overlays.bottoms && lows.at(-2)) out.push({ price: lows[lows.length - 2]!, color: "#38bdf8", title: "قاع" });
    if (overlays.boost && lastCandle && volRatio >= 1.4) {
      out.push({ price: lastCandle.close, color: "#e879f9", title: `تعزيز ${volRatio.toFixed(1)}x` });
    }
    return out;
  }, [candles, overlays, lastCandle]);

  function onSelectTool(id: DeskToolId) {
    setActiveTool((prev) => (prev === id ? null : id));
    if (id === "support" || id === "resistance" || id === "boost" || id === "bottoms") {
      setOverlays((o) => ({ ...o, [id]: !o[id] }));
    }
  }

  function onTradeKind(k: TradeKind) {
    setTradeKind(k);
    setIntervalTf(KIND_TF[k]);
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <MarketHeader
        email={email}
        interval={interval}
        onInterval={setIntervalTf}
        loading={loading}
        onRefresh={() => void refresh()}
        live={wsLive}
        version={APP_VERSION}
      />
      <LiveTicker />

      {alert ? (
        <div className="border-b border-line bg-teal/10 px-4 py-2 text-center text-sm text-teal">
          <Bell size={14} className="me-2 inline" />
          {alert}
          <button type="button" className="ms-3 underline" onClick={() => setAlert(null)}>
            إغلاق
          </button>
        </div>
      ) : null}

      <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-center text-xs font-semibold text-emerald-300">
        النتيجة المعتمدة ✅ · RSI 58–64 · EMA 55 · BOS+FVG · حجم×2.6 · Test WR 72.4% · PF 6.81
      </div>

      <section className="w-full border-b border-line bg-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold text-gold-soft">
            {selected.replace("USDT", "")}
            <span className="text-muted">
              {" "}
              · {interval} · {tradeKind}
            </span>
          </p>
          <span className="text-[10px] text-muted">
            EMA21 أزرق · EMA55 ذهبي · SAR بنفسجي · MACD أسفل الشارت
          </span>
        </div>
        <div className="px-3 pb-2">
          <DeskToolbar
            active={activeTool}
            onSelect={onSelectTool}
            version={APP_VERSION}
            interval={interval}
            onInterval={setIntervalTf}
            tradeKind={tradeKind}
            onTradeKind={onTradeKind}
            query={query}
            onQuery={setQuery}
            hits={hits}
            searchBusy={searchBusy}
            onPickCoin={(s) => void pickCoin(s)}
            watchlist={watchlist}
            onRemoveCoin={(s) => setWatchlist((p) => p.filter((x) => x !== s))}
            overlays={overlays}
            onToggleOverlay={(key) => setOverlays((o) => ({ ...o, [key]: !o[key] }))}
            candleStrength={lastCandle && lastCandle.close > lastCandle.open ? candleStrength : 0}
            bullishHits={bullishHits}
          />
        </div>
        <div className="h-[38vw] min-h-[320px] max-h-[480px] w-full">
          <TradingChart candles={candles} levels={chartLevels} guides={guides} />
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] space-y-4 px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">إشارات الجينوم المعتمد</p>
          <div className="flex gap-3">
            <button type="button" className="text-xs text-gold-soft" onClick={() => router.push("/backtest")}>
              اختبار ذكي
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                router.replace("/");
              }}
            >
              <LogOut size={12} />
              خروج
            </button>
          </div>
        </div>
        {loading && signals.length === 0 ? <p className="text-sm text-muted">جاري مسح السوق…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {signals.map((s) => (
            <div key={s.symbol} className="min-w-[220px] max-w-[240px] shrink-0">
              <SignalCard signal={s} active={s.symbol === selected} onSelect={() => setSelected(s.symbol)} />
            </div>
          ))}
        </div>

        <CoinDetail signal={active} livePrice={livePrice} />

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gold-soft">لوحة النتائج · 4 استراتيجيات</h2>
          <ResultsBoard rows={signals} selected={selected} onShow={(symbol) => setSelected(symbol)} />
        </div>
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        تحليل تعليمي فقط · Million Deal v{APP_VERSION} · Binance WebSocket 24/7
      </footer>
    </div>
  );
}
