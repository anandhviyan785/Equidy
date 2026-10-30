import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// In-memory stand-in for the Postgres HTTP driver, covering the three queries accounts.ts runs.
vi.mock("@neondatabase/serverless", () => {
  const users: Record<string, unknown>[] = [];
  return {
    neon: () => async (strings: TemplateStringsArray, ...v: unknown[]) => {
      const q = strings.join("?");
      if (q.includes("CREATE TABLE")) return [];
      if (q.includes("INSERT INTO")) {
        if (users.some((u) => u.email === v[1])) return [];
        const row = { id: v[0], email: v[1], name: v[2], password_hash: v[3] };
        users.push(row);
        return [{ id: row.id, email: row.email, name: row.name }];
      }
      if (q.includes("SELECT")) return users.filter((u) => u.email === v[0]);
      throw new Error("unexpected query " + q);
    },
  };
});

let server: Server;
let base = "";

beforeAll(async () => {
  process.env.DATABASE_URL = "postgres://test";
  process.env.SESSION_SECRET = "test-secret";
  const { app } = await import("../server/app.js");
  server = app.listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const post = (path: string, body: object, cookie = "") =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });

describe("email accounts", () => {
  it("reports accounts as enabled", async () => {
    const j = await (await fetch(base + "/api/auth/session")).json();
    expect(j.accounts).toBe(true);
    expect(j.user).toBeNull();
  });

  it("validates input", async () => {
    expect((await post("/api/auth/signup", { name: "A", email: "bad", password: "longenough" })).status).toBe(400);
    expect((await post("/api/auth/signup", { name: "A", email: "a@b.co", password: "short" })).status).toBe(400);
  });

  it("signs up, rejects duplicates, signs in and keeps a session", async () => {
    const res = await post("/api/auth/signup", { name: "Ada", email: "Ada@Example.com", password: "correct horse" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    expect((await res.json()).user).toMatchObject({ name: "Ada", email: "ada@example.com", provider: "email" });

    expect((await post("/api/auth/signup", { name: "Ada", email: "ada@example.com", password: "another one" })).status).toBe(409);
    expect((await post("/api/auth/signin", { email: "ada@example.com", password: "wrong password" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: "nobody@example.com", password: "whatever1" })).status).toBe(401);

    const ok = await post("/api/auth/signin", { email: "ADA@example.com ", password: "correct horse" });
    expect(ok.status).toBe(200);

    const session = await (await fetch(base + "/api/auth/session", { headers: { cookie } })).json();
    expect(session.user.email).toBe("ada@example.com");
  });

  it("requires sign-in for chat once accounts are enabled", async () => {
    expect((await post("/api/chat", { messages: [{ role: "user", content: "hi" }] })).status).toBe(401);
  });

  it("stores only a salted hash", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("x") as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<{ password_hash: string }[]>;
    const rows = await sql(Object.assign(["SELECT ", ""], { raw: [] }) as unknown as TemplateStringsArray, "ada@example.com");
    expect(rows[0].password_hash).toMatch(/^scrypt:/);
    expect(rows[0].password_hash).not.toContain("correct horse");
  });
});
