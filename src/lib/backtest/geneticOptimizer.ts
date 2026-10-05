import {
  evaluateWithHoldout,
  fitnessFromTrain,
} from "./backtestEngine";
import type {
  GenomeScore,
  HistoryBundle,
  OptimizeProgress,
  StrategyGenome,
} from "./types";
import { DEFAULT_GENOME } from "./types";

/** Total genome evaluations per optimize run */
export const TOTAL_TRIALS = 3000;
/** Fraction of gene fields randomly reshuffled each generation */
export const DIVERSITY_RATE = 0.2;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function rand(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}

function randInt(lo: number, hi: number) {
  return Math.floor(rand(lo, hi + 1));
}

function chance(p: number) {
  return Math.random() < p;
}

export function randomGenome(): StrategyGenome {
  const emaFast = randInt(15, 40);
  const rsiLow = randInt(50, 68);
  return {
    rsiLow,
    rsiHigh: clamp(rsiLow + randInt(6, 18), rsiLow + 4, 78),
    volumeMult: +rand(1.2, 3.0).toFixed(2),
    emaFast,
    emaSlow: clamp(emaFast + randInt(12, 35), emaFast + 10, 80),
    distFromLowMin: +rand(0.2, 1.2).toFixed(2),
    distFromLowMax: +rand(2.0, 4.5).toFixed(2),
    macdRequired: chance(0.75),
    higherLowsRequired: chance(0.7),
    bosRequired: chance(0.35),
    fvgRequired: chance(0.3),
    orderBlockRequired: chance(0.3),
    smcMinHits: randInt(1, 3),
    slAtrMult: +rand(1.2, 2.4).toFixed(2),
    tp1R: +rand(1.4, 2.8).toFixed(2),
    tp2R: +rand(2.5, 4.5).toFixed(2),
    tp3R: +rand(4.0, 8.0).toFixed(2),
    maxRiskPct: +rand(0.012, 0.028).toFixed(3),
    minPillars: randInt(2, 3),
    requireIndicators: chance(0.85),
    requireCandlesOrPeaks: chance(0.9),
  };
}

const GENE_KEYS: (keyof StrategyGenome)[] = [
  "rsiLow",
  "rsiHigh",
  "volumeMult",
  "emaFast",
  "emaSlow",
  "distFromLowMin",
  "distFromLowMax",
  "macdRequired",
  "higherLowsRequired",
  "bosRequired",
  "fvgRequired",
  "orderBlockRequired",
  "smcMinHits",
  "slAtrMult",
  "tp1R",
  "tp2R",
  "tp3R",
  "maxRiskPct",
  "minPillars",
  "requireIndicators",
  "requireCandlesOrPeaks",
];

function randomizeGene(key: keyof StrategyGenome, base: StrategyGenome): StrategyGenome[typeof key] {
  switch (key) {
    case "rsiLow":
      return randInt(50, 72);
    case "rsiHigh":
      return clamp(base.rsiLow + randInt(6, 18), base.rsiLow + 4, 78);
    case "volumeMult":
      return +rand(1.2, 3.0).toFixed(2);
    case "emaFast":
      return randInt(15, 50);
    case "emaSlow":
      return clamp(base.emaFast + randInt(12, 35), base.emaFast + 10, 80);
    case "distFromLowMin":
      return +rand(0.15, 1.5).toFixed(2);
    case "distFromLowMax":
      return +rand(1.8, 5).toFixed(2);
    case "macdRequired":
    case "higherLowsRequired":
    case "bosRequired":
    case "fvgRequired":
    case "orderBlockRequired":
    case "requireIndicators":
    case "requireCandlesOrPeaks":
      return chance(0.5);
    case "smcMinHits":
      return randInt(1, 3);
    case "slAtrMult":
      return +rand(1.1, 2.6).toFixed(2);
    case "tp1R":
      return +rand(1.2, 3.2).toFixed(2);
    case "tp2R":
      return +rand(2.2, 5).toFixed(2);
    case "tp3R":
      return +rand(3.5, 9).toFixed(2);
    case "maxRiskPct":
      return +rand(0.01, 0.03).toFixed(3);
    case "minPillars":
      return randInt(2, 4);
    default:
      return base[key];
  }
}

/** Randomly replace ~20% of gene values to avoid clone collapse. */
export function diversifyGenome(g: StrategyGenome, rate = DIVERSITY_RATE): StrategyGenome {
  const m = { ...g };
  for (const key of GENE_KEYS) {
    if (chance(rate)) {
      (m as Record<string, unknown>)[key] = randomizeGene(key, m);
    }
  }
  if (m.rsiHigh <= m.rsiLow) m.rsiHigh = m.rsiLow + 8;
  if (m.emaSlow <= m.emaFast) m.emaSlow = m.emaFast + 15;
  if (m.distFromLowMax <= m.distFromLowMin) m.distFromLowMax = m.distFromLowMin + 1.5;
  return m;
}

function mutate(g: StrategyGenome, rate = 0.25): StrategyGenome {
  const m = { ...g };
  const touch = (p: number) => chance(rate * p);
  if (touch(1)) m.rsiLow = clamp(m.rsiLow + randInt(-4, 4), 50, 72);
  if (touch(1)) m.rsiHigh = clamp(m.rsiHigh + randInt(-4, 4), m.rsiLow + 5, 78);
  if (touch(1)) m.volumeMult = +clamp(m.volumeMult + rand(-0.25, 0.25), 1.2, 3.0).toFixed(2);
  if (touch(1)) m.emaFast = clamp(m.emaFast + randInt(-5, 5), 15, 50);
  if (touch(1)) m.emaSlow = clamp(m.emaSlow + randInt(-6, 6), m.emaFast + 10, 80);
  if (touch(1)) m.distFromLowMin = +clamp(m.distFromLowMin + rand(-0.2, 0.2), 0.15, 1.5).toFixed(2);
  if (touch(1)) m.distFromLowMax = +clamp(m.distFromLowMax + rand(-0.3, 0.3), 1.8, 5).toFixed(2);
  if (touch(0.8)) m.macdRequired = chance(0.7);
  if (touch(0.8)) m.higherLowsRequired = chance(0.7);
  if (touch(0.8)) m.bosRequired = !m.bosRequired && chance(0.5) ? true : chance(0.3);
  if (touch(0.8)) m.fvgRequired = chance(0.35);
  if (touch(0.8)) m.orderBlockRequired = chance(0.35);
  if (touch(1)) m.smcMinHits = clamp(m.smcMinHits + randInt(-1, 1), 1, 3);
  if (touch(1)) m.slAtrMult = +clamp(m.slAtrMult + rand(-0.2, 0.2), 1.1, 2.6).toFixed(2);
  if (touch(1)) m.tp1R = +clamp(m.tp1R + rand(-0.3, 0.3), 1.2, 3.2).toFixed(2);
  if (touch(1)) m.tp2R = +clamp(m.tp2R + rand(-0.4, 0.4), 2.2, 5).toFixed(2);
  if (touch(1)) m.tp3R = +clamp(m.tp3R + rand(-0.5, 0.5), 3.5, 9).toFixed(2);
  if (touch(1)) m.maxRiskPct = +clamp(m.maxRiskPct + rand(-0.004, 0.004), 0.01, 0.03).toFixed(3);
  if (touch(0.7)) m.minPillars = clamp(m.minPillars + randInt(-1, 1), 2, 4);
  if (touch(0.6)) m.requireIndicators = chance(0.85);
  if (touch(0.6)) m.requireCandlesOrPeaks = chance(0.9);
  return m;
}

function crossover(a: StrategyGenome, b: StrategyGenome): StrategyGenome {
  const pick = <K extends keyof StrategyGenome>(k: K): StrategyGenome[K] =>
    chance(0.5) ? a[k] : b[k];
  const child: StrategyGenome = {
    rsiLow: pick("rsiLow"),
    rsiHigh: pick("rsiHigh"),
    volumeMult: pick("volumeMult"),
    emaFast: pick("emaFast"),
    emaSlow: pick("emaSlow"),
    distFromLowMin: pick("distFromLowMin"),
    distFromLowMax: pick("distFromLowMax"),
    macdRequired: pick("macdRequired"),
    higherLowsRequired: pick("higherLowsRequired"),
    bosRequired: pick("bosRequired"),
    fvgRequired: pick("fvgRequired"),
    orderBlockRequired: pick("orderBlockRequired"),
    smcMinHits: pick("smcMinHits"),
    slAtrMult: pick("slAtrMult"),
    tp1R: pick("tp1R"),
    tp2R: pick("tp2R"),
    tp3R: pick("tp3R"),
    maxRiskPct: pick("maxRiskPct"),
    minPillars: pick("minPillars"),
    requireIndicators: pick("requireIndicators"),
    requireCandlesOrPeaks: pick("requireCandlesOrPeaks"),
  };
  if (child.rsiHigh <= child.rsiLow) child.rsiHigh = child.rsiLow + 8;
  if (child.emaSlow <= child.emaFast) child.emaSlow = child.emaFast + 15;
  if (child.distFromLowMax <= child.distFromLowMin) {
    child.distFromLowMax = child.distFromLowMin + 1.5;
  }
  return child;
}

function genomeFingerprint(g: StrategyGenome): string {
  return [
    g.rsiLow,
    g.rsiHigh,
    g.volumeMult,
    g.emaFast,
    g.emaSlow,
    g.distFromLowMin,
    g.distFromLowMax,
    g.macdRequired,
    g.higherLowsRequired,
    g.bosRequired,
    g.fvgRequired,
    g.orderBlockRequired,
    g.smcMinHits,
    g.slAtrMult,
    g.tp1R,
    g.tp2R,
    g.tp3R,
    g.maxRiskPct,
    g.minPillars,
    g.requireIndicators,
    g.requireCandlesOrPeaks,
  ].join("|");
}

/** Keep unique genomes / unique metric signatures only. */
export function uniqueTopScores(scores: GenomeScore[], limit = 10): GenomeScore[] {
  const seen = new Set<string>();
  const out: GenomeScore[] = [];
  const sorted = [...scores].sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
    if (b.fitness !== a.fitness) return b.fitness - a.fitness;
    return b.test.winRate - a.test.winRate;
  });
  for (const s of sorted) {
    const fp = genomeFingerprint(s.genome);
    const soft = `${s.fitness.toFixed(1)}|${s.train.winRate}|${s.test.winRate}|${s.train.trades}|${s.test.trades}`;
    if (seen.has(fp) || seen.has(soft)) continue;
    seen.add(fp);
    seen.add(soft);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function scoreGenome(
  genome: StrategyGenome,
  train: HistoryBundle[],
  test: HistoryBundle[],
): GenomeScore {
  const holdout = evaluateWithHoldout(train, test, genome);
  const fitness = fitnessFromTrain(holdout.train, holdout.test);
  return {
    genome,
    train: holdout.train,
    test: holdout.test,
    fitness: +fitness.toFixed(2),
    accepted: holdout.accepted,
    rejectReason: holdout.rejectReason,
  };
}

export type GeneticConfig = {
  populationSize?: number;
  generations?: number;
  eliteCount?: number;
  mutationRate?: number;
  totalTrials?: number;
  diversityRate?: number;
  seedGenome?: Partial<StrategyGenome>;
  minTrainWR?: number;
  minTestWR?: number;
  minPF?: number;
  minTrades?: number;
  shouldCancel?: () => boolean;
  onProgress?: (p: Partial<OptimizeProgress> & { trial?: GenomeScore }) => void;
};

/**
 * Auto-optimize (genetic) — 3000 trials, 20% gene diversity/generation,
 * unique top-10, logical acceptance gates.
 */
export async function autoOptimize(
  train: HistoryBundle[],
  test: HistoryBundle[],
  cfg: GeneticConfig = {},
): Promise<{ top10: GenomeScore[]; bestAccepted: GenomeScore | null; progress: OptimizeProgress }> {
  const populationSize = cfg.populationSize ?? 30;
  const totalTrials = cfg.totalTrials ?? TOTAL_TRIALS;
  const generations = cfg.generations ?? Math.ceil(totalTrials / populationSize);
  const eliteCount = cfg.eliteCount ?? 6;
  const mutationRate = cfg.mutationRate ?? 0.35;
  const diversityRate = cfg.diversityRate ?? DIVERSITY_RATE;

  const seed: StrategyGenome = { ...DEFAULT_GENOME, ...(cfg.seedGenome ?? {}) };
  let population: StrategyGenome[] = [
    seed,
    ...Array.from({ length: Math.max(0, populationSize - 1) }, () => randomGenome()),
  ];

  let hallOfFame: GenomeScore[] = [];
  let bestAccepted: GenomeScore | null = null;
  let evaluated = 0;
  const seenEval = new Set<string>();

  const emit = (partial: Partial<OptimizeProgress>, trial?: GenomeScore) => {
    cfg.onProgress?.({ ...partial, trial });
  };

  const yieldTick = () => new Promise<void>((r) => setTimeout(r, 0));

  for (let gen = 1; gen <= generations && evaluated < totalTrials; gen++) {
    const scored: GenomeScore[] = [];
    for (const g of population) {
      if (evaluated >= totalTrials) break;
      const fp = genomeFingerprint(g);
      let s: GenomeScore;
      if (seenEval.has(fp)) {
        // Force diversity instead of re-scoring clones
        s = scoreGenome(diversifyGenome(g, 0.45), train, test);
      } else {
        seenEval.add(fp);
        s = scoreGenome(g, train, test);
      }
      scored.push(s);
      evaluated++;

      if (s.accepted) {
        if (!bestAccepted || s.test.winRate > bestAccepted.test.winRate) {
          bestAccepted = s;
        }
      }

      hallOfFame = uniqueTopScores([...hallOfFame, s], 10);

      emit(
        {
          status: "running",
          generation: gen,
          maxGenerations: generations,
          evaluated,
          bestFitness: hallOfFame[0]?.fitness ?? 0,
          bestWinRateTrain: hallOfFame[0]?.train.winRate ?? 0,
          bestWinRateTest: hallOfFame[0]?.test.winRate ?? 0,
          bestProfitFactor: hallOfFame[0]?.train.profitFactor ?? 0,
          message: `جيل ${gen}/${generations} · تجربة ${evaluated}/${totalTrials} · Train ${s.train.winRate}% · Test ${s.test.winRate}% · ${s.accepted ? "مقبول" : "مرفوض"}`,
          top10: [...hallOfFame],
          targetMet: Boolean(bestAccepted),
        },
        s,
      );

      await yieldTick();

      if (cfg.shouldCancel?.()) {
        const progress: OptimizeProgress = {
          status: "idle",
          generation: gen,
          maxGenerations: generations,
          evaluated,
          bestFitness: hallOfFame[0]?.fitness ?? 0,
          bestWinRateTrain: hallOfFame[0]?.train.winRate ?? 0,
          bestWinRateTest: hallOfFame[0]?.test.winRate ?? 0,
          bestProfitFactor: hallOfFame[0]?.train.profitFactor ?? 0,
          message: "تم إيقاف الاختبار",
          top10: [...hallOfFame],
          targetMet: Boolean(bestAccepted),
          finishedAt: new Date().toISOString(),
        };
        return { top10: hallOfFame, bestAccepted, progress };
      }
    }

    scored.sort((a, b) => b.fitness - a.fitness);
    const elites = scored.slice(0, eliteCount).map((s) => s.genome);
    const next: StrategyGenome[] = elites.map((e) => diversifyGenome(e, diversityRate * 0.5));
    while (next.length < populationSize) {
      const p1 = elites[randInt(0, Math.max(0, elites.length - 1))] ?? randomGenome();
      const p2 = elites[randInt(0, Math.max(0, elites.length - 1))] ?? randomGenome();
      let child = crossover(p1, p2);
      child = mutate(child, mutationRate);
      // 20% gene diversity every generation — prevents identical fitness clones
      child = diversifyGenome(child, diversityRate);
      next.push(child);
    }
    // Inject fresh random individuals each generation
    const inject = Math.max(2, Math.floor(populationSize * 0.15));
    for (let i = 0; i < inject; i++) {
      next[next.length - 1 - i] = randomGenome();
    }
    population = next;
    await yieldTick();
  }

  const progress: OptimizeProgress = {
    status: "done",
    generation: generations,
    maxGenerations: generations,
    evaluated,
    bestFitness: hallOfFame[0]?.fitness ?? 0,
    bestWinRateTrain: hallOfFame[0]?.train.winRate ?? 0,
    bestWinRateTest: hallOfFame[0]?.test.winRate ?? 0,
    bestProfitFactor: hallOfFame[0]?.train.profitFactor ?? 0,
    message: bestAccepted
      ? "اكتمل التحسين مع إعداد مقبول منطقياً"
      : "اكتمل التحسين — لم يُقبل أي إعداد (شروط العينة/منع الحفظ المفرط)",
    top10: [...hallOfFame],
    targetMet: Boolean(bestAccepted),
    finishedAt: new Date().toISOString(),
  };

  return { top10: hallOfFame, bestAccepted, progress };
}

/** Alias used by job runner */
export const runGeneticOptimization = autoOptimize;
