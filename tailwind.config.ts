import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        "short-fit": { raw: "(max-height: 940px)" },
        "shorter": { raw: "(max-height: 740px)" },
      },
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        cardHover: "rgb(var(--card-rgb) / 0.88)",
        edge: "rgb(var(--edge-rgb) / <alpha-value>)",
        fg: "rgb(var(--fg-rgb) / <alpha-value>)",
        dim: "rgb(var(--dim-rgb) / <alpha-value>)",
        faint: "rgb(var(--faint-rgb) / <alpha-value>)",
        button: "rgb(var(--button-rgb) / <alpha-value>)",
        calm: "rgb(var(--calm-rgb) / <alpha-value>)", // themeable primary accent
        sea: "rgb(var(--sea-rgb) / <alpha-value>)", // themeable secondary accent
        rose: "#FDA4AF", // soft rose warmth
        mint: "#34D399",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.375rem",
      },
      boxShadow: {
        glow: "0 0 44px rgb(var(--calm-rgb) / 0.28)",
        card: "0 8px 30px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
