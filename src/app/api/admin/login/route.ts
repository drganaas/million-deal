import { NextResponse } from "next/server";
import { verifyAdminCredentials } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  if (!verifyAdminCredentials(email, password)) {
    return NextResponse.json({ ok: false, error: "بيانات غير صحيحة" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, email, role: "owner" });
}
