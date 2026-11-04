# Equidy

An AI-powered financial intelligence platform: a ChatGPT-style assistant combined with portfolio analytics, risk statistics, markets, a watchlist and research tools.

## Quick start

```bash
npm install
npm run dev          # web on http://localhost:5173, API on :8787
```

To get live answers from OpenAI, set a key before starting the API:

```bash
cp .env.example .env   # then fill in OPENAI_API_KEY
export $(grep -v '^#' .env | xargs) && npm run dev
```

Without a key, Equidy runs its built-in **offline analysis engine**, so every feature still works. It handles company analysis, comparisons, compound-interest maths, portfolio and risk reviews, market overviews and finance concepts.

Production: `npm run build && npm start` (Express serves `dist/` and the API on one port).

## Services

Every integration is optional and switches on when its keys are set (see `.env.example`). Whatever isn't configured falls back: the offline AI engine, simulated prices, browser-only storage, no bank links. **Settings → Data sources** shows what's active.

| Service | Used for | Keys |
|---|---|---|
| **OpenAI** | The AI assistant (Responses API, streamed) | `OPENAI_API_KEY` |
| **Supabase** | Accounts (email/password, plus Google, Microsoft and Apple through Supabase Auth) and the database: cloud-synced portfolio, watchlist, chats and settings; encrypted bank links; shared market-data cache | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Alpha Vantage** | Daily price history behind charts and risk statistics, plus quotes | `ALPHAVANTAGE_API_KEY` (`ALPHAVANTAGE_PREMIUM=true` for a paid key) |
| **Finnhub** | Financial intelligence: company profile, key metrics, analyst ratings, earnings surprises, peers, company and market news. Also real-time quotes. Fed to the AI as context | `FINNHUB_API_KEY` |
| **Plaid** | Bank and brokerage connections: balances, 30-day transactions, investment holdings (importable into the portfolio). Summaries are shared with the AI | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` |

### Running on free plans

All of the data services work on free plans, and the defaults are tuned to stay inside them:

- **Supabase Free**: 500 MB database, 50,000 monthly active users. Free projects pause after a week with no activity; open the dashboard to resume.
- **Alpha Vantage Free**: 25 requests a day. History is cached for 24 hours and shared through Supabase (enough for about 20 symbols a day); quotes use Finnhub first.
- **Finnhub Free**: 60 calls a minute. Every endpoint Equidy uses (quote, profile, metrics, recommendations, earnings, peers, company and market news) is on the free plan. Crypto quotes need a paid Finnhub plan, so BTC and ETH use Alpha Vantage's free daily data instead.
- **Plaid**: sandbox (test banks) is free. For real accounts, Plaid's free Trial plan allows 10 connected banks for new US/Canada teams; more than that needs a paid plan.
- **OpenAI is pay-as-you-go**; without a key Equidy uses its free offline engine. Vercel's free Hobby plan is for non-commercial use.

### Supabase setup

1. Create a project at supabase.com. From **Project Settings → API**, copy the URL, the anon (publishable) key and the service-role (secret) key.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. Under **Authentication → URL Configuration**, set the Site URL to your app and add these redirect URLs: `<APP_URL>/api/auth/supabase/callback` and `<APP_URL>/login`.
4. Optional: under **Authentication → Providers**, turn on Google, Azure (Microsoft) and Apple. Their buttons appear on the login page automatically.
5. If **Confirm email** is on (the default), new users get a confirmation link before they can sign in.

Sessions are still Equidy's own HMAC-signed, HttpOnly cookie; Supabase verifies the credentials. Signed-in users' data syncs to the `equidy_user_data` table (last writer wins). Tables have row-level security on with no policies, so only the server's service key can reach them.

### Market data and limits

Alpha Vantage's free tier allows **25 requests a day** and has no batch quotes. Equidy therefore uses Alpha Vantage for daily history (cached 24 hours and shared through Supabase) and Finnhub, when configured, for real-time quotes, with each falling back to the other. Without Finnhub, quotes come from Alpha Vantage for held and watched symbols only, refreshed every 30 minutes. The free tier returns the last ~100 trading days; older points on 1Y/2Y charts and in risk statistics stay simulated and are labelled as such. Indices (S&P 500, Nasdaq 100 and so on) remain simulated.

### Plaid setup

Create keys at dashboard.plaid.com. Start with `PLAID_ENV=sandbox` and sign in to any test bank with `user_good` / `pass_good`. Production needs Plaid's approval. Plaid covers banks in the US, Canada, the UK and much of Europe (`PLAID_COUNTRY_CODES`). Banks that use their own sign-in page need `PLAID_REDIRECT_URI=<APP_URL>/banking`, registered in the Plaid dashboard. Access tokens are encrypted with AES-256-GCM using `SESSION_SECRET` (or `TOKEN_ENCRYPTION_KEY`) and never reach the browser. Bank linking needs Supabase's service key and `SESSION_SECRET`.

## Sign-in without Supabase

If Supabase isn't configured, Google, Microsoft and Apple can be used directly (OAuth 2.0 authorization code with PKCE, through [arctic](https://arcticjs.dev)). Once any sign-in method is configured, `/api/chat` requires a signed-in user.

Each provider turns on when its variables are set (see `.env.example`). Register this redirect URI with each provider:

```
<APP_URL>/api/auth/<google|microsoft|apple>/callback
```

| Provider | Where to create credentials | Variables |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft | Entra admin center → App registrations → New registration (Web platform), then add a client secret | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` (`common` allows work and personal accounts) |
| Apple | Apple Developer → Identifiers → Services ID with Sign in with Apple, plus a Sign in with Apple key (.p8) | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

Apple needs HTTPS and a real domain. It does not accept `localhost` redirect URIs, so test it on a deployed URL or a tunnel. The static single-file preview has no server, so it offers a local demo instead.

## Deploy (free, no credit card): Vercel

1. Push this folder to a GitHub repository, with `package.json` at the top level.
2. At vercel.com, sign up with GitHub, choose **Add New → Project**, and import the repository. The settings come from `vercel.json`, so change nothing.
3. Under **Environment Variables**, add `SESSION_SECRET` (a long random string), then any of the service keys above: `OPENAI_API_KEY`, the three Supabase keys, `ALPHAVANTAGE_API_KEY`, `FINNHUB_API_KEY` and the Plaid keys.
4. Click **Deploy**. Your site is at `https://<project>.vercel.app`. `APP_URL` is set automatically from Vercel's production domain.

The frontend is served as static files, and `api/index.ts` runs the same Express app as a serverless function. `render.yaml` and the `Dockerfile` remain for Render or any container host.

## Features

| Area | What it does |
|---|---|
| **Chat** | Streaming answers, Markdown and tables, suggested prompts, stop and regenerate, copy, persisted history with search, pin, rename and delete. Every request sends a snapshot of the user's portfolio and market context. |
| **Portfolio** | Add, edit and remove holdings (repeat buys average the cost). Live value, day and unrealised P/L, performance chart with a vs-S&P 500 overlay, allocation by sector or holding, sortable table. |
| **Statistics** | Annualised return, volatility, Sharpe, Sortino, beta, alpha, max drawdown, 1-day VaR(95%), diversification (1 − HHI). Drawdown curve, return histogram, monthly heatmap, correlation matrix, sector exposure, benchmark table. |
| **Markets** | Index cards, interactive chart (1D–2Y), sector performance, gainers and decliners, filterable securities table, Finnhub market news. |
| **Symbol pages** | Price chart (real Alpha Vantage history where available), key statistics, 5-year revenue and net income, Finnhub analyst ratings, metrics, earnings, peers and news, watch, add to portfolio, "Ask Equidy". |
| **Banking** | Link banks and brokerages with Plaid: balances, credit owed, 30-day transactions, brokerage holdings with one-tap import into the portfolio, AI review of spending. |
| **Watchlist** | Search to add, star toggles, sparklines, AI briefing. |
| **Research** | Company screener, compound-growth calculator, finance lessons that open as chats. |
| **Settings / Profile** | Dark, light or system theme; currency; live ticks; response style; risk profile; risk-free rate; export, reset and clear data. |

Keyboard: `Ctrl/⌘+B` toggles the sidebar, `Ctrl/⌘+Shift+O` starts a new chat. The layout works from phone width up.

## Architecture

```
server/app.ts          Express API: /api/health, /api/chat (SSE streaming from the OpenAI Responses API)
server/api.ts          Routes: /api/market/*, /api/intel/*, /api/data (sync), /api/plaid/*
server/openai.ts       Fetch-based OpenAI Responses client (one-shot + SSE streaming)
server/supabase.ts     Supabase Auth (GoTrue) and database (PostgREST) over fetch
server/accounts.ts     Email/password accounts on Supabase Auth
server/auth.ts         Sign-in (Supabase or direct OAuth), signed session cookies
server/userdata.ts     Cloud-synced portfolio, watchlist, chats and settings
server/market.ts       Alpha Vantage history/quotes and Finnhub quotes, with fallbacks
server/finnhub.ts      Finnhub intelligence (profile, metrics, ratings, earnings, peers, news)
server/plaid.ts        Plaid Link tokens, encrypted item storage, accounts, transactions, holdings
server/cache.ts        In-memory + Supabase cache shared across instances
server/index.ts        Long-running server (local, Render, Docker): serves dist/ and the API
api/index.ts           Vercel serverless entry (same Express app)
supabase/schema.sql    Tables for Supabase (run once)
src/
  data/securities.ts   Reference universe (prices, betas, 5-year fundamentals)
  lib/market.ts        Price history: real Alpha Vantage bars where loaded, simulator elsewhere
  lib/live.ts          Live quotes/history refresh and Finnhub intelligence on the client
  lib/sync.ts          Supabase cloud sync of the stores
  lib/banking.ts       Plaid Link and bank data on the client
  lib/finance.ts       Positions, risk metrics, correlation, compounding
  lib/context.ts       Portfolio/market/bank snapshot shared with the AI (labels live vs simulated)
  lib/ai.ts            Client: OpenAI via backend, automatic fallback to the offline engine
  lib/engine.ts        Offline analysis engine (intent routing → Markdown)
  lib/chatRunner.ts    Streaming lifecycle (abort, regenerate, survives navigation)
  lib/auth.ts          Session check, OAuth redirect, demo sign-in, sign-out
  store/               Zustand stores persisted to localStorage (memory fallback)
  components/, pages/  UI
tests/                 Vitest unit tests
```

**AI backend.** Equidy calls the OpenAI Responses API directly with `fetch` (`server/openai.ts`, no SDK). The default model is `gpt-6.1-sol` with reasoning effort `medium` for chat and `low` for titles. Override the model with `EQUIDY_MODEL`, and point at a compatible gateway with `OPENAI_BASE_URL`. The API key stays on the server and is never sent to the browser. Each chat request adds Finnhub intelligence for the companies mentioned and the day's market headlines.

**Market data.** Live quotes replace simulated prices symbol by symbol, and real daily history replaces the simulated series wherever it has loaded. Anything without real data keeps the reproducible simulator (correlated random walks anchored to reference levels), and the app and the AI label which is which.

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm test` · `npm run typecheck` · `npm run build:single` (self-contained single HTML file with in-memory routing and the offline engine)

> Equidy provides information and education, not personalised investment advice.
