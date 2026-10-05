"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { CoinDetail } from "@/components/CoinDetail";
import { DeskToolbar, type DeskToolId } from "@/components/DeskToolbar";
import { LiveTicker } from "@/components/LiveTicker";
import { MarketHeader } from "@/components/MarketHeader";
import { ResultsBoard } from "@/components/ResultsBoard";
import { SignalCard } from "@/components/SignalCard";
import { TradingChart } from "@/components/TradingChart";
import { useBinanceTicker } from "@/hooks/useBinanceTicker";
import { useMarketScan } from "@/hooks/useMarketScan";
import type { Candle, SmartSignal } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const SESSION_KEY = "md.session";

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
  const [interval, setIntervalTf] = useState("15m");
  const { refresh, error } = useMarketScan(interval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [detail, setDetail] = useState<SmartSignal | null>(null);
  const [email, setEmail] = useState("");
  const [wsLive, setWsLive] = useState(false);
  const [activeTool, setActiveTool] = useState<DeskToolId | null>(null);

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
        (Math.abs(lastCandle.close - lastCandle.open) /
          Math.max(lastCandle.high - lastCandle.low, 1e-12)) *
          100,
      )
    : 0;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <MarketHeader
        email={email}
        interval={interval}
        onInterval={setIntervalTf}
        loading={loading}
        onRefresh={() => void refresh()}
        live={wsLive}
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

      <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-sm font-semibold text-emerald-300">
        النتيجة المعتمدة ✅ · RSI 58–64 · EMA 55 · BOS+FVG · حجم×2.6 · Test WR 72.4% · PF 6.81
      </div>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">إشارات الجينوم المعتمد</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-gold-soft hover:text-fg"
              onClick={() => router.push("/backtest")}
            >
              اختبار ذكي
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                router.replace("/");
              }}
            >
              <LogOut size={12} />
              خروج
            </button>
          </div>
          {loading && signals.length === 0 ? <p className="text-sm text-muted">جاري مسح السوق…</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pe-1">
            {signals.map((s) => (
              <SignalCard
                key={s.symbol}
                signal={s}
                active={s.symbol === selected}
                onSelect={() => setSelected(s.symbol)}
              />
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="space-y-3 border-b border-line px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gold-soft">
                  {selected.replace("USDT", "")}
                  <span className="text-muted"> · {interval}</span>
                </p>
                <span className="text-[10px] text-muted">v1.0.0</span>
              </div>
              <DeskToolbar
                active={activeTool}
                onSelect={setActiveTool}
                version="1.0.0"
                candleStrength={lastCandle && lastCandle.close > lastCandle.open ? candleStrength : 0}
              />
            </div>
            <TradingChart candles={candles} height={460} levels={chartLevels} />
          </div>

          <CoinDetail signal={active} livePrice={livePrice} />

          <div>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gold-soft">لوحة النتائج · 4 استراتيجيات</h2>
                <p className="text-xs text-muted">شموع · مؤشرات · قمم/قيعان/زيرو · اختراق القمم والدعم</p>
              </div>
            </div>
            <ResultsBoard rows={signals} selected={selected} onShow={(symbol) => setSelected(symbol)} />
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        هذا الموقع للتحليل التعليمي وليس نصيحة مالية · Million Deal v1.0.0 · Binance WebSocket 24/7 بدون API Key
      </footer>
    </div>
  );
}
