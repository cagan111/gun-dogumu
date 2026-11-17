import type { Config } from "tailwindcss";

/** Ayna Saati tasarım sistemi — bkz. docs/design/DESIGN.md. Eski adlar (paper/sand/sea/olive/clay/line) korunur. */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F3E9",
        bone: "#FFFCF6",
        sand: "#EFE3CD",
        line: { DEFAULT: "#DCCFB9", strong: "#A89878" },
        ink: { DEFAULT: "#10262A", deep: "#0E2326", 2: "#153035", 3: "#1D3E44", soft: "#3D5156" },
        mute: "#4E5F62",
        "on-ink": { DEFAULT: "#F4ECDD", mute: "#A9BDBE" },
        sea: "#1F5A60",
        olive: "#4A5A36",
        clay: "#A8432B",
        brass: { DEFAULT: "#C8932F", deep: "#85590F", bright: "#E2B15A" },
        glow: "#F3C97A",
        plum: "#6B3A5B",
        ok: { DEFAULT: "#2F6B3F", bg: "#E4F0E3" },
        warn: { DEFAULT: "#7A5000", bg: "#FBEBC6" },
        danger: { DEFAULT: "#A32A22", bg: "#FBE3DE" },
        info: { DEFAULT: "#1F5A60", bg: "#DDEBEA" },
        // Salon marka rengi CSS değişkeniyle (R G B) gelir: --brand / --brand-fg
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)" },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: {
        "display-xl": ["2.75rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-lg": ["2.125rem", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "600" }],
        "display-md": ["1.625rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
      borderRadius: { arch: "999px 999px 14px 14px" },
      boxShadow: {
        card: "0 1px 0 rgb(16 38 42 / .04), 0 1px 2px rgb(16 38 42 / .06)",
        lift: "0 2px 4px rgb(16 38 42 / .05), 0 12px 28px -8px rgb(16 38 42 / .18)",
        pop: "0 4px 8px rgb(16 38 42 / .08), 0 28px 60px -12px rgb(16 38 42 / .35)",
        "inset-press": "inset 0 2px 3px rgb(16 38 42 / .25)",
      },
      transitionTimingFunction: { soft: "cubic-bezier(.22,.8,.3,1)", "in-out-soft": "cubic-bezier(.65,0,.35,1)", stamp: "cubic-bezier(.3,1.5,.5,1)" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        "stamp-in": { "0%": { opacity: "0", transform: "scale(1.7) rotate(-14deg)" }, "55%": { opacity: "1", transform: "scale(.96) rotate(-8deg)" }, "100%": { opacity: "1", transform: "scale(1) rotate(-8deg)" } },
        ring: { from: { opacity: ".5", transform: "scale(1)" }, to: { opacity: "0", transform: "scale(1.9)" } },
        draw: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        "pole-slide": { from: { backgroundPosition: "0 0" }, to: { backgroundPosition: "34px 0" } },
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        rise: "rise 420ms cubic-bezier(.22,.8,.3,1) both",
        "stamp-in": "stamp-in 600ms cubic-bezier(.3,1.5,.5,1) both",
        ring: "ring 900ms cubic-bezier(.22,.8,.3,1) both",
        draw: "draw 220ms cubic-bezier(.22,.8,.3,1) both",
        "pole-slide": "pole-slide 1.2s linear infinite",
        bob: "bob 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
