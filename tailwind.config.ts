import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f9f5ee",
        sand: "#f0e2cc",
        sea: "#26555c",
        olive: "#465635",
        clay: "#9b4835",
        line: "#d9cbb9",
        // Salon marka rengi CSS değişkeniyle (R G B) gelir: --brand / --brand-fg
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
} satisfies Config;
