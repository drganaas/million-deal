import { splitBundles } from "./backtestEngine";
import { runGeneticOptimization } from "./geneticOptimizer";
import { CancelledError, loadOptimizeDataset } from "./historyLoader";
import {
  clearCancelFlag,
  getJobState,
  persistJobSnapshot,
  saveBestStrategy,
  setJobProgress,
  throwIfCancelled,
} from "./jobStore";
import type { HistoryBundle, OptimizeJobConfig } from "./types";
import { DEFAULT_OPTIMIZE_CONFIG } from "./types";

const g = globalThis as unknown as {
  __mdDataset?: {
    train: HistoryBundle[];
    test: HistoryBundle[];
    meta: { symbols: number; bars: number; years: number; key: string };
  };
};

function datasetKey(cfg: OptimizeJobConfig) {
  return [
    cfg.years,
    [...cfg.intervals].sort().join(","),
    [...cfg.symbols].map((s) => s.toUpperCase()).sort().join(","),
    cfg.trainRatio,
  ].join("|");
}

export type RunMode = "quick" | "full" | "custom";

function resolveConfig(
  mode: RunMode,
  custom?: Partial<OptimizeJobConfig>,
): OptimizeJobConfig {
  if (mode === "custom" || custom) {
    const base = { ...DEFAULT_OPTIMIZE_CONFIG, ...(custom ?? {}) };
    base.symbols = (base.symbols?.length ? base.symbols : DEFAULT_OPTIMIZE_CONFIG.symbols).map(
      (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    );
    if (!base.symbols.length) base.symbols = [...DEFAULT_OPTIMIZE_CONFIG.symbols];
    if (base.symbols.length > 24) base.symbols = base.symbols.slice(0, 24);
    base.intervals = ["1h"];
    base.years = Math.min(3, Math.max(1, Number(base.years) || 1));
    base.generations = Math.min(120, Math.max(2, Number(base.generations) || 100));
    base.populationSize = Math.min(48, Math.max(4, Number(base.populationSize) || 30));
    base.eliteCount = Math.min(
      Math.max(2, Number(base.eliteCount) || 6),
      Math.floor(base.populationSize / 2),
    );
    base.mutationRate = Math.min(0.8, Math.max(0.05, Number(base.mutationRate) || 0.35));
    base.trainRatio = 0.7;
    base.minTrainWR = Math.min(78, Math.max(50, Number(base.minTrainWR) || 58));
    base.minTestWR = Math.min(78, Math.max(40, Number(base.minTestWR) || 52));
    base.minPF = Math.min(3.2, Math.max(1.2, Number(base.minPF) || 1.5));
    base.minTrades = Math.min(300, Math.max(40, Number(base.minTrades) || 100));
    return base;
  }
  if (mode === "full") {
    return {
      ...DEFAULT_OPTIMIZE_CONFIG,
      symbols: [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "SOLUSDT",
        "XRPUSDT",
        "ADAUSDT",
        "AVAXUSDT",
        "LINKUSDT",
      ],
      years: 3,
      intervals: ["1h", "4h", "1d"],
      generations: 16,
      populationSize: 28,
      eliteCount: 7,
    };
  }
  return { ...DEFAULT_OPTIMIZE_CONFIG };
}

export async function ensureDataset(cfg: OptimizeJobConfig) {
  const key = datasetKey(cfg);
  if (g.__mdDataset && g.__mdDataset.meta.key === key && !cfg.forceReloadDataset) {
    return g.__mdDataset;
  }

  setJobProgress({
    status: "running",
    message: `تحميل بيانات ${cfg.years} سنة · ${cfg.symbols.length} عملة…`,
    startedAt: new Date().toISOString(),
  });

  const bundles = await loadOptimizeDataset(
    cfg.years,
    cfg.intervals,
    cfg.symbols,
    (msg) => setJobProgress({ message: msg, status: "running" }),
    () => Boolean(getJobState().cancelRequested),
  );

  throwIfCancelled();

  if (!bundles.length) {
    throw new Error("لا بيانات كافية للعملات/الإطارات المختارة");
  }

  const { train, test } = splitBundles(bundles, cfg.trainRatio);
  const bars = bundles.reduce((a, b) => a + b.candles.length, 0);
  const meta = { symbols: cfg.symbols.length, bars, years: cfg.years, key };
  g.__mdDataset = { train, test, meta };
  const job = getJobState();
  job.datasetReady = true;
  job.datasetMeta = meta;
  await persistJobSnapshot();
  return g.__mdDataset;
}

export async function runOptimizeJob(
  mode: RunMode = "quick",
  custom?: Partial<OptimizeJobConfig>,
) {
  const cfg = resolveConfig(mode, custom);
  const job = getJobState();
  clearCancelFlag();

  try {
    setJobProgress({
      status: "running",
      generation: 0,
      maxGenerations: cfg.generations,
      evaluated: 0,
      message: "بدء المحرك…",
      top10: [],
      targetMet: false,
      startedAt: new Date().toISOString(),
      error: undefined,
    });

    const { train, test } = await ensureDataset(cfg);
    throwIfCancelled();

    setJobProgress({
      message: `بيانات جاهزة · ${job.datasetMeta?.bars ?? 0} شمعة · ${cfg.symbols.length} عملة · بدء الجينية`,
      maxGenerations: cfg.generations,
    });

    const { top10, bestAccepted, progress } = await runGeneticOptimization(train, test, {
      populationSize: cfg.populationSize,
      generations: cfg.generations,
      eliteCount: cfg.eliteCount,
      mutationRate: cfg.mutationRate,
      totalTrials: 3000,
      diversityRate: 0.2,
      seedGenome: cfg.seedGenome,
      minTrainWR: cfg.minTrainWR,
      minTestWR: cfg.minTestWR,
      minPF: cfg.minPF,
      minTrades: cfg.minTrades,
      shouldCancel: () => Boolean(getJobState().cancelRequested),
      onProgress: (p) => {
        setJobProgress({
          status: "running",
          generation: p.generation,
          maxGenerations: p.maxGenerations,
          evaluated: p.evaluated,
          bestFitness: p.bestFitness,
          bestWinRateTrain: p.bestWinRateTrain,
          bestWinRateTest: p.bestWinRateTest,
          bestProfitFactor: p.bestProfitFactor,
          message: p.message,
          top10: p.top10,
          targetMet: p.targetMet,
        });
      },
    });

    if (getJobState().cancelRequested) {
      setJobProgress({
        status: "idle",
        message: "تم إيقاف الاختبار",
        finishedAt: new Date().toISOString(),
      });
      return job.progress;
    }

    job.bestAccepted = bestAccepted;
    job.progress = { ...progress, status: "done", top10 };

    if (bestAccepted) {
      await saveBestStrategy(bestAccepted, "genetic");
      const { setActiveGenome } = await import("./activeGenome");
      setActiveGenome(bestAccepted.genome, true);
      setJobProgress({
        message: `تم حفظ أفضل إعداد مقبول · Train ${bestAccepted.train.winRate}% · Test ${bestAccepted.test.winRate}%`,
      });
    } else {
      setJobProgress({
        message: "اكتمل — لا إعداد مقبول (عينة/منع Overfitting). لم يُحفظ bestStrategy.",
      });
    }

    await persistJobSnapshot();
    return job.progress;
  } catch (e) {
    if (e instanceof CancelledError || (e instanceof Error && e.message.includes("أوقفه"))) {
      setJobProgress({
        status: "idle",
        message: "تم إيقاف الاختبار",
        finishedAt: new Date().toISOString(),
        error: undefined,
      });
      await persistJobSnapshot();
      return job.progress;
    }
    const msg = e instanceof Error ? e.message : "optimize_failed";
    setJobProgress({ status: "error", message: msg, error: msg });
    await persistJobSnapshot();
    throw e;
  }
}
