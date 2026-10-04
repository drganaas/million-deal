"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const SESSION_KEY = "md.session";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        router.replace("/");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email;
      if (email) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ email, at: Date.now() }));
        router.replace("/dashboard");
        return;
      }
      router.replace("/");
    }
    void run();
  }, [router]);

  return <main className="grid min-h-screen place-items-center text-muted">جارِ تأكيد الرابط السحري…</main>;
}
