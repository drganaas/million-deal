/**
 * Trigger local/full optimize via API (server must be running).
 * Usage: npm run optimize
 * Env: BASE_URL=http://localhost:3000 CRON_SECRET=...
 */
const base = process.env.BASE_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const headers = secret ? { authorization: `Bearer ${secret}` } : {};

console.log(`Triggering optimize at ${base}/api/cron/optimize …`);
const res = await fetch(`${base}/api/cron/optimize`, { headers });
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
if (!res.ok) process.exit(1);
