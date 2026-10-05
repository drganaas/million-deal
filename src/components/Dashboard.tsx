"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { CoinDetail } from "@/components/CoinDetail";
import { DeskToolbar, CandleScanStrip, type CoinHit, type DeskToolId, type LevelInfo, type TradeKind } from "@/components/DeskToolbar";
import { LiveTicker } from "@/components/LiveTicker";
import { MarketHeader } from "@/components/MarketHeader";
import { ResultsBoard } from "@/components/ResultsBoard";
import { SignalCard } from "@/components/SignalCard";
import { TradingChart } from "@/components/TradingChart";
import { useBinanceTicker } from "@/hooks/useBinanceTicker";
import { useCandleScan } from "@/hooks/useCandleScan";
import { useMarketScan } from "@/hooks/useMarketScan";
import { lastFinite, sma } from "@/lib/indicators";
import type { Candle, SmartSignal } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const SESSION_KEY = "md.session";
const APP_VERSION = "1.2.2";
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
  const liveScan = useCandleScan(interval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [detail, setDetail] = useState<SmartSignal | null>(null);
  const [email, setEmail] = useState("");
  const [wsLive, setWsLive] = useState(false);
  const [activeTool, setActiveTool] = useState<DeskToolId | null>(null);
  const [tradeKind, setTradeKind] = useState<TradeKind>("spot");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CoinHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);

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
    [interval, setSelected, setSignals, signals],
  );

  const active = useMemo(
    () => detail ?? signals.find((s) => s.symbol === selected) ?? null,
    [detail, selected, signals],
  );

  const lastCandle = candles.at(-1);
  const candleStrength = lastCandle
    ? Math.round(
        (Math.abs(lastCandle.close - lastCandle.open) / Math.max(lastCandle.high - lastCandle.low, 1e-12)) * 100,
      )
    : 0;
  const bullishNow = Boolean(lastCandle && lastCandle.close > lastCandle.open);

  const levels = useMemo<LevelInfo>(() => {
    if (!candles.length) {
      return { support: null, resistance: null, bottom: null, boost: null, price: lastCandle?.close ?? null };
    }
    const lows = swingLows(candles);
    const highs = swingHighs(candles);
    const vols = candles.map((c) => c.volume);
    const volAvg = lastFinite(sma(vols, 20));
    const volRatio = (vols.at(-1) ?? 0) / Math.max(volAvg, 1e-9);
    return {
      support: lows.at(-1) ?? null,
      resistance: highs.at(-1) ?? null,
      bottom: lows.at(-2) ?? lows.at(-1) ?? null,
      boost: Number.isFinite(volRatio) ? volRatio : null,
      price: lastCandle?.close ?? null,
    };
  }, [candles, lastCandle]);

  const price = livePrice || levels.price || 0;
  const nearSupport = Boolean(levels.support && price > 0 && price >= levels.support && (price - levels.support) / price <= 0.015);
  const holdSupport = Boolean(levels.support && price > levels.support);
  const nearResistance = Boolean(
    levels.resistance && price > 0 && levels.resistance >= price && (levels.resistance - price) / price <= 0.012,
  );
  const nearBottom = Boolean(levels.bottom && price > 0 && Math.abs(price - levels.bottom) / price <= 0.03);
  const boosted = Boolean(levels.boost != null && levels.boost >= 1.4);

  const positive: Partial<Record<DeskToolId, boolean>> = {
    support: holdSupport && (nearSupport || bullishNow),
    resistance: nearResistance && bullishNow,
    bottoms: nearBottom && bullishNow,
    boost: boosted,
    "bullish-candles": bullishNow || liveScan.hits.length > 0,
    "add-coins": watchlist.length > 0,
    "manual-search": hits.length > 0,
    frames: wsLive,
    "trade-types": Boolean(active),
  };

  function onSelectTool(id: DeskToolId) {
    setActiveTool((prev) => (prev === id ? null : id));
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

      <section className="w-full border-b border-line bg-bg">
        <div className="flex w-full items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold text-gold-soft">
            {selected.replace("USDT", "")}
            <span className="text-muted">
              {" "}
              · {interval} · {tradeKind}
            </span>
          </p>
          <span className="text-[11px] text-muted">شارت واحد · المؤشرات تتبع السعر</span>
        </div>
        <div className="w-full px-3 pb-2">
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
            levels={levels}
            selectedBase={selected.replace("USDT", "")}
            candleStrength={bullishNow ? candleStrength : 0}
            liveCandles={liveScan.hits}
            positive={positive}
          />
        </div>
        <div className="w-full border-y border-line" style={{ height: "min(88vh, 980px)", minHeight: 720 }}>
          <TradingChart candles={candles} />
        </div>
        <CandleScanStrip
          hits={liveScan.hits}
          universe={liveScan.universe}
          busy={liveScan.busy}
          onPick={(s) => void pickCoin(s)}
        />
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
