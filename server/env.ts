// Reads environment variables lazily, stripping the stray whitespace and quotes that
// values pasted into hosting dashboards often pick up.

export function getEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const v = raw.trim().replace(/^(["'])(.*)\1$/s, "$2").trim();
  return v || undefined;
}

export const envFlag = (name: string) => /^(1|true|yes|on)$/i.test(getEnv(name) ?? "");

export function envNumber(name: string, fallback: number): number {
  const n = Number(getEnv(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Public URL of the app. On Vercel the production domain is provided automatically. */
export function appUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
  return (getEnv("APP_URL") || vercel || "http://localhost:5173").replace(/\/+$/, "");
}
