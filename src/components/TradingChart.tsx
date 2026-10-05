"use client";

import { useEffect, useMemo, useRef } from "react";

/** تحويل فريمات المكتب إلى فواصل TradingView Advanced Chart */
function toTvInterval(interval: string): string {
  const map: Record<string, string> = {
    "1s": "1S",
    "5s": "5S",
    "15s": "15S",
    "30s": "30S",
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "8h": "480",
    "12h": "720",
    "1d": "D",
    "3d": "3D",
    "1w": "W",
    "1M": "M",
    "1y": "12M",
  };
  return map[interval] ?? "15";
}

function toTvSymbol(symbol: string): string {
  const s = (symbol || "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pair = s.endsWith("USDT") ? s : `${s}USDT`;
  return `BINANCE:${pair}`;
}

/**
 * شارت TradingView الحقيقي (Advanced Chart Widget)
 * متصل مباشرة بمنصة TradingView / بيانات Binance الحية.
 */
export function TradingChart({
  symbol,
  interval,
}: {
  symbol: string;
  interval: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = useMemo(() => toTvSymbol(symbol), [symbol]);
  const tvInterval = useMemo(() => toTvInterval(interval), [interval]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetHost = document.createElement("div");
    widgetHost.className = "tradingview-widget-container__widget";
    widgetHost.style.height = "100%";
    widgetHost.style.width = "100%";
    container.appendChild(widgetHost);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "ar_AE",
      backgroundColor: "#0b0e11",
      gridColor: "rgba(36, 49, 64, 0.5)",
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      hotlist: true,
      calendar: false,
      studies: [
        "MAExp@tv-basicstudies",
        "MACD@tv-basicstudies",
        "PSAR@tv-basicstudies",
      ],
      show_popup_button: true,
      popup_width: "1200",
      popup_height: "800",
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div className="h-full w-full" dir="ltr" style={{ direction: "ltr" }}>
      <div
        ref={containerRef}
        className="tradingview-widget-container h-full w-full"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
