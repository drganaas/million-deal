"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, RefreshCw } from "lucide-react";
import { CoinDetail } from "@/components/CoinDetail";
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
  const { refresh, error } = useMarketScan("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [detail, setDetail] = useState<SmartSignal | null>(null);
  const [email, setEmail] = useState("");

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

  useBinanceTicker(selected, setLivePrice);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/series?symbol=${selected}&interval=15m`, { cache: "no-store" });
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
  }, [selected, signals]);

  const active = useMemo(
    () => detail ?? signals.find((s) => s.symbol === selected) ?? null,
    [detail, selected, signals],
  );

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-gold uppercase">Million Deal</p>
            <h1 className="text-lg font-semibold">صفقة المليون · Dashboard</h1>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{email}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 hover:border-gold"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              مسح
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                router.replace("/");
              }}
            >
              <LogOut size={14} />
              خروج
            </button>
          </div>
        </div>
        {alert ? (
          <div className="border-t border-line bg-teal/10 px-4 py-2 text-center text-sm text-teal">
            <Bell size={14} className="me-2 inline" />
            {alert}
            <button type="button" className="ms-3 underline" onClick={() => setAlert(null)}>
              إغلاق
            </button>
          </div>
        ) : null}
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">إشارات قوية (3/5+)</p>
          {loading && signals.length === 0 ? <p className="text-sm text-muted">جاري المسح…</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {signals.map((s) => (
            <SignalCard key={s.symbol} signal={s} active={s.symbol === selected} onSelect={() => setSelected(s.symbol)} />
          ))}
        </aside>

        <section className="space-y-4">
          <TradingChart
            candles={candles}
            levels={
              active
                ? { entry: active.entry, sl: active.sl, tp1: active.tp1, tp2: active.tp2, tp3: active.tp3 }
                : undefined
            }
          />
          <CoinDetail signal={active} livePrice={livePrice} />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gold-soft">لوحة النتائج · بداية الصعود</h2>
            <ResultsBoard rows={signals} onShow={(symbol) => setSelected(symbol)} />
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        هذا الموقع للتحليل التعليمي وليس نصيحة مالية · Million Deal / صفقة المليون · يعمل 24/7 عبر Binance WebSocket بدون API Key من المستخدم
      </footer>
    </div>
  );
}
