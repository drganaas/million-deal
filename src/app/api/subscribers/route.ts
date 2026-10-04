import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في .env.local ثم Vercel",
    });
  }
  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase
    .from("subscribers")
    .select("email,is_paid,subscription_end,created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, configured: true, subscribers: data });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 400 });
  }
  const body = (await req.json()) as {
    email?: string;
    is_paid?: boolean;
    subscription_end?: string | null;
  };
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase.from("subscribers").upsert(
    {
      email,
      is_paid: Boolean(body.is_paid),
      subscription_end: body.subscription_end ?? null,
    },
    { onConflict: "email" },
  ).select();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, subscriber: data?.[0] });
}

export async function DELETE(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const email = String(searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();
  const supabase = getSupabaseServer()!;
  const { error } = await supabase.from("subscribers").delete().eq("email", email);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
