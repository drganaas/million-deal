"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { CoinDetail } from "@/components/CoinDetail";
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
        setDetail(data.signal ?? signals.find((s) => s.symbol === selected) ?? null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selected, signals, interval]);

  const active = useMemo(
    () => detail ?? signals.find((s) => s.symbol === selected) ?? null,
    [detail, selected, signals],
  );

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

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-muted">إشارات قوية · 2/4+</p>
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
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <p className="text-sm font-semibold text-gold-soft">
                {selected.replace("USDT", "")}
                <span className="text-muted"> · {interval}</span>
              </p>
              <div className="flex gap-3 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <img src="/icons/spot.svg" alt="" className="h-3.5 w-3.5" /> Spot
                </span>
                <span className="inline-flex items-center gap-1">
                  <img src="/icons/scalping.svg" alt="" className="h-3.5 w-3.5" /> Scalp
                </span>
                <span className="inline-flex items-center gap-1">
                  <img src="/icons/swing.svg" alt="" className="h-3.5 w-3.5" /> Swing
                </span>
              </div>
            </div>
            <TradingChart
              candles={candles}
              height={460}
              levels={
                active
                  ? { entry: active.entry, sl: active.sl, tp1: active.tp1, tp2: active.tp2, tp3: active.tp3 }
                  : undefined
              }
            />
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
        هذا الموقع للتحليل التعليمي وليس نصيحة مالية · Million Deal / صفقة المليون · Binance WebSocket 24/7 بدون API Key
      </footer>
    </div>
  );
}
