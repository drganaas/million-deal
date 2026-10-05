import type { StrategyGenome } from "./types";
import { DEFAULT_GENOME } from "./types";
import { loadBestStrategy } from "./jobStore";

let cached: StrategyGenome | null = null;
let enforced = false;

export async function refreshActiveGenome() {
  const best = await loadBestStrategy();
  if (best?.genome) {
    cached = best.genome;
    // Enforce only after a real optimize/adopt (has trades or targetMet or genetic source)
    enforced =
      best.source === "genetic" ||
      best.source === "cron" ||
      best.targetMet ||
      (best.metrics?.trainTrades ?? 0) > 0;
  } else {
    cached = DEFAULT_GENOME;
    enforced = false;
  }
  return cached;
}

export function getActiveGenomeSync(): StrategyGenome {
  return cached ?? DEFAULT_GENOME;
}

export function isGenomeEnforced(): boolean {
  return enforced;
}

export function setActiveGenome(g: StrategyGenome, enforce = true) {
  cached = g;
  enforced = enforce;
}
