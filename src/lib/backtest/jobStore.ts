import { promises as fs } from "fs";
import path from "path";
import type { GenomeScore, OptimizeProgress, StrategyGenome } from "./types";
import { DEFAULT_GENOME } from "./types";

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, "config", "optimize-state.json");
const BEST_PATH = path.join(ROOT, "config", "bestStrategy.json");

export type BestStrategyFile = {
  updatedAt: string;
  source: "genetic" | "manual" | "cron";
  targetMet: boolean;
  label?: string;
  genome: StrategyGenome;
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
  top10Summary: Array<{
    fitness: number;
    trainWR: number;
    testWR: number;
    pf: number;
    accepted: boolean;
  }>;
  notes?: string;
};

export type JobState = {
  progress: OptimizeProgress;
  bestAccepted: GenomeScore | null;
  datasetReady: boolean;
  datasetMeta?: { symbols: number; bars: number; years: number };
  cancelRequested?: boolean;
  cancelReason?: string;
};

const g = globalThis as unknown as { __mdOptimizeJob?: JobState };

function defaultProgress(): OptimizeProgress {
  return {
    status: "idle",
    generation: 0,
    maxGenerations: 0,
    evaluated: 0,
    bestFitness: 0,
    bestWinRateTrain: 0,
    bestWinRateTest: 0,
    bestProfitFactor: 0,
    message: "جاهز لبدء الاختبار الذكي",
    top10: [],
    targetMet: false,
  };
}

export function getJobState(): JobState {
  if (!g.__mdOptimizeJob) {
    g.__mdOptimizeJob = {
      progress: defaultProgress(),
      bestAccepted: null,
      datasetReady: false,
      cancelRequested: false,
    };
  }
  return g.__mdOptimizeJob;
}

export function setJobProgress(partial: Partial<OptimizeProgress>) {
  const job = getJobState();
  job.progress = { ...job.progress, ...partial };
}

export function requestCancel(reason = "أوقفه المستخدم") {
  const job = getJobState();
  job.cancelRequested = true;
  job.cancelReason = reason;
  setJobProgress({
    status: "idle",
    message: reason,
    error: undefined,
  });
}

export function clearCancelFlag() {
  const job = getJobState();
  job.cancelRequested = false;
  job.cancelReason = undefined;
}

export function throwIfCancelled() {
  const job = getJobState();
  if (job.cancelRequested) {
    throw new Error(job.cancelReason || "أوقفه المستخدم");
  }
}

export async function saveBestStrategy(score: GenomeScore, source: BestStrategyFile["source"]) {
  const payload: BestStrategyFile = {
    updatedAt: new Date().toISOString(),
    source,
    targetMet: score.accepted,
    label: score.accepted ? "النتيجة المعتمدة ✅" : undefined,
    genome: score.genome,
    metrics: {
      trainWinRate: score.train.winRate,
      testWinRate: score.test.winRate,
      profitFactor: score.train.profitFactor,
      maxDrawdown: score.train.maxDrawdown,
      avgRR: score.train.avgRR,
      trainTrades: score.train.trades,
      testTrades: score.test.trades,
    },
    equityCurve: score.train.equityCurve.slice(-200),
    top10Summary: [],
  };
  await fs.mkdir(path.dirname(BEST_PATH), { recursive: true });
  await fs.writeFile(BEST_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function loadBestStrategy(): Promise<BestStrategyFile | null> {
  try {
    const raw = await fs.readFile(BEST_PATH, "utf8");
    return JSON.parse(raw) as BestStrategyFile;
  } catch {
    return null;
  }
}

export async function loadBestGenome(): Promise<StrategyGenome> {
  const best = await loadBestStrategy();
  return best?.genome ?? DEFAULT_GENOME;
}

export async function persistJobSnapshot() {
  const job = getJobState();
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(
    STATE_PATH,
    JSON.stringify(
      {
        progress: {
          ...job.progress,
          top10: job.progress.top10.map((t) => ({
            fitness: t.fitness,
            accepted: t.accepted,
            trainWR: t.train.winRate,
            testWR: t.test.winRate,
            pf: t.train.profitFactor,
            genome: t.genome,
          })),
        },
        datasetReady: job.datasetReady,
        datasetMeta: job.datasetMeta,
        bestAccepted: job.bestAccepted
          ? {
              accepted: job.bestAccepted.accepted,
              fitness: job.bestAccepted.fitness,
              trainWR: job.bestAccepted.train.winRate,
              testWR: job.bestAccepted.test.winRate,
              genome: job.bestAccepted.genome,
            }
          : null,
      },
      null,
      2,
    ),
    "utf8",
  );
}
