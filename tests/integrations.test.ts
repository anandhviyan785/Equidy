import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, opaqueUserId } from "../server/secrets";
import { mapAccount, mapHoldings, mapTransaction } from "../server/plaid";
import { intelToText, parseMetrics, parseNews } from "../server/finnhub";
import { parseUserData } from "../server/userdata";
import { mergeHistory } from "../src/lib/market";

process.env.SESSION_SECRET = "test-secret";

describe("token encryption", () => {
  it("round-trips and rejects tampering", () => {
    const sealed = encryptSecret("access-sandbox-123");
    expect(sealed).not.toContain("access-sandbox");
    expect(decryptSecret(sealed)).toBe("access-sandbox-123");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("gives Plaid an opaque user id", () => {
    expect(opaqueUserId("sb:abc")).toMatch(/^[0-9a-f]{40}$/);
    expect(opaqueUserId("sb:abc")).not.toBe(opaqueUserId("sb:abd"));
  });
});

describe("Plaid mapping", () => {
  it("maps accounts, transactions and holdings", () => {
    expect(mapAccount({ account_id: "a1", name: "Checking", mask: "0000", type: "depository", subtype: "checking", balances: { current: 110, available: 100, iso_currency_code: "USD" } })).toEqual({
      id: "a1", name: "Checking", mask: "0000", type: "depository", subtype: "checking", current: 110, available: 100, currency: "USD",
    });
    const t = mapTransaction({ transaction_id: "t1", account_id: "a1", date: "2026-11-01", name: "UBER 123", merchant_name: "Uber", amount: 12.5, iso_currency_code: "USD", pending: false, personal_finance_category: { primary: "TRANSPORTATION" } });
    expect(t).toMatchObject({ name: "Uber", category: "transportation", amount: 12.5 });
    const h = mapHoldings(
      [{ security_id: "s1", quantity: 3, cost_basis: 300, institution_price: 120, institution_value: 360, iso_currency_code: "USD" }],
      [{ security_id: "s1", ticker_symbol: "aapl", name: "Apple Inc.", type: "equity" }],
    );
    expect(h[0]).toMatchObject({ ticker: "AAPL", quantity: 3, costBasis: 300, value: 360 });
  });
});

describe("Finnhub parsing", () => {
  it("keeps valid news and known metrics", () => {
    const news = parseNews([{ headline: "Up", url: "https://x.y/1", source: "Reuters", datetime: 1_800_000_000 }, { headline: "", url: "https://x" }, { headline: "bad url", url: "javascript:alert(1)" }], 5);
    expect(news).toHaveLength(1);
    expect(news[0].datetime).toBe(1_800_000_000_000);
    expect(parseMetrics({ metric: { peTTM: 30.1, beta: null, unknown: 3 } })).toEqual({ peTTM: 30.1 });
    const text = intelToText({ symbol: "AAPL", profile: null, metrics: { peTTM: 30 }, recommendation: { period: "2026-11-01", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 }, earnings: [], peers: ["MSFT"], news, asOf: 0 });
    expect(text).toContain("P/E (TTM) 30.00");
    expect(text).toContain("strong buy 10");
    expect(text).toContain("Peers: MSFT");
  });
});

describe("cloud sync documents", () => {
  it("normalises and bounds what the browser sends", () => {
    const d = parseUserData({ portfolio: { holdings: [{ symbol: "AAPL" }, 5], watchlist: ["TSLA", 3] }, chats: [{ id: "c" }, "x"], settings: { theme: "dark" }, updatedAt: 7 });
    expect(d).toEqual({ portfolio: { holdings: [{ symbol: "AAPL" }], watchlist: ["TSLA"] }, chats: [{ id: "c" }], settings: { theme: "dark" }, updatedAt: 7 });
    expect(() => parseUserData("nope")).toThrow();
  });
});

describe("history merge", () => {
  it("joins real bars onto a rescaled simulated prefix with the requested length", () => {
    const sim = Array.from({ length: 10 }, (_, i) => ({ t: i, close: 100 + i }));
    const real = [{ t: 1000, close: 50 }, { t: 2000, close: 51 }, { t: 3000, close: 52 }];
    const m = mergeHistory(sim, real, 10);
    expect(m).toHaveLength(10);
    expect(m.slice(-3)).toEqual(real);
    expect(m[6].close).toBeCloseTo(106 * (50 / 107)); // scaled so sim[7] would meet the first real close
    expect(m[6].t).toBeLessThan(1000);
    expect(mergeHistory(sim, real, 2)).toEqual(real.slice(-2));
  });
});
