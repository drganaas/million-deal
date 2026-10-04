import { LoginForm } from "@/components/LoginForm";

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-xs tracking-[0.25em] text-gold uppercase">Million Deal</p>
          <h1 className="mt-2 text-3xl font-bold text-fg md:text-4xl">صفقة المليون</h1>
          <p className="mt-2 text-sm text-muted">
            5 استراتيجيات في محرك واحد · دخول · TP1/TP2/TP3 · وقف ديناميكي · نسبة نجاح
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted">
          هذا الموقع للتحليل التعليمي وليس نصيحة مالية
        </p>
      </div>
    </main>
  );
}
