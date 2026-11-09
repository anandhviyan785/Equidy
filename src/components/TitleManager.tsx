import { useEffect } from "react";
import { Outlet, useMatches } from "react-router-dom";

const SITE = "Equidy";

/** Sets document.title from the deepest matched route's `handle.title`. */
export function TitleManager() {
  const matches = useMatches();
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean);
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
  return <Outlet />;
}
