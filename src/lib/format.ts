import { clsx, type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

let currency = "USD";
export const setCurrency = (c: string) => (currency = c);

const FX: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.78, INR: 84.1, JPY: 151.2 };

export function money(v: number, opts: { compact?: boolean; decimals?: number; sign?: boolean } = {}) {
  const x = v * (FX[currency] ?? 1);
  const abs = Math.abs(x);
  const decimals = opts.decimals ?? (abs >= 1000 && opts.compact ? 1 : 2);
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: opts.compact && abs >= 10_000 ? "compact" : "standard",
    minimumFractionDigits: opts.compact && abs >= 10_000 ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return (x < 0 ? "−" : opts.sign && x > 0 ? "+" : "") + s;
}

export function pct(v: number, decimals = 2, sign = true) {
  const s = (Math.abs(v) * 100).toFixed(decimals) + "%";
  return (v < 0 ? "−" : sign && v > 0 ? "+" : "") + s;
}

export function num(v: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function price(v: number) {
  return num(v, v >= 1000 ? 2 : v < 10 ? 3 : 2);
}

export const tone = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted");

export function relTime(t: number) {
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
