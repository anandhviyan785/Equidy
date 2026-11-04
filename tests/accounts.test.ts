import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountErrorFrom, createAccount, rateLimit, validate, verifyAccount } from "../server/accounts";
import { describeUser } from "../server/supabase";
import { UpstreamError } from "../server/http";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.SUPABASE_URL = "https://proj.supabase.co";
  process.env.SUPABASE_ANON_KEY = "sb_publishable_test";
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("email accounts (Supabase Auth)", () => {
  it("validates input before calling Supabase", () => {
    expect(() => validate({ name: "A", email: "bad", password: "longenough" }, true)).toThrow("valid email");
    expect(() => validate({ name: "A", email: "a@b.co", password: "short" }, true)).toThrow("8 characters");
    expect(() => validate({ email: "a@b.co", password: "x" }, true)).toThrow();
    expect(validate({ email: " A@B.CO ", password: "x" }, false).email).toBe("a@b.co");
  });

  it("signs up and returns the account when Supabase issues a session", async () => {
    fetchMock.mockResolvedValue(json({ access_token: "jwt", user: { id: "u1", email: "a@b.co", user_metadata: { name: "Ada" } } }));
    const r = await createAccount({ name: "Ada", email: "a@b.co", password: "longenough" });
    expect(r).toEqual({ account: { id: "u1", email: "a@b.co", name: "Ada" }, pending: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/proj\.supabase\.co\/auth\/v1\/signup\?redirect_to=/);
    expect(init.headers.apikey).toBe("sb_publishable_test");
    expect(JSON.parse(init.body)).toMatchObject({ email: "a@b.co", password: "longenough", data: { name: "Ada" } });
  });

  it("reports pending when email confirmation is required", async () => {
    fetchMock.mockResolvedValue(json({ id: "u1", email: "a@b.co", confirmation_sent_at: "2026-11-04" }));
    expect(await createAccount({ name: "Ada", email: "a@b.co", password: "longenough" })).toEqual({ account: null, pending: true });
  });

  it("maps Supabase errors to friendly messages", async () => {
    fetchMock.mockResolvedValue(json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400));
    const err = await verifyAccount({ email: "a@b.co", password: "wrongpass" }).catch((e) => e);
    expect(err.message).toBe("Incorrect email or password.");
    expect(err.status).toBe(401);
    expect(accountErrorFrom(new UpstreamError("Supabase", "x", 422, "user_already_exists")).status).toBe(409);
    expect(accountErrorFrom(new UpstreamError("Supabase", "Email not confirmed", 400, "email_not_confirmed")).status).toBe(403);
    expect(accountErrorFrom(new UpstreamError("Supabase", "x", 429)).status).toBe(429);
  });

  it("refuses when Supabase isn't configured", async () => {
    delete process.env.SUPABASE_URL;
    const err = await verifyAccount({ email: "a@b.co", password: "whatever1" }).catch((e) => e);
    expect(err.status).toBe(503);
  });

  it("describes OAuth users with their provider", () => {
    expect(describeUser({ id: "1", email: "x@y.z", app_metadata: { provider: "azure" }, user_metadata: { full_name: "Grace", avatar_url: "https://a/b.png" } })).toEqual({
      name: "Grace",
      email: "x@y.z",
      avatar: "https://a/b.png",
      provider: "microsoft",
    });
  });

  it("rate-limits repeated attempts", () => {
    for (let i = 0; i < 3; i++) rateLimit("test-key", 3);
    expect(() => rateLimit("test-key", 3)).toThrow("Too many attempts");
  });
});
