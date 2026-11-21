import { describe, expect, it } from "vitest";
import { validateAuthForm } from "@/lib/authValidation";
import { linkOAuthUser } from "../server/oauthLink";

describe("validateAuthForm", () => {
  it("accepts a complete sign-up", () => {
    expect(validateAuthForm({ mode: "signup", name: "Ada", email: "ada@example.com", password: "12345678" })).toEqual({});
  });

  it("flags each missing or invalid field on sign-up", () => {
    expect(validateAuthForm({ mode: "signup", name: " ", email: "ada@", password: "short" })).toEqual({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 8 characters.",
    });
  });

  it("only needs an email and a password to sign in", () => {
    expect(validateAuthForm({ mode: "signin", name: "", email: "ada@example.com", password: "x" })).toEqual({});
    expect(validateAuthForm({ mode: "signin", name: "", email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  it("only needs an email to request a reset link", () => {
    expect(validateAuthForm({ mode: "forgot", name: "", email: "ada@example.com", password: "" })).toEqual({});
    expect(validateAuthForm({ mode: "forgot", name: "", email: "nope", password: "" })).toEqual({ email: "Enter a valid email address." });
  });
});

describe("linkOAuthUser", () => {
  const google = { id: "google:123", provider: "google" as const, name: "Ada G", email: "Ada@Example.com", avatar: "https://img" };
  const account = { id: "abc", email: "ada@example.com", name: "Ada" };

  it("signs a verified Google email into the existing email account", async () => {
    const user = await linkOAuthUser(google, true, async (e) => (e === "ada@example.com" ? account : null));
    expect(user).toEqual({ id: "email:abc", provider: "email", name: "Ada", email: "ada@example.com", avatar: "https://img" });
  });

  it("keeps the Google identity when the email is unverified or has no account", async () => {
    expect(await linkOAuthUser(google, false, async () => account)).toBe(google);
    expect(await linkOAuthUser(google, true, async () => null)).toBe(google);
  });

  it("keeps the Google identity when the account lookup fails", async () => {
    expect(await linkOAuthUser(google, true, async () => { throw new Error("db down"); })).toBe(google);
  });

  it("secures the existing account before linking it", async () => {
    const calls: string[] = [];
    const user = await linkOAuthUser(google, true, async () => account, async (a) => { calls.push(a.id); });
    expect(calls).toEqual(["abc"]);
    expect(user.id).toBe("email:abc");
  });

  it("does not link when securing the account fails", async () => {
    expect(await linkOAuthUser(google, true, async () => account, async () => { throw new Error("db down"); })).toBe(google);
  });
});
