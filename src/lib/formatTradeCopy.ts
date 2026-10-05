import type { SmartSignal } from "@/lib/types";

export type TradeCopyMeta = {
  tradeKind: string;
  interval: string;
  /** قوة الشمعة الصاعدة 0–100 */
  candleStrength: number;
  /** زخم نسبي % */
  momentumPct: number;
  /** حجم السيولة بالـ quote (USDT) من التيكر إن وُجد */
  quoteVolume?: number;
};

const KIND_AR: Record<string, string> = {
  scalp: "سكالب",
  spot: "سبوت",
  futures: "عقود آجلة",
  swing: "سوينغ",
};

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function formatLiquidityVolume(quoteVolume: number, depthScore?: number): string {
  const vol = Number.isFinite(quoteVolume) && quoteVolume > 0 ? fmt(quoteVolume) : "—";
  if (depthScore != null && Number.isFinite(depthScore)) {
    return `${vol} USDT · درجة ${Math.round(depthScore)}`;
  }
  return `${vol} USDT`;
}

/** شمعة صاعدة مؤكدة: صعود فعلي + قوة ≥ 70 */
export function isConfirmedBullishCandle(hit: { strength: number; changePct: number }): boolean {
  return hit.strength >= 70 && hit.changePct > 0;
}

/**
 * نص النسخ بالترتيب المطلوب — مع رموز تعبيرية وتحذيرات في الآخر.
 */
export function formatTradeCopy(signal: SmartSignal, meta: TradeCopyMeta): string {
  const kindAr = KIND_AR[meta.tradeKind] ?? meta.tradeKind;
  const price = signal.last;
  const liqVol = meta.quoteVolume ?? signal.quoteVolume ?? 0;
  const liqLine = formatLiquidityVolume(liqVol, signal.liquidity?.totalScore);
  const mom = Number.isFinite(meta.momentumPct) ? meta.momentumPct : signal.changePct;
  const momSign = mom >= 0 ? "+" : "";

  const lines = [
    `🚀 Million Deal | صفقة المليون`,
    `💎 العملة: ${signal.base}/USDT · السعر: ${fmt(price)}`,
    `📊 نوع الصفقة: ${kindAr} · الفريم: ${meta.interval}`,
    `✅ شمعة صاعدة مؤكدة · قوة ${Math.round(meta.candleStrength)}%`,
    `🎯 نقطة الدخول: ${fmt(signal.entry)}`,
    `🥇 الهدف 1 (TP1): ${fmt(signal.tp1)}`,
    `🥈 الهدف 2 (TP2): ${fmt(signal.tp2)}`,
    `🥉 الهدف 3 (TP3): ${fmt(signal.tp3)}`,
    `🛑 وقف الخسارة (SL): ${fmt(signal.sl)}`,
    `💧 حجم السيولة: ${liqLine}`,
    `⚡ نسبة الزخم: ${momSign}${mom.toFixed(2)}%`,
    `📈 نسبة النجاح المتوقعة: ${signal.successRate}%`,
    ``,
    `⚠️ التحذيرات:`,
    `• احترم وقف الخسارة دائماً — لا تتجاوزه`,
    `• إدارة رأس المال أولاً · لا تدخل بكامل الرصيد`,
    `• تحليل تعليمي فقط — ليست نصيحة مالية`,
  ];

  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
