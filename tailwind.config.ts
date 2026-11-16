import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Salon marka rengi CSS değişkeniyle (R G B) gelir: --brand / --brand-fg
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
} satisfies Config;
