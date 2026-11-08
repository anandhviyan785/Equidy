import express, { type NextFunction, type Request, type Response } from "express";
import type Stripe from "stripe";
import { requireUser, type SessionUser } from "./auth.js";
import { db, dbEnabled } from "./db.js";
import { appUrl, getEnv } from "./env.js";
import { reportError } from "./monitoring.js";

// Stripe subscriptions. Optional: needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID and a database.
// Payment details only ever go to Stripe's hosted pages, never through this server.
// Nothing in the app is locked behind a plan yet.

export const billingEnabled = () => !!(getEnv("STRIPE_SECRET_KEY") && getEnv("STRIPE_WEBHOOK_SECRET") && getEnv("STRIPE_PRICE_ID") && dbEnabled());

async function stripeClient(): Promise<Stripe> {
  const { default: StripeSdk } = await import("stripe");
  return new StripeSdk(getEnv("STRIPE_SECRET_KEY") as string);
}

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= db()`
    CREATE TABLE IF NOT EXISTS equidy_subscriptions (
      user_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      subscription_id TEXT,
      status TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.then(() => undefined).catch((e) => { table = null; throw e; });
  return table;
}

interface SubscriptionRow { customer_id: string; subscription_id: string | null; status: string }

async function findSubscription(userId: string): Promise<SubscriptionRow | null> {
  await ensureTable();
  const rows = (await db()`SELECT customer_id, subscription_id, status FROM equidy_subscriptions WHERE user_id = ${userId}`) as SubscriptionRow[];
  return rows[0] ?? null;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/** Applies one verified Stripe event to the database. */
export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customer = idOf(session.customer);
    if (!session.client_reference_id || !customer) return;
    await ensureTable();
    await db()`
      INSERT INTO equidy_subscriptions (user_id, customer_id, subscription_id, status, updated_at)
      VALUES (${session.client_reference_id}, ${customer}, ${idOf(session.subscription)}, 'active', now())
      ON CONFLICT (user_id) DO UPDATE SET customer_id = EXCLUDED.customer_id, subscription_id = EXCLUDED.subscription_id, status = 'active', updated_at = now()`;
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
    await ensureTable();
    await db()`UPDATE equidy_subscriptions SET subscription_id = ${subscription.id}, status = ${status}, updated_at = now() WHERE customer_id = ${idOf(subscription.customer)}`;
  }
}

/** Stripe's signature check needs the untouched body, so this is registered before the JSON parser. */
export async function billingWebhook(req: Request, res: Response) {
  if (!billingEnabled()) return void res.status(503).json({ error: "Billing isn't set up on this server." });
  let event: Stripe.Event;
  try {
    const stripe = await stripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, String(req.headers["stripe-signature"] ?? ""), getEnv("STRIPE_WEBHOOK_SECRET") as string);
  } catch {
    return void res.status(400).json({ error: "Invalid signature." });
  }
  try {
    await applyStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error("[equidy] Stripe webhook failed:", err);
    await reportError(err, "POST /api/billing/webhook");
    res.status(500).json({ error: "Webhook failed." }); // Stripe retries it
  }
}

/** Ends billing when someone deletes their account. Throws on failure so they are never charged afterwards. */
export async function cancelBillingFor(userId: string): Promise<void> {
  if (!billingEnabled()) return;
  const row = await findSubscription(userId);
  if (!row) return;
  if (row.subscription_id && !["canceled", "incomplete_expired"].includes(row.status)) {
    const stripe = await stripeClient();
    await stripe.subscriptions.cancel(row.subscription_id);
  }
  await db()`DELETE FROM equidy_subscriptions WHERE user_id = ${userId}`;
}

export const billingRouter = express.Router();
const sessionUser = (res: Response) => res.locals.user as SessionUser;
// auth.ts also imports this file, so requireUser is looked up per request rather than while loading.
const signedIn = (req: Request, res: Response, next: NextFunction) => requireUser(req, res, next);

function failed(res: Response, err: unknown, where: string) {
  console.error(`[equidy] ${where} failed:`, err);
  void reportError(err, where);
  res.status(500).json({ error: "We couldn't reach billing. Please try again." });
}

billingRouter.get("/status", signedIn, async (_req, res) => {
  if (!billingEnabled()) return void res.json({ enabled: false, status: null });
  try {
    const row = await findSubscription(sessionUser(res).id);
    res.json({ enabled: true, status: row?.status ?? null });
  } catch (err) {
    failed(res, err, "GET /api/billing/status");
  }
});

billingRouter.post("/checkout", signedIn, async (_req, res) => {
  if (!billingEnabled()) return void res.status(503).json({ error: "Billing isn't set up on this server." });
  try {
    const user = sessionUser(res);
    const existing = await findSubscription(user.id);
    const stripe = await stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: getEnv("STRIPE_PRICE_ID") as string, quantity: 1 }],
      client_reference_id: user.id,
      ...(existing ? { customer: existing.customer_id } : user.email ? { customer_email: user.email } : {}),
      success_url: `${appUrl()}/settings?billing=success`,
      cancel_url: `${appUrl()}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    failed(res, err, "POST /api/billing/checkout");
  }
});

billingRouter.post("/portal", signedIn, async (_req, res) => {
  if (!billingEnabled()) return void res.status(503).json({ error: "Billing isn't set up on this server." });
  try {
    const row = await findSubscription(sessionUser(res).id);
    if (!row) return void res.status(404).json({ error: "No subscription found." });
    const stripe = await stripeClient();
    const portal = await stripe.billingPortal.sessions.create({ customer: row.customer_id, return_url: `${appUrl()}/settings` });
    res.json({ url: portal.url });
  } catch (err) {
    failed(res, err, "POST /api/billing/portal");
  }
});
