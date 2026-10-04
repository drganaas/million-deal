import { NextResponse } from "next/server";
import {
  deleteDemoSubscriber,
  listDemoSubscribers,
  upsertDemoSubscriber,
} from "@/lib/demoSubscribers";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      mode: "demo",
      subscribers: listDemoSubscribers(),
    });
  }
  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase
    .from("subscribers")
    .select("email,is_paid,subscription_end,created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, configured: true, mode: "supabase", subscribers: data });
}

export async function POST(req: Request) {
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

  if (!isSupabaseConfigured()) {
    const subscriber = upsertDemoSubscriber({
      email,
      is_paid: Boolean(body.is_paid),
      subscription_end: body.subscription_end ?? null,
    });
    return NextResponse.json({ ok: true, mode: "demo", subscriber });
  }

  const supabase = getSupabaseServer()!;
  const { data, error } = await supabase
    .from("subscribers")
    .upsert(
      {
        email,
        is_paid: Boolean(body.is_paid),
        subscription_end: body.subscription_end ?? null,
      },
      { onConflict: "email" },
    )
    .select();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", subscriber: data?.[0] });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = String(searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    deleteDemoSubscriber(email);
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const supabase = getSupabaseServer()!;
  const { error } = await supabase.from("subscribers").delete().eq("email", email);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase" });
}
