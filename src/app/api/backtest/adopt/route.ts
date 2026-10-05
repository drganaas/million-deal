import { NextResponse } from "next/server";
import { setActiveGenome } from "@/lib/backtest/activeGenome";
import { getJobState, loadBestStrategy, saveBestStrategy } from "@/lib/backtest/jobStore";
import type { GenomeScore, StrategyGenome } from "@/lib/backtest/types";

export const dynamic = "force-dynamic";

/** Same quality gate as engine: (WR≥55 & PF≥3.5) || (WR≥60 & PF≥2.0) */
function qualityOk(winRate: number, profitFactor: number) {
  return (winRate >= 55 && profitFactor >= 3.5) || (winRate >= 60 && profitFactor >= 2.0);
}

function canAdoptScore(
  trainWR: number,
  testWR: number,
  trainPF: number,
  testTrades: number,
) {
  // Allow test > train (honest generalization). Block only train−test > 15.
  if (trainWR - testWR > 15) return false;
  if (testTrades < 30) return false;
  if (testWR < 55) return false;
  return qualityOk(trainWR, trainPF);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      genome?: StrategyGenome;
      fromBest?: boolean;
      force?: boolean;
    };
    const job = getJobState();

    if (body.genome) {
      const match = job.progress.top10.find(
        (t) => JSON.stringify(t.genome) === JSON.stringify(body.genome),
      );
      if (match) {
        if (
          !body.force &&
          !canAdoptScore(
            match.train.winRate,
            match.test.winRate,
            match.train.profitFactor,
            match.test.trades,
          )
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: "reject_quality_or_overfit",
              message: "لا يحقق شرط الجودة (WR/PF) أو Overfitting",
            },
            { status: 400 },
          );
        }
        await saveBestStrategy(match, "manual");
        setActiveGenome(match.genome, true);
        return NextResponse.json({
          ok: true,
          adopted: match.genome,
          label: "النتيجة المعتمدة ✅",
          metrics: { train: match.train, test: match.test },
        });
      }
      return NextResponse.json(
        { ok: false, error: "genome_not_in_top10" },
        { status: 400 },
      );
    }

    const candidate: GenomeScore | null = job.bestAccepted;
    if (candidate) {
      if (
        !body.force &&
        !canAdoptScore(
          candidate.train.winRate,
          candidate.test.winRate,
          candidate.train.profitFactor,
          candidate.test.trades,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "reject_quality_or_overfit",
            message: "لا يحقق شرط الجودة (WR/PF) أو Overfitting",
          },
          { status: 400 },
        );
      }
      await saveBestStrategy(candidate, "manual");
      setActiveGenome(candidate.genome, true);
      return NextResponse.json({
        ok: true,
        adopted: candidate.genome,
        label: "النتيجة المعتمدة ✅",
        metrics: { train: candidate.train, test: candidate.test },
      });
    }

    const best = await loadBestStrategy();
    if (
      best &&
      (body.force ||
        canAdoptScore(
          best.metrics.trainWinRate,
          best.metrics.testWinRate,
          best.metrics.profitFactor,
          best.metrics.testTrades,
        ))
    ) {
      setActiveGenome(best.genome, true);
      return NextResponse.json({
        ok: true,
        adopted: best.genome,
        fromFile: true,
        label: best.label ?? "النتيجة المعتمدة ✅",
      });
    }

    return NextResponse.json({ ok: false, error: "no_strategy_to_adopt" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "adopt_failed" },
      { status: 500 },
    );
  }
}
