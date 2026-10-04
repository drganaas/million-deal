import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Demo OTP verify (used when Supabase env is not configured).
 * Production path uses Supabase session from Magic Link callback.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; code?: string };
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const code = String(body.code ?? "").trim();
  if (!email) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (code !== "123456") {
    return NextResponse.json({ ok: false, error: "bad_code" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, email, is_paid: true });
}
