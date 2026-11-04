import express, { type Request, type Response } from "express";
import { readSession, requireAuth, requireUser, type SessionUser } from "./auth.js";
import { getCompanyIntel, getMarketNews, intelEnabled } from "./finnhub.js";
import { getHistory, getQuotes, isSymbol, marketStatus } from "./market.js";
import { createLinkToken, exchangePublicToken, getAccounts, getHoldings, getTransactions, plaidStatus, PlaidError, removeItem } from "./plaid.js";
import { DataError, loadUserData, parseUserData, saveUserData, syncEnabled } from "./userdata.js";
import { rateLimit, AccountError } from "./accounts.js";

// REST routes for market data (Alpha Vantage/Finnhub), intelligence (Finnhub), cloud sync (Postgres)
// and bank connections (Plaid).

export function servicesStatus() {
  const m = marketStatus();
  const p = plaidStatus();
  return { quotes: m.quotes, quotesRealtime: m.realtime, history: m.history, historyFull: m.premium, intel: intelEnabled(), sync: syncEnabled(), banking: p.enabled, bankingEnv: p.environment };
}

const user = (res: Response) => res.locals.user as SessionUser;

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out);
    } catch (err) {
      const status = err instanceof PlaidError || err instanceof DataError || err instanceof AccountError ? err.status : 500;
      if (status >= 500) console.error(`[equidy] ${req.method} ${req.originalUrl}:`, err);
      if (!res.headersSent) res.status(status).json({ error: status >= 500 && !(err instanceof PlaidError) ? "Something went wrong on our side. Please try again." : (err as Error).message });
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

// ---------------- banking (Plaid) ----------------

apiRouter.post(
  "/plaid/link-token",
  requireUser,
  throttle("plaid-link", 10),
  handle(async (_req, res) => createLinkToken(user(res).id)),
);

apiRouter.post(
  "/plaid/exchange",
  requireUser,
  throttle("plaid-exchange", 10),
  handle(async (req, res) => {
    const { publicToken, institution } = (req.body ?? {}) as { publicToken?: unknown; institution?: unknown };
    if (typeof publicToken !== "string" || !publicToken.startsWith("public-")) throw new PlaidError("Missing bank connection token.", 400);
    return exchangePublicToken(user(res).id, publicToken, typeof institution === "string" ? institution : null);
  }),
);

apiRouter.get(
  "/plaid/accounts",
  requireUser,
  throttle("plaid-read", 30),
  handle(async (_req, res) => ({ institutions: await getAccounts(user(res).id) })),
);

apiRouter.get(
  "/plaid/transactions",
  requireUser,
  throttle("plaid-read-tx", 20),
  handle(async (req, res) => ({ transactions: await getTransactions(user(res).id, Number(req.query.days) || 30) })),
);

apiRouter.get(
  "/plaid/holdings",
  requireUser,
  throttle("plaid-read-h", 20),
  handle(async (_req, res) => ({ holdings: await getHoldings(user(res).id) })),
);

apiRouter.delete(
  "/plaid/items/:itemId",
  requireUser,
  throttle("plaid-remove", 10),
  handle(async (req, res) => {
    await removeItem(user(res).id, String(req.params.itemId));
    return { ok: true };
  }),
);
