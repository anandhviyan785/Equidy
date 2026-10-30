# Equidy

An AI-powered financial intelligence platform: a ChatGPT-style assistant combined with portfolio analytics, risk statistics, markets, a watchlist and research tools.

## Quick start

```bash
npm install
npm run dev          # web on http://localhost:5173, API on :8787
```

To get live answers from Claude, set a key before starting the API:

```bash
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
export $(grep -v '^#' .env | xargs) && npm run dev
```

Without a key, Equidy runs its built-in **offline analysis engine**, so every feature still works. It handles company analysis, comparisons, compound-interest maths, portfolio and risk reviews, market overviews and finance concepts.

Production: `npm run build && npm start` (Express serves `dist/` and the API on one port).

## Sign-in (Apple, Google, Microsoft)

The app opens on a login page. Sign-in runs on the server (OAuth 2.0 authorization code with PKCE, through [arctic](https://arcticjs.dev)). The session lives in an HMAC-signed, HttpOnly cookie that lasts 30 days. Once any provider is configured, `/api/chat` requires a signed-in user.

Each provider turns on when its variables are set (see `.env.example`). Register this redirect URI with each provider:

```
<APP_URL>/api/auth/<google|microsoft|apple>/callback
```

| Provider | Where to create credentials | Variables |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft | Entra admin center → App registrations → New registration (Web platform), then add a client secret | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` (`common` allows work and personal accounts) |
| Apple | Apple Developer → Identifiers → Services ID with Sign in with Apple, plus a Sign in with Apple key (.p8) | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

Also set `APP_URL` (the public origin) and `SESSION_SECRET`. Apple needs HTTPS and a real domain. It does not accept `localhost` redirect URIs, so test it on a deployed URL or a tunnel.

When no provider is configured, the login buttons open a local **demo account**. The page says this clearly, and no provider is contacted.

## Deploy (free, no credit card): Vercel

1. Push this folder to a GitHub repository, with `package.json` at the top level.
2. At vercel.com, sign up with GitHub, choose **Add New → Project**, and import the repository. The settings come from `vercel.json`, so change nothing.
3. Under **Environment Variables**, add `SESSION_SECRET` (a long random string). Optionally add `ANTHROPIC_API_KEY` and the sign-in provider keys.
4. Click **Deploy**. Your site is at `https://<project>.vercel.app`. `APP_URL` is set automatically from Vercel's production domain.

The frontend is served as static files, and `api/index.ts` runs the same Express app as a serverless function. `render.yaml` and the `Dockerfile` remain for Render or any container host.

## Features

| Area | What it does |
|---|---|
| **Chat** | Streaming answers, Markdown and tables, suggested prompts, stop and regenerate, copy, persisted history with search, pin, rename and delete. Every request sends a snapshot of the user's portfolio and market context. |
| **Portfolio** | Add, edit and remove holdings (repeat buys average the cost). Live value, day and unrealised P/L, performance chart with a vs-S&P 500 overlay, allocation by sector or holding, sortable table. |
| **Statistics** | Annualised return, volatility, Sharpe, Sortino, beta, alpha, max drawdown, 1-day VaR(95%), diversification (1 − HHI). Drawdown curve, return histogram, monthly heatmap, correlation matrix, sector exposure, benchmark table. |
| **Markets** | Index cards, interactive chart (1D–2Y), sector performance, gainers and decliners, filterable securities table. |
| **Symbol pages** | Price chart, key statistics, 5-year revenue and net income, watch, add to portfolio, "Ask Equidy". |
| **Watchlist** | Search to add, star toggles, sparklines, AI briefing. |
| **Research** | Company screener, compound-growth calculator, finance lessons that open as chats. |
| **Settings / Profile** | Dark, light or system theme; currency; live ticks; response style; risk profile; risk-free rate; export, reset and clear data. |

Keyboard: `Ctrl/⌘+B` toggles the sidebar, `Ctrl/⌘+Shift+O` starts a new chat. The layout works from phone width up.

## Architecture

```
server/app.ts          Express API: /api/health, /api/chat (SSE streaming via @anthropic-ai/sdk)
server/index.ts        Long-running server (local, Render, Docker): serves dist/ and the API
api/index.ts           Vercel serverless entry (same Express app)
server/auth.ts         OAuth sign-in (Google, Microsoft, Apple), signed session cookies
src/
  data/securities.ts   Reference universe (prices, betas, 5-year fundamentals)
  lib/market.ts        Deterministic market simulator (seeded GBM with a shared market factor)
  lib/finance.ts       Positions, risk metrics, correlation, compounding
  lib/context.ts       Portfolio/market snapshot shared with the AI
  lib/ai.ts            Client: Claude via backend, automatic fallback to the offline engine
  lib/engine.ts        Offline analysis engine (intent routing → Markdown)
  lib/chatRunner.ts    Streaming lifecycle (abort, regenerate, survives navigation)
  lib/auth.ts          Session check, OAuth redirect, demo sign-in, sign-out
  store/               Zustand stores persisted to localStorage (memory fallback)
  components/, pages/  UI
tests/                 Vitest unit tests (finance maths and engine routing)
```

**AI backend.** The default model is `claude-opus-5-5` with adaptive thinking at `medium` effort. Server-side refusal fallbacks are on (`fallbacks: "default"`). Override the model with `EQUIDY_MODEL`. The API key stays on the server and is never sent to the browser.

**Market data is simulated.** Prices are reproducible, correlated random walks anchored to reference levels, so the numbers stay consistent across reloads and pages. To use real data, replace `useMarket` and `history()` with a market-data provider; the rest of the app reads only those two.

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm test` · `npm run typecheck` · `npm run build:single` (self-contained single HTML file with in-memory routing and the offline engine)

> Equidy provides information and education, not personalised investment advice.
