"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, Loader2, Play, Search, ShieldCheck, Square, X } from "lucide-react";

type CoinHit = {
  symbol: string;
  base: string;
  changePct: number;
  quoteVolume: number;
};

const COIN_POOL = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "NEARUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "INJUSDT",
  "ATOMUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "FILUSDT",
  "RENDERUSDT",
  "FETUSDT",
  "PEPEUSDT",
  "WIFUSDT",
  "TIAUSDT",
  "SEIUSDT",
  "TONUSDT",
  "ORDIUSDT",
  "TRXUSDT",
];

type TopRow = {
  fitness: number;
  accepted: boolean;
  rejectReason?: string;
  trainWR: number;
  testWR: number;
  pf: number;
  dd: number;
  avgRR: number;
  trainTrades: number;
  testTrades: number;
  genome: Record<string, unknown>;
};

type Progress = {
  status: string;
  generation: number;
  maxGenerations: number;
  evaluated: number;
  bestFitness: number;
  bestWinRateTrain: number;
  bestWinRateTest: number;
  bestProfitFactor: number;
  message: string;
  top10: TopRow[];
  targetMet: boolean;
  error?: string;
};

type BestFile = {
  updatedAt: string;
  targetMet: boolean;
  label?: string;
  genome: Record<string, unknown>;
  metrics: {
    trainWinRate: number;
    testWinRate: number;
    profitFactor: number;
    maxDrawdown: number;
    avgRR: number;
    trainTrades: number;
    testTrades: number;
  };
  equityCurve: { t: number; equity: number }[];
};

type SeedGenome = {
  rsiLow: number;
  rsiHigh: number;
  volumeMult: number;
  emaFast: number;
  emaSlow: number;
  distFromLowMin: number;
  distFromLowMax: number;
  macdRequired: boolean;
  higherLowsRequired: boolean;
  bosRequired: boolean;
  fvgRequired: boolean;
  orderBlockRequired: boolean;
  smcMinHits: number;
  slAtrMult: number;
  tp1R: number;
  tp2R: number;
  tp3R: number;
  maxRiskPct: number;
  minPillars: number;
  requireIndicators: boolean;
  requireCandlesOrPeaks: boolean;
};

const DEFAULT_SEED: SeedGenome = {
  rsiLow: 58,
  rsiHigh: 64,
  volumeMult: 2.6,
  emaFast: 21,
  emaSlow: 55,
  distFromLowMin: 0.4,
  distFromLowMax: 3.2,
  macdRequired: true,
  higherLowsRequired: true,
  bosRequired: true,
  fvgRequired: true,
  orderBlockRequired: false,
  smcMinHits: 2,
  slAtrMult: 1.6,
  tp1R: 2,
  tp2R: 3.8,
  tp3R: 6.5,
  maxRiskPct: 0.022,
  minPillars: 2,
  requireIndicators: true,
  requireCandlesOrPeaks: true,
};

function fmt(n: unknown, d = 1) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x.toFixed(d) : "0";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-[#8a97a8]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-[#0d1520] px-2.5 py-2 text-sm text-white outline-none focus:border-[#d4a017]/60";

export function BacktestLab() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [best, setBest] = useState<BestFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [adoptMsg, setAdoptMsg] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [symbols, setSymbols] = useState<string[]>([
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "ADAUSDT",
  ]);
  const [coinQuery, setCoinQuery] = useState("");
  const [coinHits, setCoinHits] = useState<CoinHit[]>([]);
  const [coinSearchBusy, setCoinSearchBusy] = useState(false);
  const [coinSearchOpen, setCoinSearchOpen] = useState(false);
  const [coinSearchMsg, setCoinSearchMsg] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [years, setYears] = useState(1);
  const [intervals, setIntervals] = useState<Array<"1h" | "4h" | "1d">>(["1h"]);
  const [generations, setGenerations] = useState(100);
  const [populationSize, setPopulationSize] = useState(30);
  const [eliteCount, setEliteCount] = useState(6);
  const [mutationRate, setMutationRate] = useState(0.35);
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [minTrainWR, setMinTrainWR] = useState(58);
  const [minTestWR, setMinTestWR] = useState(52);
  const [minPF, setMinPF] = useState(1.5);
  const [minTrades, setMinTrades] = useState(100);
  const [forceReload, setForceReload] = useState(true);
  const [seed, setSeed] = useState<SeedGenome>(DEFAULT_SEED);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/backtest/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (data.progress) setProgress(data.progress);
      if (data.bestStrategy) setBest(data.bestStrategy);
      return data.progress as Progress | undefined;
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحديث الحالة");
      return undefined;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, [refresh]);

  const running = progress?.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void refresh(), 1200);
    return () => clearInterval(id);
  }, [running, refresh]);

  function toggleCoin(sym: string) {
    setSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  }

  useEffect(() => {
    const q = coinQuery.trim();
    if (q.length < 2) {
      setCoinHits([]);
      setCoinSearchBusy(false);
      setCoinSearchOpen(false);
      return;
    }

    setCoinSearchBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coins?q=${encodeURIComponent(q)}&limit=24`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const data = (await res.json()) as { ok?: boolean; coins?: CoinHit[] };
        const coins = data.ok && data.coins ? data.coins : [];
        setCoinHits(coins);
        setCoinSearchOpen(coins.length > 0);

        if (!coins.length) {
          setCoinSearchMsg("لا نتائج مطابقة");
          return;
        }

        const exact = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const exactUsdt = exact.endsWith("USDT") ? exact : `${exact}USDT`;
        const strong = coins.filter(
          (c) =>
            c.symbol === exactUsdt ||
            c.base === exact ||
            c.base.startsWith(exact) ||
            c.symbol.startsWith(exact),
        );
        const candidates = (strong.length ? strong : coins).slice(0, 12).map((c) => c.symbol);

        let addedList: string[] = [];
        setSymbols((prev) => {
          addedList = candidates.filter((s) => !prev.includes(s));
          return addedList.length ? [...prev, ...addedList] : prev;
        });

        if (addedList.length === 0) {
          setCoinSearchMsg("كل النتائج مضافة مسبقاً");
        } else {
          setCoinSearchMsg(
            addedList.length === 1
              ? `تمت إضافة ${addedList[0]!.replace("USDT", "")} تلقائياً`
              : `تمت إضافة ${addedList.length} عملة تلقائياً بعد البحث`,
          );
        }

        if (coins.some((c) => c.base === exact || c.symbol === exactUsdt)) {
          setCoinQuery("");
          setCoinHits([]);
          setCoinSearchOpen(false);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setCoinHits([]);
          setCoinSearchMsg("فشل البحث — حاول مجدداً");
        }
      } finally {
        setCoinSearchBusy(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [coinQuery]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setCoinSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggleInterval(iv: "1h" | "4h" | "1d") {
    setIntervals((prev) => {
      if (prev.includes(iv)) {
        const next = prev.filter((x) => x !== iv);
        return next.length ? next : prev;
      }
      return [...prev, iv];
    });
  }

  function applyPreset(kind: "quick" | "medium" | "full") {
    if (kind === "quick") {
      setSymbols(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);
      setYears(1);
      setIntervals(["1h"]);
      setGenerations(40);
      setPopulationSize(24);
      setEliteCount(5);
    } else if (kind === "medium") {
      setSymbols(COIN_POOL.slice(0, 8));
      setYears(1);
      setIntervals(["1h"]);
      setGenerations(100);
      setPopulationSize(30);
      setEliteCount(6);
    } else {
      setSymbols(COIN_POOL.slice(0, 12));
      setYears(1);
      setIntervals(["1h"]);
      setGenerations(100);
      setPopulationSize(30);
      setEliteCount(7);
    }
    setMinTrainWR(58);
    setMinTestWR(52);
    setMinPF(1.5);
    setMinTrades(100);
    setTrainRatio(0.7);
    setForceReload(true);
  }

  async function start() {
    if (!symbols.length) {
      setError("اختر عملة واحدة على الأقل");
      return;
    }
    setBusy(true);
    setError("");
    setAdoptMsg("");
    setProgress((p) => ({
      status: "running",
      generation: 0,
      maxGenerations: generations,
      evaluated: 0,
      bestFitness: p?.bestFitness ?? 0,
      bestWinRateTrain: p?.bestWinRateTrain ?? 0,
      bestWinRateTest: p?.bestWinRateTest ?? 0,
      bestProfitFactor: p?.bestProfitFactor ?? 0,
      message: "جاري التحميل وبدء التحسين…",
      top10: p?.top10 ?? [],
      targetMet: false,
    }));

    const config = {
      symbols,
      years,
      intervals,
      generations,
      populationSize,
      eliteCount,
      mutationRate,
      trainRatio,
      minTrainWR,
      minTestWR,
      minPF,
      minTrades,
      forceReloadDataset: forceReload,
      seedGenome: seed,
    };

    try {
      const res = await fetch("/api/backtest/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "custom", config }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "start_failed");
      if (data.progress) setProgress(data.progress);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل البدء");
      setProgress((p) => (p ? { ...p, status: "error" } : p));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const res = await fetch("/api/backtest/cancel", { method: "POST" });
      const data = await res.json();
      if (data.progress) setProgress(data.progress);
      else setProgress((p) => (p ? { ...p, status: "idle", message: "تم إيقاف الاختبار" } : p));
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الإيقاف");
    } finally {
      setBusy(false);
    }
  }

  async function adopt(genome?: Record<string, unknown>) {
    setAdoptMsg("");
    try {
      const res = await fetch("/api/backtest/adopt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(genome ? { genome } : { fromBest: true }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "adopt_failed");
      setAdoptMsg("تم اعتماد الإعدادات في الموقع الرئيسي");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الاعتماد");
    }
  }

  const pct = useMemo(() => {
    if (!progress) return 0;
    if (progress.status === "done") return 100;
    if (!progress.maxGenerations) return running ? 8 : 0;
    const genPct = (progress.generation / progress.maxGenerations) * 85;
    const evalBoost = Math.min(10, (progress.evaluated / 3000) * 10);
    return Math.min(95, Math.round(Math.max(8, genPct + evalBoost)));
  }, [progress, running]);

  const curve = best?.equityCurve?.length ? best.equityCurve : [];
  const maxEq = Math.max(100, ...curve.map((p) => p.equity), 100);
  const minEq = Math.min(100, ...curve.map((p) => p.equity), 100);

  const uniqueTop10 = useMemo(() => {
    const rows = progress?.top10 ?? [];
    const seen = new Set<string>();
    const out: TopRow[] = [];
    for (const row of rows) {
      const soft = `${row.fitness.toFixed(1)}|${row.trainWR}|${row.testWR}|${row.trainTrades}|${row.testTrades}`;
      const genomeKey = JSON.stringify(row.genome);
      if (seen.has(soft) || seen.has(genomeKey)) continue;
      seen.add(soft);
      seen.add(genomeKey);
      out.push(row);
      if (out.length >= 10) break;
    }
    return out;
  }, [progress?.top10]);

  const trainWR = progress?.bestWinRateTrain ?? best?.metrics.trainWinRate ?? 0;
  const testWR = progress?.bestWinRateTest ?? best?.metrics.testWinRate ?? 0;
  // Overfit only when train is much higher than test (test>train is healthy)
  const overfitWarn = trainWR - testWR > 15;

  const adoptedPF = best?.metrics.profitFactor ?? progress?.bestProfitFactor ?? 0;
  const qualityOk =
    (trainWR >= 55 && adoptedPF >= 3.5) || (trainWR >= 60 && adoptedPF >= 2.0);
  const canAdoptBest =
    !best?.targetMet &&
    testWR >= 55 &&
    (best?.metrics.testTrades ?? uniqueTop10[0]?.testTrades ?? 0) >= 30 &&
    qualityOk &&
    !overfitWarn;

  if (!mounted) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#0a1018", color: "#e8eef5" }}
        dir="rtl"
      >
        <div className="flex items-center gap-3 text-[#d4a017]">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg font-semibold">جاري فتح محرك الاختبار…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg,#121a24 0%,#0a1018 55%,#070b10 100%)", color: "#e8eef5" }}
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-[#d4a017]">
              <FlaskConical className="h-5 w-5" />
              <span className="text-sm font-semibold">محرك التحسين التلقائي</span>
            </div>
            <h1 className="text-3xl font-bold text-white">الاختبار الذكي · إعدادات كاملة</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9aa8b8]">
              اختر العملات · الأجيال · حجم المجتمع · الإطارات · أهداف القبول · بذرة الاستراتيجية
            </p>
            {best?.targetMet && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">
                {best.label ?? "النتيجة المعتمدة ✅"}
                <span className="font-normal text-emerald-200/80">
                  · Train {best.metrics.trainWinRate}% · Test {best.metrics.testWinRate}% · PF{" "}
                  {best.metrics.profitFactor} · DD {best.metrics.maxDrawdown}%
                </span>
              </div>
            )}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            العودة للوحة
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Presets + start */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={running} onClick={() => applyPreset("quick")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40">
            إعداد سريع
          </button>
          <button type="button" disabled={running} onClick={() => applyPreset("medium")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40">
            إعداد متوسط
          </button>
          <button type="button" disabled={running} onClick={() => applyPreset("full")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40">
            إعداد كامل
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || running}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-[#d4a017] px-5 py-2.5 text-sm font-bold text-[#111] disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "جاري التشغيل…" : "ابدأ الاختبار الذكي"}
          </button>
          {running && (
            <button
              type="button"
              onClick={() => void stop()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/25"
            >
              <Square className="h-4 w-4" />
              إيقاف
            </button>
          )}
        </div>

        {/* Settings panel */}
        <div className="mb-6 space-y-4 rounded-2xl border border-white/15 bg-[#152030] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">إعدادات التشغيل</h2>
            <button type="button" className="text-xs text-[#d4a017]" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? "إخفاء المتقدم" : "إظهار المتقدم"}
            </button>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#8a97a8]">العملات ({symbols.length})</span>
              <div className="flex gap-2">
                <button type="button" disabled={running} className="text-[11px] text-[#d4a017]" onClick={() => setSymbols([...COIN_POOL])}>
                  تحديد الكل
                </button>
                <button type="button" disabled={running} className="text-[11px] text-[#8a97a8]" onClick={() => setSymbols([])}>
                  مسح
                </button>
              </div>
            </div>
            <div className="mb-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1520] p-3">
              {COIN_POOL.map((sym) => {
                const on = symbols.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    disabled={running}
                    onClick={() => toggleCoin(sym)}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${on ? "bg-[#d4a017] text-[#111]" : "bg-white/5 text-[#9aa8b8] hover:bg-white/10"}`}
                  >
                    {sym.replace("USDT", "")}
                  </button>
                );
              })}
              {symbols
                .filter((s) => !COIN_POOL.includes(s))
                .map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    disabled={running}
                    onClick={() => toggleCoin(sym)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-300"
                  >
                    {sym.replace("USDT", "")}
                    <X className="h-3 w-3" />
                  </button>
                ))}
            </div>
            <div className="relative mb-1" ref={searchBoxRef}>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8796]" />
                <input
                  className={`${inputCls} ps-9`}
                  placeholder="اكتب حرفين على الأقل… البحث والإضافة تلقائيان"
                  value={coinQuery}
                  disabled={running}
                  onChange={(e) => {
                    setCoinQuery(e.target.value);
                    setCoinSearchMsg("");
                  }}
                  onFocus={() => coinHits.length > 0 && setCoinSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCoinSearchOpen(false);
                  }}
                />
                {coinSearchBusy && (
                  <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#d4a017]" />
                )}
              </div>
              {coinSearchOpen && coinHits.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#0d1520] shadow-2xl">
                  <div className="border-b border-white/10 px-3 py-2 text-[11px] text-[#8a97a8]">
                    نتائج البحث — تُضاف تلقائياً
                  </div>
                  {coinHits.map((hit) => {
                    const already = symbols.includes(hit.symbol);
                    return (
                      <div
                        key={hit.symbol}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-white">
                          {hit.base}
                          <span className="ms-1 text-[10px] text-[#7a8796]">USDT</span>
                        </span>
                        <span className="flex items-center gap-2 text-[11px]">
                          <span className={hit.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {hit.changePct >= 0 ? "+" : ""}
                            {hit.changePct.toFixed(1)}%
                          </span>
                          <span className={already ? "text-emerald-400" : "text-[#d4a017]"}>
                            {already ? "✓ مضافة" : "…تُضاف"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {coinSearchMsg && <p className="mb-2 text-[11px] text-emerald-400/90">{coinSearchMsg}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="سنوات البيانات">
              <select className={inputCls} disabled={running} value={years} onChange={(e) => setYears(Number(e.target.value))}>
                <option value={1}>1 سنة</option>
                <option value={2}>2 سنة</option>
                <option value={3}>3 سنوات</option>
              </select>
            </Field>
            <Field label="عدد الأجيال">
              <input className={inputCls} type="number" min={2} max={40} disabled={running} value={generations} onChange={(e) => setGenerations(Number(e.target.value))} />
            </Field>
            <Field label="حجم المجتمع (Population)">
              <input className={inputCls} type="number" min={4} max={48} disabled={running} value={populationSize} onChange={(e) => setPopulationSize(Number(e.target.value))} />
            </Field>
            <Field label="النخبة (Elite)">
              <input className={inputCls} type="number" min={2} max={20} disabled={running} value={eliteCount} onChange={(e) => setEliteCount(Number(e.target.value))} />
            </Field>
          </div>

          <div>
            <span className="mb-2 block text-xs text-[#8a97a8]">الإطارات الزمنية</span>
            <div className="flex flex-wrap gap-2">
              {(["1h", "4h", "1d"] as const).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  disabled={running}
                  onClick={() => toggleInterval(iv)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${intervals.includes(iv) ? "bg-[#d4a017] text-[#111]" : "bg-white/5 text-[#9aa8b8]"}`}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>

          {showAdvanced && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="نسبة طفرة Mutation (0.05–0.8)">
                  <input className={inputCls} type="number" step={0.01} min={0.05} max={0.8} disabled={running} value={mutationRate} onChange={(e) => setMutationRate(Number(e.target.value))} />
                </Field>
                <Field label="نسبة التدريب Train (0.55–0.85)">
                  <input className={inputCls} type="number" step={0.01} min={0.55} max={0.85} disabled={running} value={trainRatio} onChange={(e) => setTrainRatio(Number(e.target.value))} />
                </Field>
                <Field label="حد Train WR %">
                  <input className={inputCls} type="number" min={40} max={99} disabled={running} value={minTrainWR} onChange={(e) => setMinTrainWR(Number(e.target.value))} />
                </Field>
                <Field label="حد Test WR %">
                  <input className={inputCls} type="number" min={30} max={99} disabled={running} value={minTestWR} onChange={(e) => setMinTestWR(Number(e.target.value))} />
                </Field>
                <Field label="حد Profit Factor">
                  <input className={inputCls} type="number" step={0.1} min={1} max={10} disabled={running} value={minPF} onChange={(e) => setMinPF(Number(e.target.value))} />
                </Field>
                <Field label="أقل عدد صفقات تدريب">
                  <input className={inputCls} type="number" min={5} max={200} disabled={running} value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))} />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-xs text-[#9aa8b8]">
                  <input type="checkbox" disabled={running} checked={forceReload} onChange={(e) => setForceReload(e.target.checked)} />
                  إعادة تحميل البيانات إجبارياً
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0d1520] p-4">
                <h3 className="mb-3 text-xs font-semibold text-[#d4a017]">بذرة الاستراتيجية (نقطة البداية للجينوم)</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="RSI من">
                    <input className={inputCls} type="number" disabled={running} value={seed.rsiLow} onChange={(e) => setSeed({ ...seed, rsiLow: Number(e.target.value) })} />
                  </Field>
                  <Field label="RSI إلى">
                    <input className={inputCls} type="number" disabled={running} value={seed.rsiHigh} onChange={(e) => setSeed({ ...seed, rsiHigh: Number(e.target.value) })} />
                  </Field>
                  <Field label="مضاعف الحجم">
                    <input className={inputCls} type="number" step={0.05} disabled={running} value={seed.volumeMult} onChange={(e) => setSeed({ ...seed, volumeMult: Number(e.target.value) })} />
                  </Field>
                  <Field label="EMA سريع">
                    <input className={inputCls} type="number" disabled={running} value={seed.emaFast} onChange={(e) => setSeed({ ...seed, emaFast: Number(e.target.value) })} />
                  </Field>
                  <Field label="EMA بطيء">
                    <input className={inputCls} type="number" disabled={running} value={seed.emaSlow} onChange={(e) => setSeed({ ...seed, emaSlow: Number(e.target.value) })} />
                  </Field>
                  <Field label="بعد القاع من %">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.distFromLowMin} onChange={(e) => setSeed({ ...seed, distFromLowMin: Number(e.target.value) })} />
                  </Field>
                  <Field label="بعد القاع إلى %">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.distFromLowMax} onChange={(e) => setSeed({ ...seed, distFromLowMax: Number(e.target.value) })} />
                  </Field>
                  <Field label="حد أدنى SMC hits">
                    <input className={inputCls} type="number" min={1} max={3} disabled={running} value={seed.smcMinHits} onChange={(e) => setSeed({ ...seed, smcMinHits: Number(e.target.value) })} />
                  </Field>
                  <Field label="SL × ATR">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.slAtrMult} onChange={(e) => setSeed({ ...seed, slAtrMult: Number(e.target.value) })} />
                  </Field>
                  <Field label="TP1 R">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.tp1R} onChange={(e) => setSeed({ ...seed, tp1R: Number(e.target.value) })} />
                  </Field>
                  <Field label="TP2 R">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.tp2R} onChange={(e) => setSeed({ ...seed, tp2R: Number(e.target.value) })} />
                  </Field>
                  <Field label="TP3 R">
                    <input className={inputCls} type="number" step={0.1} disabled={running} value={seed.tp3R} onChange={(e) => setSeed({ ...seed, tp3R: Number(e.target.value) })} />
                  </Field>
                  <Field label="أقصى مخاطرة %">
                    <input className={inputCls} type="number" step={0.001} disabled={running} value={seed.maxRiskPct} onChange={(e) => setSeed({ ...seed, maxRiskPct: Number(e.target.value) })} />
                  </Field>
                  <Field label="أقل ركائز">
                    <input className={inputCls} type="number" min={2} max={4} disabled={running} value={seed.minPillars} onChange={(e) => setSeed({ ...seed, minPillars: Number(e.target.value) })} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9aa8b8]">
                  {(
                    [
                      ["macdRequired", "MACD إلزامي"],
                      ["higherLowsRequired", "قيعان صاعدة"],
                      ["bosRequired", "BOS إلزامي"],
                      ["fvgRequired", "FVG إلزامي"],
                      ["orderBlockRequired", "Order Block إلزامي"],
                      ["requireIndicators", "مؤشرات إلزامية"],
                      ["requireCandlesOrPeaks", "شموع أو قيعان"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        disabled={running}
                        checked={Boolean(seed[key])}
                        onChange={(e) => setSeed({ ...seed, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Progress + equity */}
        <div className="mb-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/15 bg-[#152030] p-5 shadow-xl">
            <div className="mb-2 flex justify-between text-xs text-[#9aa8b8]">
              <span>{progress?.message || "جاهز — عدّل الإعدادات ثم ابدأ"}</span>
              <span>
                جيل {progress?.generation ?? 0}/{progress?.maxGenerations ?? generations} · تقييمات{" "}
                {progress?.evaluated ?? 0}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-l from-[#d4a017] to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Train WR", `${fmt(progress?.bestWinRateTrain)}%`],
                ["Test WR", `${fmt(progress?.bestWinRateTest)}%`],
                ["PF", fmt(progress?.bestProfitFactor, 2)],
                ["Fitness", fmt(progress?.bestFitness)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-[#0d1520] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-[#7a8796]">{k}</div>
                  <div className="text-lg font-semibold text-emerald-300">{v}</div>
                </div>
              ))}
            </div>
            {overfitWarn && (
              <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300">
                مرفوض - حفظ ماضي Overfitting (Train أعلى من Test بـ {fmt(trainWR - testWR)}%)
              </div>
            )}
            {best?.targetMet && !overfitWarn && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                {best.label ?? "النتيجة المعتمدة ✅"}
              </div>
            )}
            {progress?.targetMet && !best?.targetMet && !overfitWarn && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> تم بلوغ الهدف المنطقي
              </div>
            )}
            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
            {progress?.error && <p className="mt-3 text-sm text-rose-400">{progress.error}</p>}
            {adoptMsg && <p className="mt-3 text-sm text-emerald-400">{adoptMsg}</p>}
          </div>

          <div className="rounded-2xl border border-white/15 bg-[#152030] p-5 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-[#c5d0dc]">منحنى رأس المال</h2>
            <div className="relative flex h-40 items-center justify-center rounded-xl border border-white/10 bg-[#0d1520]">
              {curve.length > 1 ? (
                <svg viewBox="0 0 320 140" className="h-full w-full p-2">
                  <polyline
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    points={curve
                      .map((p, i) => {
                        const x = (i / Math.max(1, curve.length - 1)) * 310 + 5;
                        const y = 130 - ((p.equity - minEq) / Math.max(1e-6, maxEq - minEq)) * 110;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
              ) : (
                <p className="px-4 text-center text-sm text-[#7a8796]">يظهر بعد انتهاء الجولة</p>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9aa8b8]">
              <div>Train WR: {best?.metrics.trainWinRate ?? 0}%</div>
              <div>Test WR: {best?.metrics.testWinRate ?? 0}%</div>
              <div>PF: {best?.metrics.profitFactor ?? 0}</div>
              <div>DD: {best?.metrics.maxDrawdown ?? 0}%</div>
              <div>Train trades: {best?.metrics.trainTrades ?? 0}</div>
              <div>Test trades: {best?.metrics.testTrades ?? 0}</div>
            </div>
            {canAdoptBest ? (
              <button
                type="button"
                onClick={() => void adopt()}
                className="mt-4 w-full rounded-xl border border-[#d4a017]/50 bg-[#d4a017]/20 px-4 py-2.5 text-sm font-semibold text-[#f0d78c]"
              >
                اعتمد هذه الإعدادات في الموقع الرئيسي
              </button>
            ) : best?.targetMet ? (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-semibold text-emerald-300">
                {best.label ?? "النتيجة المعتمدة ✅"} — مفعّلة في التطبيق
              </p>
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-xs text-[#8a97a8]">
                الاعتماد يتطلب: (WR≥55 و PF≥3.5) أو (WR≥60 و PF≥2.0) · Test≥55% · بدون Overfitting
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#152030] shadow-xl">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
            أفضل 10 تركيبات (فريدة فقط)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white">
              <thead className="bg-black/30 text-xs text-[#7a8796]">
                <tr>
                  {["#", "Fitness", "Train WR", "Test WR", "فرق WR", "PF", "DD", "R:R", "Trades", "حالة", "اعتماد"].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 text-start">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {uniqueTop10.map((row, i) => {
                  const gap = Math.abs(row.trainWR - row.testWR);
                  const rowOverfit = row.trainWR - row.testWR > 15;
                  const rowQuality =
                    (row.trainWR >= 55 && row.pf >= 3.5) || (row.trainWR >= 60 && row.pf >= 2.0);
                  const canAdoptRow =
                    row.testWR >= 55 && row.testTrades >= 30 && rowQuality && !rowOverfit;
                  return (
                    <tr key={`${row.fitness}-${row.trainWR}-${row.testWR}-${i}`} className="border-t border-white/10">
                      <td className="px-3 py-2 text-[#7a8796]">{i + 1}</td>
                      <td className="px-3 py-2">{row.fitness}</td>
                      <td className="px-3 py-2 text-emerald-300">{row.trainWR}%</td>
                      <td className="px-3 py-2 text-sky-300">{row.testWR}%</td>
                      <td className={`px-3 py-2 ${rowOverfit ? "font-semibold text-rose-400" : "text-[#c5d0dc]"}`}>
                        {gap.toFixed(1)}%
                        {rowOverfit ? " · حفظ ماضي" : ""}
                      </td>
                      <td className="px-3 py-2">{row.pf}</td>
                      <td className="px-3 py-2">{row.dd}%</td>
                      <td className="px-3 py-2">{row.avgRR}</td>
                      <td className="px-3 py-2">
                        {row.trainTrades}/{row.testTrades}
                      </td>
                      <td className="px-3 py-2">
                        {rowOverfit ? (
                          <span className="text-rose-400">مرفوض - Overfitting</span>
                        ) : row.accepted ? (
                          <span className="text-emerald-400">مقبول</span>
                        ) : (
                          <span className="text-amber-400">مرفوض</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canAdoptRow ? (
                          <button
                            type="button"
                            className="rounded-md border border-white/15 px-2 py-1 text-xs"
                            onClick={() => void adopt(row.genome)}
                          >
                            اعتماد
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#7a8796]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!uniqueTop10.length && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-[#7a8796]">
                      لا تجارب بعد — اضبط الخيارات ثم ابدأ (1500×1h · 70/30 · 3000 تجربة)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {best?.genome && (
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-white/15 bg-[#0d1520] p-4 text-xs text-[#9aa8b8]">
            {JSON.stringify(best.genome, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
