import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { canonicalUrl, pageTitle, SITE_URL } from "../src/lib/seo";

describe("canonicalUrl", () => {
  it("points every path at the www domain", () => {
    expect(canonicalUrl("/")).toBe(`${SITE_URL}/`);
    expect(canonicalUrl("/privacy")).toBe(`${SITE_URL}/privacy`);
  });

  it("drops trailing slashes and maps duplicate routes to one URL", () => {
    expect(canonicalUrl("/terms/")).toBe(`${SITE_URL}/terms`);
    expect(canonicalUrl("/welcome")).toBe(`${SITE_URL}/`);
  });
});

describe("pageTitle", () => {
  it("uses a descriptive title on the home page and suffixes the rest", () => {
    expect(pageTitle(undefined)).toMatch(/^Equidy – /);
    expect(pageTitle("Markets")).toBe("Markets · Equidy");
  });
});

describe("crawler files", () => {
  it("robots.txt and sitemap.xml use the same site URL", () => {
    expect(fs.readFileSync("public/robots.txt", "utf8")).toContain(`${SITE_URL}/sitemap.xml`);
    const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
    for (const loc of sitemap.match(/<loc>[^<]+<\/loc>/g) ?? []) expect(loc).toContain(SITE_URL);
  });

  it("index.html has a valid JSON-LD block", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(() => JSON.parse(json ?? "")).not.toThrow();
  });
});
