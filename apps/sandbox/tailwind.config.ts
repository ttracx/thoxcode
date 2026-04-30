import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Thox brand
        "thox-bg": "#0e0f12",        // Nova Space Gray base
        "thox-surface": "#16181d",
        "thox-border": "#262931",
        "thox-text": "#e6e8ee",
        "thox-muted": "#8b91a1",
        "thox-cyan": "#22d3ee",       // Quantum Cyan
        "thox-cyan-dim": "#0891b2",
        "thox-accent": "#a78bfa",     // Quantum Violet (secondary)
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
