import { describe, expect, it } from "vitest";
import { cleanTitle, summarizeTitle, titleCase } from "@/lib/titles";

const chat = (...user: string[]) => user.flatMap((u) => [{ role: "user", content: u }, { role: "assistant", content: "…" }]);

describe("conversation titles", () => {
  it("capitalises every word but keeps existing capitals", () => {
    expect(titleCase("explain the sharpe ratio")).toBe("Explain The Sharpe Ratio");
    expect(titleCase("ETFs and index funds")).toBe("ETFs And Index Funds");
  });

  it("summarises the topic rather than echoing the message", () => {
    expect(summarizeTitle(chat("Analyze Apple's financial performance"))).toBe("Apple Financial Analysis");
    expect(summarizeTitle(chat("Compare Microsoft vs Alphabet"))).toBe("Microsoft Vs Alphabet");
    expect(summarizeTitle(chat("How risky is my portfolio?"))).toBe("Portfolio Risk Review");
    expect(summarizeTitle(chat("Analyze my investment portfolio"))).toBe("Portfolio Analysis");
    expect(summarizeTitle(chat("Explain how compound interest works"))).toBe("Compound Interest Explained");
    expect(summarizeTitle(chat("If I invest $10,000 at 7% for 20 years what do I get"))).toBe("Investment Growth Projection");
    expect(summarizeTitle(chat("explain the sharpe ratio"))).toBe("Sharpe Ratio Explained");
    expect(summarizeTitle(chat("What are the markets doing today?"))).toBe("Today's Market Overview");
    expect(summarizeTitle(chat("should i buy nvidia"))).toBe("Should I Invest In NVIDIA");
  });

  it("skips greetings and picks up the real topic later", () => {
    expect(summarizeTitle(chat("hi"))).toBe("Casual Chat");
    expect(summarizeTitle(chat("hey there", "thanks!"))).toBe("Casual Chat");
    expect(summarizeTitle(chat("hi", "tell me about tesla"))).toBe("Tesla Financial Analysis");
  });

  it("falls back to the key words, in Title Case", () => {
    expect(summarizeTitle(chat("best way to pay off student loans"))).toBe("Best Way Pay Off Student Loans");
  });

  it("cleans model-written titles", () => {
    expect(cleanTitle('"apple earnings deep dive."')).toBe("Apple Earnings Deep Dive");
    expect(cleanTitle("Title: tesla valuation\nextra")).toBe("Tesla Valuation");
  });
});
