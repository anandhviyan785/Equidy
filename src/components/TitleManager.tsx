import { useEffect } from "react";
import { Outlet, useLocation, useMatches } from "react-router-dom";
import { canonicalUrl, pageTitle } from "@/lib/seo";

function setCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Sets document.title from the deepest matched route's `handle.title`, and the canonical URL from the path. */
export function TitleManager() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean);
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
  useEffect(() => {
    setCanonical(canonicalUrl(pathname));
  }, [pathname]);
  return <Outlet />;
}
