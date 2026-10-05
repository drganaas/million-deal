import { NextResponse } from "next/server";
import { refreshActiveGenome } from "@/lib/backtest/activeGenome";
import { getJobState, loadBestStrategy } from "@/lib/backtest/jobStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const job = getJobState();
  const best = await loadBestStrategy();
  if (best?.genome) {
    await refreshActiveGenome();
  }
  return NextResponse.json({
    ok: true,
    progress: {
      ...job.progress,
      top10: job.progress.top10.map((t) => ({
        fitness: +t.fitness.toFixed(2),
        accepted: t.accepted,
        rejectReason: t.rejectReason,
        trainWR: t.train.winRate,
        testWR: t.test.winRate,
        pf: t.train.profitFactor,
        dd: t.train.maxDrawdown,
        avgRR: t.train.avgRR,
        trainTrades: t.train.trades,
        testTrades: t.test.trades,
        genome: t.genome,
      })),
    },
    dataset: job.datasetMeta ?? null,
    bestStrategy: best,
    adoptedLabel: best?.label ?? (best?.targetMet ? "النتيجة المعتمدة ✅" : null),
  });
}
