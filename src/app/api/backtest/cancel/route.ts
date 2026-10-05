import { NextResponse } from "next/server";
import { getJobState, requestCancel } from "@/lib/backtest/jobStore";

export const dynamic = "force-dynamic";

export async function POST() {
  requestCancel("تم إيقاف الاختبار");
  return NextResponse.json({
    ok: true,
    cancelled: true,
    progress: getJobState().progress,
  });
}
