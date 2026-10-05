import { NextResponse } from "next/server";
import { runOptimizeJob } from "@/lib/backtest/runOptimizeJob";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron — daily genetic re-optimization (full mode).
 * Secure with CRON_SECRET header when deployed.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const progress = await runOptimizeJob("full");
    return NextResponse.json({ ok: true, progress });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cron_failed" },
      { status: 500 },
    );
  }
}
