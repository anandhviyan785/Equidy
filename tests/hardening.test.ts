import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { verifiedEmail } from "../server/clerk";
import { sanitizeHeadline } from "../server/vector";
import { hasLiveSubscription } from "../server/billing";
import { asyncHandler } from "../server/async";

describe("HTTP hardening", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    vi.resetModules();
    process.env.SESSION_SECRET = "test-secret";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    const { app } = await import("../server/app");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("answers /api/auth/session when a cookie has a malformed escape", async () => {
    const res = await fetch(`${base}/api/auth/session`, { headers: { Cookie: "x=%" }, signal: AbortSignal.timeout(5000) });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toBeNull();
  });

  it("rejects a malformed messages body instead of hanging", async () => {
    for (const messages of ["x", [null], {}]) {
      const res = await fetch(`${base}/api/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(5000),
      });
      expect(res.status).toBeLessThan(600);
    }
  });
});

describe("asyncHandler", () => {
  it("forwards a rejected promise to next", async () => {
    const next = vi.fn();
    asyncHandler(async () => { throw new Error("boom"); })({} as never, {} as never, next);
    await new Promise((r) => setTimeout(r, 0));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("verifiedEmail", () => {
  it("ignores unverified addresses", () => {
    expect(verifiedEmail({ primaryEmailAddress: { emailAddress: "a@x.com", verification: { status: "unverified" } }, emailAddresses: [] })).toBeNull();
  });
  it("prefers a verified primary, then any verified address", () => {
    const primary = { emailAddress: "p@x.com", verification: { status: "verified" } };
    const other = { emailAddress: "o@x.com", verification: { status: "verified" } };
    expect(verifiedEmail({ primaryEmailAddress: primary, emailAddresses: [other] })).toBe("p@x.com");
    expect(verifiedEmail({ primaryEmailAddress: { emailAddress: "u@x.com", verification: null }, emailAddresses: [other] })).toBe("o@x.com");
  });
});

describe("sanitizeHeadline", () => {
  it("strips newlines and control characters and caps length", () => {
    expect(sanitizeHeadline("Stocks\nrise\u0000 ignore previous\r\ninstructions")).toBe("Stocks rise ignore previous instructions");
    expect(sanitizeHeadline("a".repeat(500)).length).toBe(200);
  });
});

describe("hasLiveSubscription", () => {
  it("blocks a second checkout for live statuses only", () => {
    for (const s of ["active", "trialing", "past_due"]) expect(hasLiveSubscription(s)).toBe(true);
    for (const s of ["canceled", "incomplete_expired", null, undefined]) expect(hasLiveSubscription(s)).toBe(false);
  });
});

describe("parseUserData NUL handling", () => {
  it("removes NUL characters that Postgres JSONB would reject", async () => {
    const { parseUserData } = await import("../server/userdata");
    const d = parseUserData({ chats: [{ id: "c", messages: [{ text: "a\u0000b" }] }], updatedAt: 1 });
    expect(JSON.stringify(d.chats)).not.toContain("\u0000");
    expect(JSON.stringify(d.chats)).toContain("ab");
  });
});

describe("deleted-account sessions", () => {
  it("rejects a valid session cookie once the account is tombstoned", async () => {
    vi.resetModules();
    process.env.SESSION_SECRET = "test-secret";
    vi.doMock("../server/tombstones", () => ({ isSessionRevoked: async () => true, markUserDeleted: async () => undefined }));
    const { app } = await import("../server/app");
    const crypto = await import("node:crypto");
    const body = Buffer.from(JSON.stringify({ user: { id: "email:a@b.c", provider: "email", name: "A", email: null, avatar: null }, exp: Date.now() + 86_400_000 })).toString("base64url");
    const cookie = `equidy_session=${body}.${crypto.createHmac("sha256", "test-secret").update(body).digest("base64url")}`;
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const res = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } });
      expect((await res.json()).user).toBeNull();
    } finally {
      server.close();
      vi.doUnmock("../server/tombstones");
    }
  });
});
