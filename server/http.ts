// Shared JSON-over-HTTP helper for third-party APIs (Supabase, Alpha Vantage, Finnhub, Plaid).

export class UpstreamError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** Performs a request and returns parsed JSON (or null for empty bodies). Non-2xx responses throw UpstreamError. */
export async function requestJson<T = unknown>(provider: string, url: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: { Accept: "application/json", ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...opts.headers },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamError(provider, `Could not reach ${provider}: ${(err as Error).message}`, undefined, "connection_error");
  }
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
    const message = String(o.msg ?? o.message ?? o.error_message ?? o.error_description ?? o.error ?? `${provider} request failed (${res.status})`);
    const code = (o.error_code ?? o.code ?? (typeof o.error === "string" ? o.error : undefined)) as string | undefined;
    throw new UpstreamError(provider, message, res.status, code === undefined ? undefined : String(code), json);
  }
  return json as T;
}
