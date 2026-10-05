import { existsSync, readFileSync } from "fs";
import path from "path";
import type { StrategyGenome } from "./types";
import { DEFAULT_GENOME } from "./types";
import { loadBestStrategy, type BestStrategyFile } from "./jobStore";

let cached: StrategyGenome | null = null;
let enforced = false;
let adoptedLabel: string | null = null;
let adoptedMetrics: BestStrategyFile["metrics"] | null = null;
let bootstrapped = false;

function applyBest(best: BestStrategyFile | null) {
  if (best?.genome) {
    cached = best.genome;
    adoptedLabel = best.label ?? (best.targetMet ? "النتيجة المعتمدة ✅" : null);
    adoptedMetrics = best.metrics ?? null;
    enforced =
      best.source === "genetic" ||
      best.source === "cron" ||
      best.source === "manual" ||
      Boolean(best.targetMet) ||
      (best.metrics?.trainTrades ?? 0) > 0;
  } else {
    cached = DEFAULT_GENOME;
    enforced = false;
    adoptedLabel = null;
    adoptedMetrics = null;
  }
}

/** Sync bootstrap so cold serverless/Render workers enforce adopted genome immediately. */
function bootstrapFromDisk() {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    const p = path.join(process.cwd(), "config", "bestStrategy.json");
    if (!existsSync(p)) {
      cached = DEFAULT_GENOME;
      return;
    }
    const best = JSON.parse(readFileSync(p, "utf8")) as BestStrategyFile;
    applyBest(best);
  } catch {
    cached = DEFAULT_GENOME;
    enforced = false;
  }
}

export async function refreshActiveGenome() {
  const best = await loadBestStrategy();
  bootstrapped = true;
  applyBest(best);
  return cached;
}

export function getActiveGenomeSync(): StrategyGenome {
  bootstrapFromDisk();
  return cached ?? DEFAULT_GENOME;
}

export function isGenomeEnforced(): boolean {
  bootstrapFromDisk();
  return enforced;
}

export function getAdoptedLabel(): string | null {
  bootstrapFromDisk();
  return adoptedLabel;
}

export function getAdoptedMetrics(): BestStrategyFile["metrics"] | null {
  bootstrapFromDisk();
  return adoptedMetrics;
}

export function setActiveGenome(
  g: StrategyGenome,
  enforce = true,
  meta?: { label?: string; metrics?: BestStrategyFile["metrics"] },
) {
  cached = g;
  enforced = enforce;
  bootstrapped = true;
  if (meta?.label) adoptedLabel = meta.label;
  if (meta?.metrics) adoptedMetrics = meta.metrics;
  if (enforce && !adoptedLabel) adoptedLabel = "النتيجة المعتمدة ✅";
}
