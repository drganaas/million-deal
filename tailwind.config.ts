import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0f14",
        surface: "#121a22",
        raised: "#18232e",
        inset: "#0c1218",
        fg: "#e8eef4",
        muted: "#8b9aab",
        line: "#243140",
        gold: "#d4a017",
        "gold-soft": "#f0c75e",
        teal: "#1dbf73",
        danger: "#e85d5d",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "var(--font-cairo)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
