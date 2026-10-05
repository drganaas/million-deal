"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type IPriceLine,
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
  height = 460,
}: {
  candles: Candle[];
  levels?: Levels;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
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
      rightPriceScale: { borderColor: "#243140" },
      timeScale: { borderColor: "#243140" },
      crosshair: { mode: 1 },
      width: ref.current.clientWidth,
      height,
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
      linesRef.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    const series = seriesRef.current;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);

    for (const line of linesRef.current) {
      series.removePriceLine(line);
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

    chartRef.current?.timeScale().fitContent();
  }, [candles, levels]);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl border border-line" />;
}
