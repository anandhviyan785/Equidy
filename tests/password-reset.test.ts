import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Captures reset emails instead of sending them.
const sent: { to: string; link: string }[] = [];
vi.mock("../server/email.js", () => ({
  emailEnabled: () => true,
  sendWelcomeEmail: async () => undefined,
  sendPasswordResetEmail: async (to: string, link: string) => { sent.push({ to, link }); return true; },
}));

const originalCwd = process.cwd();
let dir = "";
let server: Server;
let base = "";

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "equidy-reset-"));
  process.chdir(dir);
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "VERCEL"]) delete process.env[k];
  process.env.EQUIDY_DEV_ACCOUNTS = "1";
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret";
  const { app } = await import("../server/app.js");
  server = app.listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  process.chdir(originalCwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (p: string, body: object) =>
  fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const tokenFrom = (link: string) => new URL(link).searchParams.get("token") ?? "";

describe("password reset", () => {
  it("reports that password reset is available", async () => {
    const j = await (await fetch(base + "/api/auth/session")).json();
    expect(j.passwordReset).toBe(true);
  });

  it("answers the same way for unknown emails and sends nothing", async () => {
    const res = await post("/api/auth/forgot", { email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("rejects an invalid email address", async () => {
    expect((await post("/api/auth/forgot", { email: "not-an-email" })).status).toBe(400);
  });

  it("emails a single-use link that sets a new password and signs the user in", async () => {
    await post("/api/auth/signup", { name: "Ada", email: "ada@example.com", password: "old password" });
    expect((await post("/api/auth/forgot", { email: "ADA@example.com" })).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ada@example.com");
    expect(sent[0].link).toContain("/reset-password?token=");
    const token = tokenFrom(sent[0].link);

    expect((await post("/api/auth/reset", { token, password: "short" })).status).toBe(400);

    const res = await post("/api/auth/reset", { token, password: "new password 1" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("equidy_session=");
    expect((await res.json()).user).toMatchObject({ email: "ada@example.com", provider: "email" });

    expect((await post("/api/auth/signin", { email: "ada@example.com", password: "old password" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: "ada@example.com", password: "new password 1" })).status).toBe(200);

    // The same link cannot be used twice.
    expect((await post("/api/auth/reset", { token, password: "another pass 2" })).status).toBe(400);
  });

  it("rejects made-up tokens", async () => {
    expect((await post("/api/auth/reset", { token: "made-up-token", password: "new password 1" })).status).toBe(400);
    expect((await post("/api/auth/reset", { password: "new password 1" })).status).toBe(400);
  });
});
