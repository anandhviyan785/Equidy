import express, { type Request, type Response } from "express";
import { readSession, requireAuth, requireUser, type SessionUser } from "./auth.js";
import { getCompanyIntel, getMarketNews, intelEnabled } from "./finnhub.js";
import { getHistory, getQuotes, isSymbol, marketStatus } from "./market.js";
import { DataError, loadUserData, parseUserData, saveUserData, syncEnabled } from "./userdata.js";
import { rateLimit, AccountError } from "./accounts.js";

// REST routes for market data (Alpha Vantage/Finnhub), intelligence (Finnhub) and cloud sync (Postgres).

export function servicesStatus() {
  const m = marketStatus();
  return { quotes: m.quotes, quotesRealtime: m.realtime, history: m.history, historyFull: m.premium, intel: intelEnabled(), sync: syncEnabled() };
}

const user = (res: Response) => res.locals.user as SessionUser;

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out);
    } catch (err) {
      const status = err instanceof DataError || err instanceof AccountError ? err.status : 500;
      if (status >= 500) console.error(`[equidy] ${req.method} ${req.originalUrl}:`, err);
      if (!res.headersSent) res.status(status).json({ error: status >= 500 ? "Something went wrong on our side. Please try again." : (err as Error).message });
    }
  };
}

/** Per-visitor throttle for endpoints that spend third-party quota. */
function throttle(name: string, max: number, windowMs = 60_000) {
  return (req: Request, res: Response, next: () => void) => {
    try {
      rateLimit(`${name}:${readSession(req)?.id ?? req.ip}`, max, windowMs);
      next();
    } catch (err) {
      res.status(429).json({ error: (err as Error).message });
    }
  };
}

const symbolParam = (req: Request) => {
  const s = String(req.params.symbol ?? "").toUpperCase();
  if (!isSymbol(s)) throw new DataError("Unknown symbol.");
  return s;
};

export const apiRouter = express.Router();

// ---------------- market data ----------------

apiRouter.get(
  "/market/quotes",
  requireAuth,
  throttle("quotes", 30),
  handle(async (req) => {
    const symbols = String(req.query.symbols ?? "").split(",").filter(Boolean);
    return { quotes: await getQuotes(symbols) };
  }),
);

apiRouter.get(
  "/market/history/:symbol",
  requireAuth,
  throttle("history", 40),
  handle(async (req) => {
    const h = await getHistory(symbolParam(req));
    return h ?? { bars: null };
  }),
);

// ---------------- intelligence ----------------

apiRouter.get(
  "/intel/news",
  requireAuth,
  throttle("news", 30),
  handle(async () => ({ news: (await getMarketNews()) ?? [] })),
);

apiRouter.get(
  "/intel/:symbol",
  requireAuth,
  throttle("intel", 30),
  handle(async (req) => ({ intel: await getCompanyIntel(symbolParam(req)) })),
);

// ---------------- cloud sync ----------------

apiRouter.get(
  "/data",
  requireUser,
  handle(async (_req, res) => {
    if (!syncEnabled()) throw new DataError("Cloud sync isn't set up on this server.", 503);
    return { data: await loadUserData(user(res).id) };
  }),
);

apiRouter.put(
  "/data",
  express.json({ limit: "4mb" }),
  requireUser,
  throttle("sync", 30),
  handle(async (req, res) => {
    if (!syncEnabled()) throw new DataError("Cloud sync isn't set up on this server.", 503);
    await saveUserData(user(res).id, parseUserData(req.body));
    return { ok: true };
  }),
);
