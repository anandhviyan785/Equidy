import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { scrubEvent } from "../server/monitoring";
import { sslOptions, toStatement, usesStandardPostgres } from "../server/db";

describe("sslOptions", () => {
  it("always verifies certificates and uses the provided CA", () => {
    expect(sslOptions(undefined)).toEqual({ rejectUnauthorized: true });
    expect(sslOptions("A\\nB")).toEqual({ ca: "A\nB", rejectUnauthorized: true });
  });
});
import { welcomeEmail } from "../server/email";
import { relevantHeadlines } from "../server/vector";
import { shouldAdoptLocalData } from "../src/lib/adopt";

const exec = vi.fn();
const pipeline = { incr: vi.fn(), pexpire: vi.fn(), exec };
vi.mock("@upstash/redis", () => ({
  Redis: class {
    pipeline = () => pipeline;
  },
}));

const SERVICE_KEYS = [
  "DATABASE_URL", "POSTGRES_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID", "CLERK_SECRET_KEY", "PINECONE_API_KEY", "PINECONE_INDEX", "SENTRY_DSN",
];

beforeEach(() => {
  for (const key of SERVICE_KEYS) delete process.env[key];
  exec.mockReset();
});

describe("error report scrubbing", () => {
  it("removes identities, request bodies, cookies and query strings", () => {
    const event = scrubEvent({
      user: { email: "a@b.com" },
      extra: { chat: "my portfolio" },
      breadcrumbs: [{ message: "typed text" }],
      request: { url: "https://x.test/api/chat?token=abc", data: "secret", cookies: "session", headers: { cookie: "session" }, query_string: "token=abc" },
    });
    expect(event).toEqual({ request: { url: "https://x.test/api/chat" } });
  });

  it("redacts email addresses and shortens error messages", () => {
    const event = scrubEvent({ exception: { values: [{ value: `failed for person@example.com ${"x".repeat(500)}` }] } });
    const value = event.exception?.values?.[0].value ?? "";
    expect(value).toContain("[email]");
    expect(value).not.toContain("person@example.com");
    expect(value.length).toBeLessThanOrEqual(300);
  });
});

describe("database driver selection", () => {
  it("uses standard Postgres for Supabase only", () => {
    expect(usesStandardPostgres("postgres://u:p@aws-0-us.pooler.supabase.com:6543/postgres")).toBe(true);
    expect(usesStandardPostgres("postgres://u:p@db.abc.supabase.co:5432/postgres")).toBe(true);
    expect(usesStandardPostgres("postgres://u:p@ep-1.us-east-2.aws.neon.tech/db")).toBe(false);
  });

  it("builds numbered parameters from a tagged template", () => {
    const tag = (s: TemplateStringsArray, ..._values: unknown[]) => toStatement(s);
    expect(tag`SELECT * FROM t WHERE a = ${1} AND b = ${2}`).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(tag`SELECT 1`).toBe("SELECT 1");
  });
});

describe("moving saved data to a Clerk account", () => {
  const clerkUser = { id: "clerk:1", provider: "clerk", email: "Sam@Example.com" };

  it("carries data over when the email matches", () => {
    expect(shouldAdoptLocalData("google:9", clerkUser, "sam@example.com")).toBe(true);
  });

  it("refuses a different email, so a shared computer keeps data private", () => {
    expect(shouldAdoptLocalData("google:9", clerkUser, "other@example.com")).toBe(false);
  });

  it("ignores demo data, other Clerk accounts and non-Clerk sign-ins", () => {
    expect(shouldAdoptLocalData("demo", clerkUser, "sam@example.com")).toBe(false);
    expect(shouldAdoptLocalData("clerk:2", clerkUser, "sam@example.com")).toBe(false);
    expect(shouldAdoptLocalData("google:9", { ...clerkUser, provider: "google" }, "sam@example.com")).toBe(false);
    expect(shouldAdoptLocalData(null, clerkUser, "sam@example.com")).toBe(false);
  });
});

describe("shared rate limits", () => {
  const useRedis = () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  };

  it("blocks once the shared count passes the limit", async () => {
    useRedis();
    const { rateLimit } = await import("../server/accounts");
    exec.mockResolvedValueOnce([2, 1]);
    await expect(rateLimit("shared:allowed", 2)).resolves.toBeUndefined();
    exec.mockResolvedValueOnce([3, 0]);
    await expect(rateLimit("shared:blocked", 2)).rejects.toMatchObject({ status: 429 });
  });

  it("falls back to memory when Redis fails, and still limits", async () => {
    useRedis();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rateLimit } = await import("../server/accounts");
    exec.mockRejectedValue(new Error("down"));
    await expect(rateLimit("fallback:key", 1)).resolves.toBeUndefined();
    await expect(rateLimit("fallback:key", 1)).rejects.toMatchObject({ status: 429 });
    warn.mockRestore();
  });

  it("works from memory with no Redis configured", async () => {
    const { rateLimit } = await import("../server/accounts");
    await expect(rateLimit("memory:key", 1)).resolves.toBeUndefined();
    await expect(rateLimit("memory:key", 1)).rejects.toMatchObject({ status: 429 });
    expect(exec).not.toHaveBeenCalled();
  });
});

describe("email and news search when switched off", () => {
  it("escapes names in the welcome email", () => {
    const mail = welcomeEmail("<b>Sam</b> Lee");
    expect(mail.html).toContain("&lt;b&gt;Sam&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Sam");
  });

  it("returns no headlines without Pinecone keys", async () => {
    await expect(relevantHeadlines("why did stocks fall?", [{ headline: "Stocks fall", source: "x", datetime: 0 }])).resolves.toBe("");
  });
});

describe("routes with services switched off", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = "test-secret";
    const { app } = await import("../server/app");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => vi.restoreAllMocks());

  it("refuses Stripe webhooks without crashing", async () => {
    const res = await fetch(`${base}/api/billing/webhook`, { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
  });

  it("requires sign-in for billing", async () => {
    expect((await fetch(`${base}/api/billing/status`)).status).toBe(401);
    expect((await fetch(`${base}/api/billing/checkout`, { method: "POST" })).status).toBe(401);
  });

  it("reports Clerk as off and rejects Clerk sign-in", async () => {
    const session = (await (await fetch(`${base}/api/auth/session`)).json()) as { clerk: boolean };
    expect(session.clerk).toBe(false);
    const res = await fetch(`${base}/api/auth/clerk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "x" }) });
    expect(res.status).toBe(404);
  });

  it("answers malformed JSON with a clean error", async () => {
    const res = await fetch(`${base}/api/title`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That request couldn't be processed." });
  });
});
