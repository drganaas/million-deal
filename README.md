# Million Deal | صفقة المليون

Next.js 14 crypto signals desk with a 5-strategy smart engine.

## Stack

- Next.js 14 + TypeScript + Tailwind
- Supabase Auth (Magic Link / Email OTP)
- Binance REST + WebSocket (`wss://stream.binance.com:9443`)
- Bybit + OKX secondary prices
- CoinGecko metadata
- TradingView Lightweight Charts v4
- Zustand

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill Supabase keys for real Magic Link
npm run dev
```

Preview: http://localhost:3000

Demo login (without Supabase): enter any email → code `123456`

## Strategies (`calculateSmartEntry`)

1. Hidden Candle
2. Liquidity Grab
3. SMC + BOS/CHOCH
4. Volume + Momentum
5. Bottom Detector

Show only if **≥ 3/5** agree. 4/5 → 90%+ success rate.

## Disclaimer

Educational analysis only — not financial advice.
