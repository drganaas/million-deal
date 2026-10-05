import type { Candle } from "../types";

/** Tunable strategy DNA for genetic optimization */
export type StrategyGenome = {
  // Indicators
  rsiLow: number; // 50–75 exploration (entry zone floor)
  rsiHigh: number; // upper RSI reject
  volumeMult: number; // 1.2–3.0
  emaFast: number; // 15–55
  emaSlow: number; // emaFast+10 .. 80
  // Extended rise / structure
  distFromLowMin: number;
  distFromLowMax: number;
  macdRequired: boolean;
  higherLowsRequired: boolean;
  // SMC
  bosRequired: boolean;
  fvgRequired: boolean;
  orderBlockRequired: boolean;
  smcMinHits: number; // 1–3
  // Risk
  slAtrMult: number;
  tp1R: number;
  tp2R: number;
  tp3R: number;
  maxRiskPct: number;
  // Confluence
  minPillars: number; // 2–4
  requireIndicators: boolean;
  requireCandlesOrPeaks: boolean;
};

export type TradeOutcome = "TP1" | "TP2" | "TP3" | "SL" | "OPEN";

export type BacktestTrade = {
  symbol: string;
  interval: string;
  entryTime: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  exit: number;
  outcome: TradeOutcome;
  pnlPct: number;
  rMultiple: number;
  barsHeld: number;
};

export type EquityPoint = { t: number; equity: number };

export type BacktestMetrics = {
  trades: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgRR: number;
  avgPnl: number;
  expectancy: number;
  equityCurve: EquityPoint[];
};

export type SplitResult = {
  train: BacktestMetrics;
  test: BacktestMetrics;
  accepted: boolean;
  rejectReason?: string;
};

export type GenomeScore = {
  genome: StrategyGenome;
  train: BacktestMetrics;
  test: BacktestMetrics;
  fitness: number;
  accepted: boolean;
  rejectReason?: string;
};

export type OptimizeProgress = {
  status: "idle" | "running" | "done" | "error";
  generation: number;
  maxGenerations: number;
  evaluated: number;
  bestFitness: number;
  bestWinRateTrain: number;
  bestWinRateTest: number;
  bestProfitFactor: number;
  message: string;
  top10: GenomeScore[];
  targetMet: boolean;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type OptimizeJobConfig = {
  symbols: string[];
  years: number;
  intervals: Array<"1h" | "4h" | "1d">;
  generations: number;
  populationSize: number;
  eliteCount: number;
  mutationRate: number;
  trainRatio: number;
  minTrainWR: number;
  minTestWR: number;
  minPF: number;
  minTrades: number;
  /** Starting / preferred genome seed (partial overrides DEFAULT) */
  seedGenome?: Partial<StrategyGenome>;
  forceReloadDataset?: boolean;
};

export const DEFAULT_OPTIMIZE_CONFIG: OptimizeJobConfig = {
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"],
  years: 1,
  intervals: ["1h"],
  generations: 100,
  populationSize: 30,
  eliteCount: 6,
  mutationRate: 0.35,
  trainRatio: 0.7,
  minTrainWR: 55,
  minTestWR: 55,
  minPF: 2.0,
  minTrades: 50,
};

/** Adopted winner: RSI 58–64 · vol 2.6 · EMA 55 · BOS+FVG */
export const DEFAULT_GENOME: StrategyGenome = {
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
  tp1R: 2.0,
  tp2R: 3.8,
  tp3R: 6.5,
  maxRiskPct: 0.022,
  minPillars: 2,
  requireIndicators: true,
  requireCandlesOrPeaks: true,
};

export type HistoryBundle = {
  symbol: string;
  interval: "1h" | "4h" | "1d";
  candles: Candle[];
};
