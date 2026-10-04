# نشر Million Deal — بدون حساب hiddencandle / بدون Vercel

اختر **واحدة** من المنصات التالية بحسابك أنت:

## الخيار 1 — Render (موصى به لـ Next.js API)

1. سجّل على https://render.com بحساب جديد
2. New → Web Service → ارفع المجلد أو اربطه بـ Git
3. الإعدادات جاهزة في `render.yaml`
4. أضف Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = رابط Render الخاص بك

أو من الطرفية (بعد `render login` بحسابك):

```bash
cd C:\Users\GANNAS\Desktop\Million-Deal
npx --yes render@latest blueprint apply
```

## الخيار 2 — Netlify

1. سجّل على https://netlify.com بحساب جديد
2. أضف الحزمة:

```bash
cd C:\Users\GANNAS\Desktop\Million-Deal
npm install -D @netlify/plugin-nextjs
npx --yes netlify-cli login
npx --yes netlify-cli deploy --prod
```

الملف `netlify.toml` جاهز.

## الخيار 3 — Cloudflare Pages

1. https://pages.cloudflare.com
2. Framework preset: Next.js
3. Build: `npm run build`

## Supabase (Magic Link)

1. مشروع جديد على https://supabase.com
2. نفّذ `supabase/schema.sql`
3. انسخ URL + anon key إلى متغيرات المنصة أعلاه
4. Redirect URL: `https://YOUR-APP.../auth/callback`

## مهم

- لا تستخدم حساب Vercel باسم `hiddencandle`
- التطبيق محلياً يبقى على http://localhost:3000
