import { useEffect, useState } from "react";
import { useMarket, useSettings } from "@/store";
import { setCurrency } from "@/lib/format";

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** Applies the theme class to <html> and keeps it in sync with the OS when set to "system". */
export function useThemeSync() {
  const theme = useSettings((s) => s.theme);
  const currency = useSettings((s) => s.currency);
  setCurrency(currency);
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && systemDark());
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener("change", apply);
    return () => mq?.removeEventListener("change", apply);
  }, [theme]);
}

export function useIsDark() {
  const theme = useSettings((s) => s.theme);
  return theme === "dark" || (theme === "system" && systemDark());
}

/** Drives simulated live price ticks while the tab is visible. */
export function useLiveTicks() {
  const enabled = useSettings((s) => s.liveTicks);
  const tick = useMarket((s) => s.tick);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => document.visibilityState === "visible" && tick(), 2500);
    return () => clearInterval(id);
  }, [enabled, tick]);
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
