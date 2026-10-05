import { roundPx } from "@/lib/indicators";

type TradeKindLabel = "spot" | "scalp" | "swing" | "futures";

const TRADE_AR: Record<TradeKindLabel, string> = {
  spot: "سبوت",
  scalp: "سكالب",
  swing: "سوينغ",
  futures: "فيوتشر",
};

function formatIntervalAr(interval: string): string {
  const m = /^(\d+)([smhdwMy])$/.exec(interval);
  if (!m) return interval;
  const n = Number(m[1]);
  const u = m[2]!;
  const unit =
    u === "s"
      ? n === 1
        ? "ثانية"
        : "ثانية"
      : u === "m"
        ? n === 1
          ? "دقيقة"
          : "دقيقة"
        : u === "h"
          ? n === 1
            ? "ساعة"
            : "ساعة"
          : u === "d"
            ? n === 1
              ? "يوم"
              : "يوم"
            : u === "w"
              ? n === 1
                ? "أسبوع"
                : "أسبوع"
              : u === "M"
                ? n === 1
                  ? "شهر"
                  : "شهر"
                : u === "y"
                  ? n === 1
                    ? "سنة"
                    : "سنة"
                  : interval;
  if (unit === interval) return interval;
  return `${n} ${unit}`;
}

export function formatVolume(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** مستويات تداول منفصلة — ممنوع أن يتساوى الدخول مع الوقف أو الأهداف */
export function buildTradeLevels(entry: number): {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
} {
  const e = entry;
  if (!Number.isFinite(e) || e <= 0) {
    return { entry: 0, sl: 0, tp1: 0, tp2: 0, tp3: 0 };
  }
  let sl = e - Math.max(e * 0.01, e * 0.009);
  const maxRisk = e * 0.022;
  if (e - sl > maxRisk) sl = e - maxRisk;
  if (e - sl < e * 0.006) sl = e - e * 0.006;
  const risk = Math.max(e - sl, e * 0.006);
  sl = e - risk;
  const tp1 = e + Math.max(risk * 2.0, e * 0.025);
  const tp2 = e + Math.max(risk * 3.8, e * 0.055);
  const tp3 = e + Math.max(risk * 6.5, e * 0.1);
  return {
    entry: roundPx(e),
    sl: roundPx(sl),
    tp1: roundPx(tp1),
    tp2: roundPx(tp2),
    tp3: roundPx(tp3),
  };
}

export function tradeLevelsValid(levels: {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
}): boolean {
  const { entry, sl, tp1, tp2, tp3 } = levels;
  if (![entry, sl, tp1, tp2, tp3].every((n) => Number.isFinite(n) && n > 0)) return false;
  return sl < entry && tp1 > entry && tp2 > tp1 && tp3 > tp2;
}

export function formatCandleCopyText(input: {
  base: string;
  price: number;
  tradeKind: TradeKindLabel;
  interval: string;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  liquidityVolume: number;
  momentumPct: number;
}): string {
  const px = (n: number) =>
    Number.isFinite(n) && n > 0 ? String(roundPx(n)) : "—";
  const mom = Number.isFinite(input.momentumPct)
    ? `${input.momentumPct >= 0 ? "+" : ""}${input.momentumPct.toFixed(2)}%`
    : "—";
  const sep = "━━━━━━━━━━━━━━";

  return [
    `🚀 Million Deal | ${input.base}`,
    `🪙 العملة: ${input.base}`,
    `💠 السعر: ${px(input.price)}`,
    `📊 نوع الصفقة: ${TRADE_AR[input.tradeKind]}`,
    `⏱ الإطار الزمني: ${formatIntervalAr(input.interval)}`,
    sep,
    `📍 سعر الدخول: ${px(input.entry)}`,
    sep,
    "🎯 الأهداف:",
    `1) ${px(input.tp1)}`,
    `2) ${px(input.tp2)}`,
    `3) ${px(input.tp3)}`,
    `🛑 وقف الخسارة: ${px(input.sl)}`,
    sep,
    "📈 بيانات السوق:",
    `• السيولة: ${formatVolume(input.liquidityVolume)}`,
    `• الزخم: ${mom}`,
    "⚠️ تحذير: احترم وقف الخسارة.",
    "🔎 اعمل بحثك بنفسك.",
  ].join("\n");
}
