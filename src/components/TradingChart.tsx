"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { ema, lastFinite, macd, parabolicSar } from "@/lib/indicators";

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

export function TradingChart({
  candles,
}: {
  candles: Candle[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaFastRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSlowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sarRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSigRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [legend, setLegend] = useState({ ema21: 0, ema55: 0, sar: 0, macd: 0, signal: 0 });

  useEffect(() => {
    if (!el.current) return;
    const chart = createChart(el.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "#8b9aab",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#161b22" },
        horzLines: { color: "#161b22" },
      },
      rightPriceScale: {
        borderColor: "#243140",
        scaleMargins: { top: 0.04, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#243140",
        rightOffset: 6,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      width: Math.max(el.current.clientWidth, 120),
      height: Math.max(el.current.clientHeight || 720, 1),
    });

    const candlesSeries = chart.addCandlestickSeries({
      upColor: "#1dbf73",
      downColor: "#e85d5d",
      borderVisible: false,
      wickUpColor: "#1dbf73",
      wickDownColor: "#e85d5d",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const emaFast = chart.addLineSeries({
      color: "#60a5fa",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const emaSlow = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const sar = chart.addLineSeries({
      color: "#e879f9",
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const hist = chart.addHistogramSeries({
      priceScaleId: "macd",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdLine = chart.addLineSeries({
      priceScaleId: "macd",
      color: "#38bdf8",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const macdSig = chart.addLineSeries({
      priceScaleId: "macd",
      color: "#f472b6",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("macd").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candlesSeries;
    emaFastRef.current = emaFast;
    emaSlowRef.current = emaSlow;
    sarRef.current = sar;
    macdHistRef.current = hist;
    macdLineRef.current = macdLine;
    macdSigRef.current = macdSig;

    const resize = () => {
      if (!el.current) return;
      chart.applyOptions({
        width: Math.max(el.current.clientWidth, 120),
        height: Math.max(el.current.clientHeight || 720, 1),
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el.current);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
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
  }, []);

  useEffect(() => {
    if (!candleRef.current || !candles.length) return;
    const series = candleRef.current;
    series.setData(
      candles.map((c) => ({
        time: c.time as CandlestickData["time"],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

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
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  const fmt = (n: number) => (n >= 100 ? n.toFixed(2) : n.toPrecision(4));

  return (
    <div className="flex h-full w-full flex-col" dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#243140] bg-[#0b0e11] px-3 py-1 font-mono text-[11px]">
        <span className="font-semibold text-[#60a5fa]">EMA21 {fmt(legend.ema21)}</span>
        <span className="font-semibold text-[#f59e0b]">EMA55 {fmt(legend.ema55)}</span>
        <span className="font-semibold text-[#e879f9]">SAR {fmt(legend.sar)}</span>
        <span className="font-semibold text-[#38bdf8]">MACD {fmt(legend.macd)}</span>
        <span className="text-[#f472b6]">Signal {fmt(legend.signal)}</span>
      </div>
      <div ref={el} className="min-h-0 w-full flex-1" />
    </div>
  );
}
