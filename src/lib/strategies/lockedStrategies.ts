/**
 * LOCKED strategies after random-40 coin validation.
 * Do not weaken ENTRY_LOCKED rules without a new random-40 pass.
 */
export const STRATEGY_LOCK = {
  seed: 154120721,
  testedAt: "2026-10-04T22:55:00.000Z",
  entryLocked: ["candles", "peaks", "combined"] as const,
  confirmOnly: ["indicators", "breakout"] as const,
  metrics: {
    candles: { winRate: 45, avgPnl: 0.584, sustainedRate: 45, role: "ENTRY_LOCKED" },
    peaks: { winRate: 50, avgPnl: 1.083, sustainedRate: 55, role: "ENTRY_LOCKED" },
    combined: { winRate: 50, avgPnl: 1.271, sustainedRate: 50, role: "ENTRY_LOCKED" },
    indicators: { winRate: 35, avgPnl: 0.493, role: "CONFIRM_ONLY" },
    breakout: { winRate: 35, avgPnl: 0.426, role: "CONFIRM_ONLY" },
  },
  entryRule:
    "(candles AND indicators) OR (peaks AND (indicators OR candles)) + extendedRiseGate",
} as const;
