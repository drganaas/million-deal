export type Side = "LONG" | "WAIT";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type StrategyVote = {
  id: "hidden_candle" | "liquidity_grab" | "smc" | "volume_momentum" | "bottom_detector";
  name: string;
  pass: boolean;
  score: number;
  detail: string;
};

export type CandlePattern =
  | "Hammer"
  | "Bullish Engulfing"
  | "Morning Star"
  | "Pin Bar"
  | "Doji"
  | "Strong Bull"
  | "Neutral";

export type BottomType = "Historical" | "Double" | "First" | "Local";

export type SmcState = {
  bos: boolean;
  choch: boolean;
  sweep: boolean;
  fvg: boolean;
  orderBlock: boolean;
};

export type LiquidityInfo = {
  bidDepth: number;
  askDepth: number;
  totalScore: number;
};

export type SmartSignal = {
  symbol: string;
  base: string;
  last: number;
  changePct: number;
  quoteVolume: number;
  side: Side;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  successRate: number;
  votes: StrategyVote[];
  agreeCount: number;
  rsi: number;
  macdHist: number;
  volumeRatio: number;
  candlePattern: CandlePattern;
  bottomType: BottomType;
  atl: number;
  ath: number;
  currentLow: number;
  currentHigh: number;
  distanceFromBottomPct: number;
  smc: SmcState;
  liquidity: LiquidityInfo;
  reasons: string[];
};

export type DepthLevel = { price: number; qty: number };
