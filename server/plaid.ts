import { getEnv } from "./env.js";
import { requestJson, UpstreamError } from "./http.js";
import { decryptSecret, encryptionAvailable, encryptSecret, opaqueUserId } from "./secrets.js";
import { db, dbEnabled, ensureSchema } from "./db.js";

// Bank connections through Plaid. Access tokens are encrypted (AES-256-GCM) and stored in Postgres
// (equidy_plaid_items); they never reach the browser. Needs PLAID_CLIENT_ID, PLAID_SECRET,
// DATABASE_URL and SESSION_SECRET (or TOKEN_ENCRYPTION_KEY).

const MAX_ITEMS_PER_USER = 10;

const plaidEnv = () => {
  const e = (getEnv("PLAID_ENV") ?? "sandbox").toLowerCase();
  return e === "production" ? "production" : "sandbox";
};
const list = (name: string, fallback: string) =>
  (getEnv(name) ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const plaidEnabled = () => !!(getEnv("PLAID_CLIENT_ID") && getEnv("PLAID_SECRET") && dbEnabled() && encryptionAvailable());
export const plaidStatus = () => ({ enabled: plaidEnabled(), environment: plaidEnv() });

export class PlaidError extends Error {
  constructor(message: string, readonly status = 502, readonly code?: string) {
    super(message);
  }
}

async function plaid<T>(path: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await requestJson<T>("Plaid", `https://${plaidEnv()}.plaid.com${path}`, {
      method: "POST",
      body: { client_id: getEnv("PLAID_CLIENT_ID"), secret: getEnv("PLAID_SECRET"), ...body },
      timeoutMs: 30_000,
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      const b = (err.body ?? {}) as { error_code?: string; display_message?: string | null };
      throw new PlaidError(b.display_message || "The bank connection service returned an error.", err.status && err.status < 500 ? 400 : 502, b.error_code);
    }
    throw err;
  }
}

interface ItemRow {
  item_id: string;
  user_id: string;
  access_token_enc: string;
  institution_name: string | null;
  created_at?: string;
}

// ---------------- linking ----------------

export async function createLinkToken(userId: string): Promise<{ linkToken: string; expiration: string }> {
  if (!plaidEnabled()) throw new PlaidError("Bank connections aren't set up on this server.", 503);
  const redirectUri = getEnv("PLAID_REDIRECT_URI");
  // Investments is free in sandbox but may not be in the free Trial plan, so it is opt-in for production.
  const optional = list("PLAID_OPTIONAL_PRODUCTS", plaidEnv() === "sandbox" ? "investments" : "");
  const body: Record<string, unknown> = {
    client_name: "Equidy",
    language: "en",
    country_codes: list("PLAID_COUNTRY_CODES", "US"),
    user: { client_user_id: opaqueUserId(userId) },
    products: list("PLAID_PRODUCTS", "transactions"),
    ...(optional.length ? { optional_products: optional } : {}),
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  };
  const res = await plaid<{ link_token: string; expiration: string }>("/link/token/create", body);
  return { linkToken: res.link_token, expiration: res.expiration };
}

export async function exchangePublicToken(userId: string, publicToken: string, institutionName: string | null): Promise<{ itemId: string }> {
  if (!plaidEnabled()) throw new PlaidError("Bank connections aren't set up on this server.", 503);
  await ensureSchema();
  const existing = (await db()`SELECT item_id FROM equidy_plaid_items WHERE user_id = ${userId}`) as Pick<ItemRow, "item_id">[];
  if (existing.length >= MAX_ITEMS_PER_USER) throw new PlaidError(`You can connect up to ${MAX_ITEMS_PER_USER} banks.`, 400);
  const res = await plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
  const institution = institutionName?.slice(0, 120) ?? null;
  await db()`
    INSERT INTO equidy_plaid_items (item_id, user_id, access_token_enc, institution_name)
    VALUES (${res.item_id}, ${userId}, ${encryptSecret(res.access_token)}, ${institution})
    ON CONFLICT (item_id) DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc, institution_name = EXCLUDED.institution_name
    WHERE equidy_plaid_items.user_id = EXCLUDED.user_id`;
  return { itemId: res.item_id };
}

async function items(userId: string): Promise<{ itemId: string; institution: string | null; token: string }[]> {
  if (!plaidEnabled()) return [];
  await ensureSchema();
  const rows = (await db()`SELECT item_id, user_id, access_token_enc, institution_name FROM equidy_plaid_items WHERE user_id = ${userId}`) as ItemRow[];
  return rows.map((r) => ({ itemId: r.item_id, institution: r.institution_name, token: decryptSecret(r.access_token_enc) }));
}

export async function removeItem(userId: string, itemId: string): Promise<void> {
  const item = (await items(userId)).find((i) => i.itemId === itemId);
  if (!item) throw new PlaidError("That bank connection wasn't found.", 404);
  await plaid("/item/remove", { access_token: item.token }).catch((e) => console.warn("[equidy] Plaid item/remove:", (e as Error).message));
  await db()`DELETE FROM equidy_plaid_items WHERE item_id = ${itemId} AND user_id = ${userId}`;
}

export async function removeAllItems(userId: string): Promise<void> {
  for (const i of await items(userId)) await removeItem(userId, i.itemId);
}

// ---------------- reading data ----------------

export interface BankAccount {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  current: number | null;
  available: number | null;
  currency: string;
}

export interface Institution {
  itemId: string;
  institution: string;
  accounts: BankAccount[];
  error: string | null; // e.g. the bank needs the user to sign in again
}

type RawAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code: string | null; unofficial_currency_code?: string | null };
};

export const mapAccount = (a: RawAccount): BankAccount => ({
  id: a.account_id,
  name: a.name || a.official_name || "Account",
  mask: a.mask ?? null,
  type: a.type,
  subtype: a.subtype ?? null,
  current: a.balances.current,
  available: a.balances.available,
  currency: a.balances.iso_currency_code ?? a.balances.unofficial_currency_code ?? "USD",
});

const friendly = (err: unknown) =>
  err instanceof PlaidError && err.code === "ITEM_LOGIN_REQUIRED" ? "Your bank needs you to reconnect. Remove it and connect again." : err instanceof PlaidError ? err.message : "Couldn't load this bank right now.";

export async function getAccounts(userId: string): Promise<Institution[]> {
  return Promise.all(
    (await items(userId)).map(async (i) => {
      try {
        const res = await plaid<{ accounts: RawAccount[] }>("/accounts/get", { access_token: i.token });
        return { itemId: i.itemId, institution: i.institution ?? "Bank", accounts: res.accounts.map(mapAccount), error: null };
      } catch (err) {
        return { itemId: i.itemId, institution: i.institution ?? "Bank", accounts: [], error: friendly(err) };
      }
    }),
  );
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  name: string;
  amount: number; // Plaid convention: positive = money out
  currency: string;
  category: string;
  pending: boolean;
}

type RawTxn = {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  iso_currency_code: string | null;
  pending: boolean;
  personal_finance_category?: { primary?: string } | null;
  category?: string[] | null;
};

export const mapTransaction = (t: RawTxn): Transaction => ({
  id: t.transaction_id,
  accountId: t.account_id,
  date: t.date,
  name: t.merchant_name || t.name,
  amount: t.amount,
  currency: t.iso_currency_code ?? "USD",
  category: (t.personal_finance_category?.primary ?? t.category?.[0] ?? "OTHER").replace(/_/g, " ").toLowerCase(),
  pending: t.pending,
});

export async function getTransactions(userId: string, days = 30): Promise<Transaction[]> {
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(Math.max(days, 1), 730) * 86_400_000);
  const all = await Promise.all(
    (await items(userId)).map(async (i) => {
      try {
        const res = await plaid<{ transactions: RawTxn[] }>("/transactions/get", {
          access_token: i.token,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          options: { count: 250, offset: 0 },
        });
        return res.transactions.map(mapTransaction);
      } catch (err) {
        // PRODUCT_NOT_READY: Plaid is still pulling history right after linking.
        if (!(err instanceof PlaidError && ["PRODUCT_NOT_READY", "PRODUCTS_NOT_SUPPORTED"].includes(err.code ?? ""))) console.warn("[equidy] Plaid transactions:", (err as Error).message);
        return [];
      }
    }),
  );
  return all.flat().sort((a, b) => b.date.localeCompare(a.date));
}

export interface BrokerageHolding {
  ticker: string | null;
  name: string;
  quantity: number;
  costBasis: number | null; // total cost
  price: number | null;
  value: number | null;
  type: string;
  currency: string;
}

type RawHolding = { security_id: string; quantity: number; cost_basis: number | null; institution_price: number | null; institution_value: number | null; iso_currency_code: string | null };
type RawSecurity = { security_id: string; ticker_symbol: string | null; name: string | null; type: string | null };

export function mapHoldings(holdings: RawHolding[], securities: RawSecurity[]): BrokerageHolding[] {
  const sec = new Map(securities.map((s) => [s.security_id, s]));
  return holdings.map((h) => {
    const s = sec.get(h.security_id);
    return {
      ticker: s?.ticker_symbol?.toUpperCase().replace(/^CUR:/, "") ?? null,
      name: s?.name ?? "Security",
      quantity: h.quantity,
      costBasis: h.cost_basis,
      price: h.institution_price,
      value: h.institution_value,
      type: s?.type ?? "other",
      currency: h.iso_currency_code ?? "USD",
    };
  });
}

export async function getHoldings(userId: string): Promise<BrokerageHolding[]> {
  const all = await Promise.all(
    (await items(userId)).map(async (i) => {
      try {
        const res = await plaid<{ holdings: RawHolding[]; securities: RawSecurity[] }>("/investments/holdings/get", { access_token: i.token });
        return mapHoldings(res.holdings, res.securities);
      } catch (err) {
        if (!(err instanceof PlaidError && ["PRODUCTS_NOT_SUPPORTED", "NO_INVESTMENT_ACCOUNTS", "PRODUCT_NOT_READY", "INVALID_PRODUCT"].includes(err.code ?? ""))) {
          console.warn("[equidy] Plaid holdings:", (err as Error).message);
        }
        return [];
      }
    }),
  );
  return all.flat();
}
