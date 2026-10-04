"use client";

import { create } from "zustand";
import type { SmartSignal } from "@/lib/types";
import type { Candle } from "@/lib/types";

type Lang = "ar" | "en";

type AppState = {
  lang: Lang;
  email: string | null;
  isAdmin: boolean;
  selected: string;
  signals: SmartSignal[];
  candles: Candle[];
  livePrice: number | null;
  loading: boolean;
  alert: string | null;
  setLang: (lang: Lang) => void;
  setEmail: (email: string | null) => void;
  setAdmin: (v: boolean) => void;
  setSelected: (symbol: string) => void;
  setSignals: (rows: SmartSignal[]) => void;
  setCandles: (candles: Candle[]) => void;
  setLivePrice: (price: number | null) => void;
  setLoading: (v: boolean) => void;
  setAlert: (msg: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  lang: "ar",
  email: null,
  isAdmin: false,
  selected: "BTCUSDT",
  signals: [],
  candles: [],
  livePrice: null,
  loading: false,
  alert: null,
  setLang: (lang) => set({ lang }),
  setEmail: (email) => set({ email }),
  setAdmin: (isAdmin) => set({ isAdmin }),
  setSelected: (selected) => set({ selected }),
  setSignals: (signals) => set({ signals }),
  setCandles: (candles) => set({ candles }),
  setLivePrice: (livePrice) => set({ livePrice }),
  setLoading: (loading) => set({ loading }),
  setAlert: (alert) => set({ alert }),
}));
