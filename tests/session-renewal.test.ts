import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const SECRET = "renewal-test-secret";
const DAY_MS = 86_400_000;
const user = { id: "email:abc", provider: "email", name: "Ada", email: "ada@example.com", avatar: null };

/** Builds a signed session cookie that expires `daysLeft` days from now, the way the server signs them. */
function cookieWithDaysLeft(daysLeft: number) {
  const body = Buffer.from(JSON.stringify({ user, exp: Date.now() + daysLeft * DAY_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `equidy_session=${body}.${sig}`;
}

const expiryOf = (setCookie: string) => {
  const value = decodeURIComponent(setCookie.split(";")[0].split("=")[1]);
  return (JSON.parse(Buffer.from(value.split(".")[0], "base64url").toString()) as { exp: number }).exp;
};

let server: Server;
let base = "";

beforeAll(async () => {
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "VERCEL"]) delete process.env[k];
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = SECRET;
  const { app } = await import("../server/app.js");
  server = app.listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const session = (cookie: string) => fetch(`${base}/api/auth/session`, { headers: { cookie } });

describe("session renewal", () => {
  it("extends a returning user's session to a full 30 days", async () => {
    const res = await session(cookieWithDaysLeft(10));
    expect((await res.json()).user).toMatchObject({ id: "email:abc" });
    const renewed = res.headers.get("set-cookie");
    expect(renewed).toContain("equidy_session=");
    expect(renewed).toContain(`Max-Age=${30 * 86_400}`);
    expect(expiryOf(renewed!)).toBeGreaterThan(Date.now() + 29 * DAY_MS);
  });

  it("leaves a session issued today alone", async () => {
    const res = await session(cookieWithDaysLeft(30));
    expect((await res.json()).user).not.toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("does not revive an expired session", async () => {
    const res = await session(cookieWithDaysLeft(-1));
    expect((await res.json()).user).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
