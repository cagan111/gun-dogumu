import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Siyah premium tema: koyu yüzeyler, şampanya/pirinç vurgu, kıl inceliğinde çizgiler
        paper: "rgb(var(--c-paper) / <alpha-value>)",   // taban #0B0B0C
        surface: "rgb(var(--c-surface) / <alpha-value>)", // kart #121214
        sand: "rgb(var(--c-raised) / <alpha-value>)",   // yükseltilmiş #1A1A1D
        sea: "#C9A96E",
        olive: "#C9A96E",
        clay: "#E58F78",
        gold: { DEFAULT: "#C9A96E", hi: "#DEC592" },
        line: "rgb(255 255 255 / 0.1)",
        // Eski açık tema sınıfları (slate-*) koyu ölçeğe çevrildi: 50-300 yüzey/çizgi, 400-950 metin
        slate: {
          50: "#121214", 100: "#1A1A1D", 200: "rgb(255 255 255 / 0.1)", 300: "#64646B", 400: "#8F8A83",
          500: "#9B968E", 600: "#A7A29A", 700: "#C3BEB5", 800: "#DAD5CC", 900: "#F2EEE6", 950: "#FAF7F0",
        },
        red: { 50: "#2A1416", 100: "#371A1D", 200: "#6B2F34", 300: "#8E3E44", 400: "#F28E93", 500: "#E5484D", 600: "#E5484D", 700: "#B3262F", 800: "#8E1D25" },
        emerald: { 50: "#10231B", 100: "#12301F", 200: "#2A6A49", 300: "#72D3A2", 700: "#177A4D" },
        amber: { 100: "#3A2D12", 200: "#F0CF8A" },
        violet: { 100: "#2A2147", 200: "#CDBFF5" },
        // Salon marka rengi CSS değişkeniyle (R G B) gelir: --brand / --brand-fg
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
} satisfies Config;
