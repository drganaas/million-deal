import { NextResponse } from "next/server";
import { getJobState, setJobProgress } from "@/lib/backtest/jobStore";
import { runOptimizeJob, type RunMode } from "@/lib/backtest/runOptimizeJob";
import type { OptimizeJobConfig } from "@/lib/backtest/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      mode?: RunMode;
      config?: Partial<OptimizeJobConfig>;
    };
    const mode: RunMode = body.mode === "full" ? "full" : body.mode === "custom" || body.config ? "custom" : "quick";
    const job = getJobState();

    if (job.progress.status === "running") {
      return NextResponse.json({
        ok: true,
        alreadyRunning: true,
        progress: job.progress,
      });
    }

    const gens = body.config?.generations ?? (mode === "full" ? 16 : 8);

    setJobProgress({
      status: "running",
      generation: 0,
      maxGenerations: gens,
      evaluated: 0,
      message: "جاري التحميل وبدء التحسين…",
      top10: [],
      targetMet: false,
      startedAt: new Date().toISOString(),
      error: undefined,
    });

    void runOptimizeJob(mode, body.config).catch((e) => {
      setJobProgress({
        status: "error",
        message: e instanceof Error ? e.message : "optimize_failed",
        error: e instanceof Error ? e.message : "optimize_failed",
      });
    });

    return NextResponse.json({
      ok: true,
      started: true,
      mode,
      config: body.config ?? null,
      progress: getJobState().progress,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "start_failed" },
      { status: 500 },
    );
  }
}
