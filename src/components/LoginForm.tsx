"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Shield } from "lucide-react";

const SESSION_KEY = "md.session";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"idle" | "demo" | "magic">("idle");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendMagic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        mode?: string;
        message?: string;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "failed");
      setMode(data.mode === "demo" ? "demo" : "magic");
      setMsg(data.message ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyDemo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/demo-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { ok: boolean; email?: string; error?: string };
      if (!data.ok) throw new Error(data.error === "bad_code" ? "رمز غير صحيح" : "فشل التحقق");
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email: data.email, at: Date.now() }));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-[0_0_0_1px_rgba(212,160,23,0.12)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-inset text-gold">
          <Shield size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-wide text-gold-soft">MILLION DEAL</h1>
          <p className="text-sm text-muted">صفقة المليون · دخول بالبريد فقط</p>
        </div>
      </div>

      <p className="text-sm text-muted">بدون اسم مستخدم أو كلمة سر — Magic Link / OTP عبر الإيميل</p>

      <form onSubmit={sendMagic} className="mt-4 space-y-3">
        <label className="block text-xs uppercase tracking-wide text-muted">
          البريد الإلكتروني
          <input
            className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-3 text-fg outline-none focus:border-gold"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@email.com"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 font-semibold text-bg disabled:opacity-60"
        >
          <Mail size={16} />
          {busy ? "جارِ الإرسال…" : "أرسل الرابط السحري"}
        </button>
      </form>

      {mode === "demo" ? (
        <form onSubmit={verifyDemo} className="mt-4 space-y-3 rounded-xl border border-line bg-inset p-3">
          <p className="text-xs text-gold-soft">{msg}</p>
          <input
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
          <button type="submit" className="w-full rounded-lg bg-teal px-3 py-2 font-semibold text-bg">
            تأكيد الدخول
          </button>
        </form>
      ) : null}

      {mode === "magic" ? <p className="mt-3 text-sm text-teal">{msg}</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
