"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { ema, macd, parabolicSar } from "@/lib/indicators";

type Levels = {
  entry?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
};

export type ChartGuide = { price: number; color: string; title: string };

function toLine(candles: Candle[], values: number[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    out.push({ time: candles[i].time as LineData["time"], value: v });
  }
  return out;
}

export function TradingChart({
  candles,
  levels,
  guides,
  height = 420,
}: {
  candles: Candle[];
  levels?: Levels;
  guides?: ChartGuide[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaFastRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSlowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sarRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSigRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "#8b9aab",
      },
      grid: {
        vertLines: { color: "#161b22" },
        horzLines: { color: "#161b22" },
      },
      rightPriceScale: { borderColor: "#243140", scaleMargins: { top: 0.04, bottom: 0.28 } },
      timeScale: { borderColor: "#243140", rightOffset: 6 },
      crosshair: { mode: 1 },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight || height,
    });

    const candlesSeries = chart.addCandlestickSeries({
      upColor: "#1dbf73",
      downColor: "#e85d5d",
      borderVisible: false,
      wickUpColor: "#1dbf73",
      wickDownColor: "#e85d5d",
    });
    const emaFast = chart.addLineSeries({
      color: "#60a5fa",
      lineWidth: 2,
      title: "EMA 21",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const emaSlow = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      title: "EMA 55",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const sar = chart.addLineSeries({
      color: "#c084fc",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "SAR",
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const macdHist = chart.addHistogramSeries({
      priceScaleId: "macd",
      title: "MACD",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const macdLine = chart.addLineSeries({
      priceScaleId: "macd",
      color: "#38bdf8",
      lineWidth: 1,
      title: "MACD",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdSig = chart.addLineSeries({
      priceScaleId: "macd",
      color: "#f472b6",
      lineWidth: 1,
      title: "Signal",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("macd").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candlesSeries;
    emaFastRef.current = emaFast;
    emaSlowRef.current = emaSlow;
    sarRef.current = sar;
    macdHistRef.current = macdHist;
    macdLineRef.current = macdLine;
    macdSigRef.current = macdSig;

    const onResize = () => {
      if (!ref.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: ref.current.clientWidth,
        height: ref.current.clientHeight || height,
      });
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(ref.current);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      linesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      emaFastRef.current = null;
      emaSlowRef.current = null;
      sarRef.current = null;
      macdHistRef.current = null;
      macdLineRef.current = null;
      macdSigRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || !candles.length) return;
    const series = candleRef.current;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);

    const closes = candles.map((c) => c.close);
    emaFastRef.current?.setData(toLine(candles, ema(closes, 21)));
    emaSlowRef.current?.setData(toLine(candles, ema(closes, 55)));
    sarRef.current?.setData(toLine(candles, parabolicSar(candles)));

    const m = macd(closes);
    const hist: HistogramData[] = [];
    for (let i = 0; i < candles.length; i++) {
      const v = m.hist[i];
      if (!Number.isFinite(v)) continue;
      hist.push({
        time: candles[i].time as HistogramData["time"],
        value: v,
        color: v >= 0 ? "#1dbf7388" : "#e85d5d88",
      });
    }
    macdHistRef.current?.setData(hist);
    macdLineRef.current?.setData(toLine(candles, m.line));
    macdSigRef.current?.setData(toLine(candles, m.signal));

    for (const line of linesRef.current) series.removePriceLine(line);
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

    chartRef.current?.timeScale().fitContent();
  }, [candles, levels, guides]);

  return <div ref={ref} className="h-full w-full min-h-[360px]" />;
}
