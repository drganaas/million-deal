"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type LogicalRange,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { ema, lastFinite, macd, parabolicSar } from "@/lib/indicators";

type Levels = {
  entry?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
};

export type ChartGuide = { price: number; color: string; title: string };

const BG = "#0b0e11";
const GRID = "#161b22";
const BORDER = "#243140";
const TEXT = "#8b9aab";

function toLine(candles: Candle[], values: number[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    out.push({ time: candles[i].time as LineData["time"], value: v });
  }
  return out;
}

function lastOf(values: number[]) {
  const v = lastFinite(values);
  return Number.isFinite(v) ? v : 0;
}

function baseChart(el: HTMLElement, height: number) {
  return createChart(el, {
    layout: {
      background: { type: ColorType.Solid, color: BG },
      textColor: TEXT,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: GRID },
      horzLines: { color: GRID },
    },
    rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.06, bottom: 0.08 } },
    timeScale: { borderColor: BORDER, rightOffset: 8, timeVisible: true, secondsVisible: false },
    crosshair: { mode: 1 },
    width: Math.max(el.clientWidth, 100),
    height: Math.max(el.clientHeight || height, 80),
  });
}

export function TradingChart({
  candles,
  levels,
  guides,
}: {
  candles: Candle[];
  levels?: Levels;
  guides?: ChartGuide[];
}) {
  const priceEl = useRef<HTMLDivElement>(null);
  const macdEl = useRef<HTMLDivElement>(null);
  const priceChart = useRef<IChartApi | null>(null);
  const macdChart = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaFastRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSlowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sarRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSigRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const syncing = useRef(false);
  const [legend, setLegend] = useState({ ema21: 0, ema55: 0, sar: 0, macd: 0, signal: 0 });

  useEffect(() => {
    if (!priceEl.current || !macdEl.current) return;
    const price = baseChart(priceEl.current, 240);
    const osc = baseChart(macdEl.current, 110);
    osc.applyOptions({
      timeScale: { visible: true, borderColor: BORDER, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.12, bottom: 0.08 } },
    });

    const candlesSeries = price.addCandlestickSeries({
      upColor: "#1dbf73",
      downColor: "#e85d5d",
      borderVisible: false,
      wickUpColor: "#1dbf73",
      wickDownColor: "#e85d5d",
    });
    const emaFast = price.addLineSeries({
      color: "#60a5fa",
      lineWidth: 2,
      title: "EMA21",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
    });
    const emaSlow = price.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      title: "EMA55",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
    });
    const sar = price.addLineSeries({
      color: "#e879f9",
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      title: "SAR",
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const hist = osc.addHistogramSeries({
      title: "MACD",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const macdLine = osc.addLineSeries({
      color: "#38bdf8",
      lineWidth: 2,
      title: "MACD",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdSig = osc.addLineSeries({
      color: "#f472b6",
      lineWidth: 2,
      title: "Signal",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    priceChart.current = price;
    macdChart.current = osc;
    candleRef.current = candlesSeries;
    emaFastRef.current = emaFast;
    emaSlowRef.current = emaSlow;
    sarRef.current = sar;
    macdHistRef.current = hist;
    macdLineRef.current = macdLine;
    macdSigRef.current = macdSig;

    const follow = (target: IChartApi) => (range: LogicalRange | null) => {
      if (!range || syncing.current) return;
      syncing.current = true;
      target.timeScale().setVisibleLogicalRange(range);
      syncing.current = false;
    };
    price.timeScale().subscribeVisibleLogicalRangeChange(follow(osc));
    osc.timeScale().subscribeVisibleLogicalRangeChange(follow(price));

    const resize = () => {
      if (priceEl.current) {
        price.applyOptions({
          width: Math.max(priceEl.current.clientWidth, 100),
          height: Math.max(priceEl.current.clientHeight, 80),
        });
      }
      if (macdEl.current) {
        osc.applyOptions({
          width: Math.max(macdEl.current.clientWidth, 100),
          height: Math.max(macdEl.current.clientHeight, 72),
        });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(priceEl.current);
    ro.observe(macdEl.current);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
      linesRef.current = [];
      price.remove();
      osc.remove();
      priceChart.current = null;
      macdChart.current = null;
      candleRef.current = null;
      emaFastRef.current = null;
      emaSlowRef.current = null;
      sarRef.current = null;
      macdHistRef.current = null;
      macdLineRef.current = null;
      macdSigRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !candles.length) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleRef.current.setData(data);

    const closes = candles.map((c) => c.close);
    const ema21 = ema(closes, 21);
    const ema55 = ema(closes, 55);
    const sar = parabolicSar(candles);
    const m = macd(closes);

    emaFastRef.current?.setData(toLine(candles, ema21));
    emaSlowRef.current?.setData(toLine(candles, ema55));
    sarRef.current?.setData(toLine(candles, sar));

    const hist: HistogramData[] = [];
    for (let i = 0; i < candles.length; i++) {
      const v = m.hist[i];
      if (!Number.isFinite(v)) continue;
      hist.push({
        time: candles[i].time as HistogramData["time"],
        value: v,
        color: v >= 0 ? "#1dbf73" : "#e85d5d",
      });
    }
    macdHistRef.current?.setData(hist);
    macdLineRef.current?.setData(toLine(candles, m.line));
    macdSigRef.current?.setData(toLine(candles, m.signal));

    setLegend({
      ema21: lastOf(ema21),
      ema55: lastOf(ema55),
      sar: lastOf(sar),
      macd: lastOf(m.line),
      signal: lastOf(m.signal),
    });

    const series = candleRef.current;
    for (const line of linesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* already gone */
      }
    }
    linesRef.current = [];

    const add = (price: number | undefined, color: string, title: string, width: 1 | 2 = 1) => {
      if (!price || !Number.isFinite(price)) return;
      linesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: width,
          axisLabelVisible: true,
          title,
        }),
      );
    };
    add(levels?.entry, "#d4a017", "Entry", 2);
    add(levels?.sl, "#e85d5d", "SL", 2);
    add(levels?.tp1, "#1dbf73", "TP1");
    add(levels?.tp2, "#1dbf73", "TP2");
    add(levels?.tp3, "#39ff14", "TP3");
    for (const g of guides ?? []) add(g.price, g.color, g.title);

    priceChart.current?.timeScale().fitContent();
    macdChart.current?.timeScale().fitContent();
  }, [candles, levels, guides]);

  const fmt = (n: number) => (n >= 100 ? n.toFixed(2) : n.toPrecision(4));

  return (
    <div className="flex h-full w-full flex-col" dir="ltr">
      <div
        dir="ltr"
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#243140] bg-[#0b0e11] px-3 py-1 font-mono text-[11px]"
      >
        <span className="font-semibold text-[#60a5fa]">EMA21 {fmt(legend.ema21)}</span>
        <span className="font-semibold text-[#f59e0b]">EMA55 {fmt(legend.ema55)}</span>
        <span className="font-semibold text-[#e879f9]">SAR {fmt(legend.sar)}</span>
        <span className="font-semibold text-[#38bdf8]">MACD {fmt(legend.macd)}</span>
        <span className="text-[#f472b6]">Signal {fmt(legend.signal)}</span>
      </div>
      <div ref={priceEl} className="min-h-0 w-full flex-[7]" />
      <div ref={macdEl} className="min-h-[88px] w-full flex-[3] border-t border-[#243140]" />
    </div>
  );
}
