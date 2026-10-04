"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Crown, LogOut, Plus, Trash2, Users } from "lucide-react";

const ADMIN_KEY = "md.admin";

type Subscriber = {
  email: string;
  is_paid: boolean;
  subscription_end: string | null;
  created_at?: string;
};

export function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("owner@milliondeal.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("demo");
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { email?: string };
      if (parsed.email) {
        setEmail(parsed.email);
        setAuthed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load();
  }, [authed]);

  async function load() {
    const res = await fetch("/api/subscribers", { cache: "no-store" });
    const data = (await res.json()) as {
      ok: boolean;
      mode?: string;
      subscribers?: Subscriber[];
      error?: string;
    };
    if (!data.ok) {
      setError(data.error ?? "فشل التحميل");
      return;
    }
    setMode(data.mode ?? "demo");
    setRows(data.subscribers ?? []);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok: boolean; email?: string; error?: string };
      if (!data.ok) throw new Error(data.error ?? "فشل الدخول");
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ email: data.email, at: Date.now() }));
      // also allow opening the trading app as owner
      localStorage.setItem("md.session", JSON.stringify({ email: data.email, role: "owner", at: Date.now() }));
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function addSubscriber(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: newEmail, is_paid: paid }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "فشل الإضافة");
      setNewEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: string) {
    setBusy(true);
    try {
      await fetch(`/api/subscribers?email=${encodeURIComponent(target)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <form onSubmit={login} className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-inset text-gold">
              <Crown size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gold-soft">لوحة المالك</h1>
              <p className="text-sm text-muted">إدارة المشتركين فقط</p>
            </div>
          </div>
          <label className="block text-xs text-muted">
            بريد المالك
            <input
              className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-3 outline-none focus:border-gold"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted">
            كلمة سر المالك
            <input
              className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-3 outline-none focus:border-gold"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gold px-4 py-3 font-semibold text-bg disabled:opacity-60"
          >
            {busy ? "جارِ الدخول…" : "دخول المالك"}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-center text-xs text-muted">
            للمشتركين استخدم{" "}
            <a className="text-gold underline" href="/">
              الصفحة الرئيسية
            </a>
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-fg">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-gold uppercase">Owner</p>
            <h1 className="text-xl font-semibold">لوحة المالك · المشتركين</h1>
            <p className="text-sm text-muted">
              {email} · الوضع: {mode === "supabase" ? "Supabase" : "تجريبي محلي"}
            </p>
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/10 px-3 py-1.5 text-sm text-gold"
            >
              فتح التطبيق
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm"
              onClick={() => {
                localStorage.removeItem(ADMIN_KEY);
                setAuthed(false);
              }}
            >
              <LogOut size={14} />
              خروج
            </button>
          </div>
        </header>

        <form onSubmit={addSubscriber} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-gold-soft">
            <Plus size={16} />
            <h2 className="font-semibold">إضافة / تحديث مشترك</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              className="rounded-xl border border-line bg-inset px-3 py-3 outline-none focus:border-gold"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="subscriber@email.com"
            />
            <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-3 text-sm">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              مدفوع
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-teal px-4 py-3 font-semibold text-bg disabled:opacity-60"
            >
              حفظ
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-gold-soft">
            <Users size={16} />
            <h2 className="font-semibold">قائمة المشتركين ({rows.length})</h2>
          </div>
          <div className="space-y-2">
            {rows.length === 0 ? <p className="text-sm text-muted">لا يوجد مشتركون بعد</p> : null}
            {rows.map((row) => (
              <div
                key={row.email}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-inset px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.email}</p>
                  <p className="text-xs text-muted">
                    {row.is_paid ? "مدفوع" : "غير مدفوع"}
                    {row.subscription_end ? ` · ينتهي ${row.subscription_end}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(row.email)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm text-danger"
                >
                  <Trash2 size={14} />
                  حذف
                </button>
              </div>
            ))}
          </div>
        </section>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </main>
  );
}
