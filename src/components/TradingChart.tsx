"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  ColorType,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

type Levels = {
  entry?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
};

export function TradingChart({
  candles,
  levels,
}: {
  candles: Candle[];
  levels?: Levels;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0c1218" },
        textColor: "#8b9aab",
      },
      grid: {
        vertLines: { color: "#1a2430" },
        horzLines: { color: "#1a2430" },
      },
      rightPriceScale: { borderColor: "#243140" },
      timeScale: { borderColor: "#243140" },
      crosshair: { mode: 1 },
      width: ref.current.clientWidth,
      height: 380,
    });
    const series = chart.addCandlestickSeries({
      upColor: "#1dbf73",
      downColor: "#e85d5d",
      borderVisible: false,
      wickUpColor: "#1dbf73",
      wickDownColor: "#e85d5d",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (!ref.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    seriesRef.current.createPriceLine({
      price: levels?.entry ?? candles.at(-1)!.close,
      color: "#d4a017",
      lineWidth: 2,
      axisLabelVisible: true,
      title: "Entry",
    });
    if (levels?.sl) {
      seriesRef.current.createPriceLine({
        price: levels.sl,
        color: "#e85d5d",
        lineWidth: 2,
        title: "SL",
      });
    }
    if (levels?.tp1) {
      seriesRef.current.createPriceLine({
        price: levels.tp1,
        color: "#1dbf73",
        lineWidth: 1,
        title: "TP1",
      });
    }
    if (levels?.tp2) {
      seriesRef.current.createPriceLine({
        price: levels.tp2,
        color: "#1dbf73",
        lineWidth: 1,
        title: "TP2",
      });
    }
    if (levels?.tp3) {
      seriesRef.current.createPriceLine({
        price: levels.tp3,
        color: "#39ff14",
        lineWidth: 1,
        title: "TP3",
      });
    }
    chartRef.current?.timeScale().fitContent();
  }, [candles, levels]);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl border border-line" />;
}
