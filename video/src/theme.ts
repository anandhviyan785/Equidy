import { INTER_WOFF2_BASE64 } from "./interFont";

export const FONT = "'Equidy Inter', Inter, system-ui, sans-serif";

/** Declared as plain CSS (no async loading), so a render can never stall waiting on a font. */
export const FONT_FACE_CSS = `@font-face{font-family:'Equidy Inter';font-weight:100 900;font-style:normal;src:url(data:font/woff2;base64,${INTER_WOFF2_BASE64}) format('woff2');}`;

// Mirrors Equidy's dark theme tokens (src/index.css).
export const C = {
  bg: "#000000",
  surface: "#1c1c1e",
  elevated: "#2c2c2e",
  line: "#383839",
  fg: "#f5f5f7",
  muted: "#98989d",
  up: "#30d158",
  down: "#ff6961",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const SCENES = { intro: 120, chat: 210, features: 180, steps: 120, outro: 120 } as const;
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);
