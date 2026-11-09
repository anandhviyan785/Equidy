import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "equidy-dev-accounts-"));
  process.chdir(dir);
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "VERCEL"]) delete process.env[k];
  process.env.EQUIDY_DEV_ACCOUNTS = "1";
  process.env.NODE_ENV = "test";
});
afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("local file-backed accounts", () => {
  it("is enabled only when opted in and not in production", async () => {
    const { accountsEnabled } = await import("../server/accounts");
    expect(accountsEnabled()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(accountsEnabled()).toBe(false);
    process.env.NODE_ENV = "test";
    delete process.env.EQUIDY_DEV_ACCOUNTS;
    expect(accountsEnabled()).toBe(false);
    process.env.EQUIDY_DEV_ACCOUNTS = "1";
  });

  it("creates an account, signs in, and never stores the plain password", async () => {
    const { createAccount, verifyAccount } = await import("../server/accounts");
    const created = await createAccount({ name: "Ada", email: "Ada@Example.com", password: "correct horse" });
    expect(created.email).toBe("ada@example.com");
    const again = await verifyAccount({ email: "ada@example.com", password: "correct horse" });
    expect(again.id).toBe(created.id);
    expect(fs.readFileSync(path.join(dir, ".data", "accounts.json"), "utf8")).not.toContain("correct horse");
  });

  it("rejects duplicate emails and wrong passwords", async () => {
    const { createAccount, verifyAccount } = await import("../server/accounts");
    await expect(createAccount({ name: "Ada 2", email: "ada@example.com", password: "another pass" })).rejects.toMatchObject({ status: 409 });
    await expect(verifyAccount({ email: "ada@example.com", password: "wrong password" })).rejects.toMatchObject({ status: 401 });
    await expect(verifyAccount({ email: "nobody@example.com", password: "whatever12" })).rejects.toMatchObject({ status: 401 });
  });

  it("deletes an account", async () => {
    const { createAccount, deleteAccount, verifyAccount } = await import("../server/accounts");
    const { id } = await createAccount({ name: "Bo", email: "bo@example.com", password: "password123" });
    await deleteAccount(id);
    await expect(verifyAccount({ email: "bo@example.com", password: "password123" })).rejects.toMatchObject({ status: 401 });
  });
});
