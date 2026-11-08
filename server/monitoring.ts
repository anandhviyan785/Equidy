import { getEnv } from "./env.js";

// Sentry error tracking. Optional: does nothing without SENTRY_DSN.
// Reports carry only the error and the route. Chats, portfolios, cookies and identities are removed.

const MAX_MESSAGE = 300;
const FLUSH_MS = 1500;

type Exception = { value?: string };
export interface ScrubbableEvent {
  message?: string;
  user?: unknown;
  extra?: unknown;
  breadcrumbs?: unknown;
  server_name?: string;
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
  exception?: { values?: Exception[] };
}

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;

function cleanText(text: string): string {
  return text.replace(EMAIL, "[email]").slice(0, MAX_MESSAGE);
}

/** Removes anything that could contain personal or financial data before a report leaves the server. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.server_name;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.headers;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.message) event.message = cleanText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = cleanText(ex.value);
  }
  return event;
}

type SentryModule = typeof import("@sentry/node");
let loading: Promise<SentryModule | null> | null = null;

function loadSentry(): Promise<SentryModule | null> {
  const dsn = getEnv("SENTRY_DSN");
  if (!dsn) return Promise.resolve(null);
  loading ??= import("@sentry/node")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false } },
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event as ScrubbableEvent) as typeof event,
      });
      return Sentry;
    })
    .catch((err: Error) => {
      console.warn("[equidy] error tracking unavailable:", err.message);
      return null;
    });
  return loading;
}

/** Sends an error to Sentry and waits briefly, because serverless functions can stop right after responding. */
export async function reportError(err: unknown, where: string): Promise<void> {
  try {
    const Sentry = await loadSentry();
    if (!Sentry) return;
    Sentry.captureException(err, { tags: { where } });
    await Sentry.flush(FLUSH_MS);
  } catch {
    /* Error reporting must never cause another failure. */
  }
}
