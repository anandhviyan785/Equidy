// Search-engine settings shared by index.html, the sitemap and TitleManager.

export const SITE_URL = "https://www.equidy.website";
export const SITE_NAME = "Equidy";
export const DEFAULT_TITLE = "Equidy – AI financial assistant for stocks, markets and your portfolio";

// Routes that show the same page as another one, so search engines index only one of them.
const ALIASES: Record<string, string> = { "/welcome": "/" };

/** The single public URL search engines should index for a path. */
export function canonicalUrl(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return SITE_URL + (ALIASES[clean] ?? clean);
}

export function pageTitle(title: string | undefined): string {
  return title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
}
