import { roundPx } from "@/lib/indicators";

type TradeKindLabel = "spot" | "scalp" | "swing" | "futures";

const TRADE_AR: Record<TradeKindLabel, string> = {
  spot: "سبوت",
  scalp: "سكالب",
  swing: "سوينغ",
  futures: "فيوتشر",
};

export function formatVolume(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
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

  return [
    "Million Deal",
    `${input.base} · ${px(input.price)}`,
    `${TRADE_AR[input.tradeKind]} · ${input.interval}`,
    `📍 الدخول: ${px(input.entry)}`,
    `🎯 الهدف 1: ${px(input.tp1)}`,
    `🎯 الهدف 2: ${px(input.tp2)}`,
    `🎯 الهدف 3: ${px(input.tp3)}`,
    `🛑 وقف الخسارة: ${px(input.sl)}`,
    `💧 السيولة: ${formatVolume(input.liquidityVolume)}`,
    `⚡ الزخم: ${mom}`,
    "⚠️ تحذير: احترم وقف الخسارة",
  ].join("\n");
}
