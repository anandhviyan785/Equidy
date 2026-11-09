import typography from "@tailwindcss/typography";
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        up: "rgb(var(--up) / <alpha-value>)",
        down: "rgb(var(--down) / <alpha-value>)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        blink: { "0%,100%": { opacity: 0.2 }, "50%": { opacity: 1 } },
        "chart-draw": { "0%": { strokeDashoffset: "1" }, "55%,85%": { strokeDashoffset: "0" }, "100%": { strokeDashoffset: "-1" } },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        blink: "blink 1.2s infinite",
        "chart-draw": "chart-draw 1.6s ease-in-out infinite",
        "ring-spin": "spin .9s linear infinite",
      },
    },
  },
  plugins: [typography],
};
