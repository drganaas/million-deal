import { BacktestLab } from "@/components/BacktestLab";

export const dynamic = "force-dynamic";

/**
 * Smart backtest lab:
 * - 1500 × 1h bars · 70/30 holdout
 * - Acceptance: train≥100 / test≥40 trades, WR bands, gap≤12, PF 1.5–3.2, DD≤15
 * - 3000 trials + 20% gene diversity · unique top-10
 */
export default function BacktestPage() {
  return <BacktestLab />;
}
