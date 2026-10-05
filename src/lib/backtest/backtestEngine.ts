import { evaluateEntryWithGenome } from "./genomeEntry";
import type {
  BacktestMetrics,
  BacktestTrade,
  EquityPoint,
  HistoryBundle,
  SplitResult,
  StrategyGenome,
  TradeOutcome,
} from "./types";

/** Target bars for optimize runs (1h only). */
export const OPTIMIZE_BARS_1H = 1500;
export const TRAIN_RATIO = 0.7;

function simulateTrade(
  candles: HistoryBundle["candles"],
  startIdx: number,
  sig: { entry: number; sl: number; tp1: number; tp2: number; tp3: number },
): Omit<BacktestTrade, "symbol" | "interval" | "entryTime"> {
  let outcome: TradeOutcome = "OPEN";
  let exit = candles.at(-1)!.close;
  let barsHeld = 0;
  for (let i = startIdx + 1; i < candles.length; i++) {
    const bar = candles[i];
    barsHeld = i - startIdx;
    // conservative: SL before TP if both in same bar
    if (bar.low <= sig.sl) {
      outcome = "SL";
      exit = sig.sl;
      break;
    }
    if (bar.high >= sig.tp3) {
      outcome = "TP3";
      exit = sig.tp3;
      break;
    }
    if (bar.high >= sig.tp2) {
      outcome = "TP2";
      exit = sig.tp2;
      break;
    }
    if (bar.high >= sig.tp1) {
      outcome = "TP1";
      exit = sig.tp1;
      break;
    }
  }
  const pnlPct = ((exit - sig.entry) / sig.entry) * 100;
  const risk = sig.entry - sig.sl;
  const rMultiple = risk > 0 ? (exit - sig.entry) / risk : 0;
  return { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, exit, outcome, pnlPct, rMultiple, barsHeld };
}

/**
 * Run backtest on a candle bundle.
 * Optimize path uses ~1500 × 1h bars with denser sampling for statistical sample size.
 */
export function runBacktest(
  bundle: HistoryBundle,
  genome: StrategyGenome,
  opts?: { startIdx?: number; endIdx?: number; step?: number; cooldown?: number },
): BacktestTrade[] {
  const { candles, symbol, interval } = bundle;
  const start = Math.max(opts?.startIdx ?? 80, 80);
  const end = Math.min(opts?.endIdx ?? candles.length - 8, candles.length - 8);
  const step = opts?.step ?? 2;
  const cooldown = opts?.cooldown ?? 4;
  const trades: BacktestTrade[] = [];
  let lastSignal = start - cooldown - 1;

  for (let i = start; i < end; i += step) {
    if (i - lastSignal < cooldown) continue;
    const slice = candles.slice(0, i + 1);
    const sig = evaluateEntryWithGenome(slice, genome);
    if (!sig) continue;
    const sim = simulateTrade(candles, i, sig);
    trades.push({
      symbol,
      interval,
      entryTime: candles[i].time,
      ...sim,
    });
    lastSignal = i;
  }
  return trades;
}

/** @deprecated alias — use runBacktest */
export const runBacktestOnBundle = runBacktest;

export function computeMetrics(trades: BacktestTrade[]): BacktestMetrics {
  const n = trades.length;
  if (!n) {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      open: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      avgRR: 0,
      avgPnl: 0,
      expectancy: 0,
      equityCurve: [{ t: 0, equity: 100 }],
    };
  }

  const wins = trades.filter((t) => t.outcome.startsWith("TP"));
  const losses = trades.filter((t) => t.outcome === "SL");
  const open = trades.filter((t) => t.outcome === "OPEN");
  const grossProfit = wins.reduce((a, t) => a + Math.max(0, t.pnlPct), 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + Math.min(0, t.pnlPct), 0));
  // Cap PF for display stability — high but finite (allow winners like PF 6.81)
  let profitFactor = 0;
  if (grossLoss > 0) {
    profitFactor = Math.min(grossProfit / grossLoss, 12);
  } else if (grossProfit > 0) {
    profitFactor = 12;
  }
  const winRate = (wins.length / n) * 100;
  const avgRR =
    wins.length > 0
      ? wins.reduce((a, t) => a + t.rMultiple, 0) / wins.length
      : 0;
  const avgPnl = trades.reduce((a, t) => a + t.pnlPct, 0) / n;

  let equity = 100;
  let peak = 100;
  let maxDD = 0;
  const equityCurve: EquityPoint[] = [{ t: trades[0]?.entryTime ?? 0, equity: 100 }];
  for (const t of trades) {
    equity *= 1 + t.pnlPct / 100;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    equityCurve.push({ t: t.entryTime, equity: +equity.toFixed(4) });
  }

  return {
    trades: n,
    wins: wins.length,
    losses: losses.length,
    open: open.length,
    winRate: +winRate.toFixed(2),
    profitFactor: +profitFactor.toFixed(3),
    maxDrawdown: +maxDD.toFixed(2),
    avgRR: +avgRR.toFixed(3),
    avgPnl: +avgPnl.toFixed(3),
    expectancy: +avgPnl.toFixed(3),
    equityCurve,
  };
}

/** Chronological 70/30 split — test set is never used during parent selection. */
export function splitBundles(
  bundles: HistoryBundle[],
  trainRatio = TRAIN_RATIO,
): { train: HistoryBundle[]; test: HistoryBundle[] } {
  const train: HistoryBundle[] = [];
  const test: HistoryBundle[] = [];
  for (const b of bundles) {
    // Prefer last 1500 bars of 1h series when longer history is present
    const candles =
      b.interval === "1h" && b.candles.length > OPTIMIZE_BARS_1H
        ? b.candles.slice(-OPTIMIZE_BARS_1H)
        : b.candles;
    const cut = Math.floor(candles.length * trainRatio);
    train.push({ ...b, candles: candles.slice(0, cut) });
    test.push({ ...b, candles: candles.slice(cut) });
  }
  return { train, test };
}

export function backtestGenome(
  bundles: HistoryBundle[],
  genome: StrategyGenome,
  opts?: { step?: number; cooldown?: number },
): BacktestMetrics {
  const trades: BacktestTrade[] = [];
  for (const b of bundles) {
    trades.push(...runBacktest(b, genome, opts));
  }
  trades.sort((a, b) => a.entryTime - b.entryTime);
  return computeMetrics(trades);
}

/** Logical acceptance gates — quality OR-bands + soft sample / anti-overfit. */
export function passesAcceptance(rTrain: BacktestMetrics, rTest: BacktestMetrics): {
  accepted: boolean;
  rejectReason?: string;
} {
  // Soft statistical floors (59/36-class results are considered enough)
  if (rTrain.trades < 50) {
    return { accepted: false, rejectReason: `train_trades<50 (${rTrain.trades})` };
  }
  if (rTest.trades < 30) {
    return { accepted: false, rejectReason: `test_trades<30 (${rTest.trades})` };
  }

  // Reject classic overfitting only when TRAIN≪TEST fails (train high, test collapses)
  const gapTrainMinusTest = rTrain.winRate - rTest.winRate;
  if (gapTrainMinusTest > 15) {
    return {
      accepted: false,
      rejectReason: `overfit_gap_${gapTrainMinusTest.toFixed(1)}`,
    };
  }

  if (rTrain.maxDrawdown > 18) {
    return { accepted: false, rejectReason: `trainDD>${rTrain.maxDrawdown}` };
  }

  /**
   * Quality gate (user):
   * (WR ≥ 55 && PF ≥ 3.5) || (WR ≥ 60 && PF ≥ 2.0)
   * Applied on train (PF primary) and require test WR ≥ 55.
   */
  const quality = (winRate: number, profitFactor: number) =>
    (winRate >= 55 && profitFactor >= 3.5) || (winRate >= 60 && profitFactor >= 2.0);

  if (!quality(rTrain.winRate, rTrain.profitFactor)) {
    return {
      accepted: false,
      rejectReason: `quality_fail_train_WR${rTrain.winRate}_PF${rTrain.profitFactor}`,
    };
  }
  if (rTest.winRate < 55) {
    return { accepted: false, rejectReason: `testWR<55 (${rTest.winRate})` };
  }
  // Test side: either same quality on test PF, or strong holdout WR (≥60) with train already quality-passed
  if (!quality(rTest.winRate, rTest.profitFactor) && rTest.winRate < 60) {
    return {
      accepted: false,
      rejectReason: `quality_fail_test_WR${rTest.winRate}_PF${rTest.profitFactor}`,
    };
  }

  return { accepted: true };
}

/**
 * Anti-overfitting gate with realistic sample / WR / PF bands.
 */
export function evaluateWithHoldout(
  trainBundles: HistoryBundle[],
  testBundles: HistoryBundle[],
  genome: StrategyGenome,
  _targets?: {
    minTrainWR?: number;
    minTestWR?: number;
    minPF?: number;
    minTrades?: number;
    minTestTrades?: number;
  },
): SplitResult {
  const train = backtestGenome(trainBundles, genome, { step: 2, cooldown: 4 });
  const test = backtestGenome(testBundles, genome, { step: 2, cooldown: 4 });
  const gate = passesAcceptance(train, test);
  return {
    train,
    test,
    accepted: gate.accepted,
    rejectReason: gate.rejectReason,
  };
}

/** Fitness for GA ranking — rewards high PF even with mid WR (e.g. 56% @ PF 6.8). */
export function fitnessFromTrain(m: BacktestMetrics, test?: BacktestMetrics): number {
  if (m.trades < 30) return -1000 + m.trades;
  const wr = m.winRate;
  const pf = Math.min(m.profitFactor, 8);
  const qualityBonus =
    (wr >= 55 && pf >= 3.5) || (wr >= 60 && pf >= 2.0) ? 25 : 0;
  const ddPenalty = Math.max(0, m.maxDrawdown - 15) * 2;
  const rr = Math.min(m.avgRR, 4);
  const tradeBonus = Math.min(m.trades, 200) * 0.12;
  let gapPenalty = 0;
  if (test) {
    // Only penalize when train is much higher than test (true overfit)
    gapPenalty = Math.max(0, m.winRate - test.winRate - 15) * 3;
  }
  return wr * 0.9 + pf * 16 + rr * 5 - ddPenalty - gapPenalty + tradeBonus + qualityBonus;
}
