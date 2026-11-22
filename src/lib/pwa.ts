// Installable app support: platform detection, the browser's install prompt, and service worker registration.

export type Platform = "ios" | "android" | "desktop";
export type InstallMode = "installed" | "prompt" | "ios-guide" | "manual";

/** iPads report a desktop Mac user agent, so touch support is what tells them apart from a real Mac. */
export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** True when Equidy is running as an installed app rather than in a browser tab. */
export function isStandalone(displayModeStandalone: boolean, iosStandalone: boolean | undefined): boolean {
  return displayModeStandalone || iosStandalone === true;
}

export function installMode({ platform, standalone, canPrompt }: { platform: Platform; standalone: boolean; canPrompt: boolean }): InstallMode {
  if (standalone) return "installed";
  if (canPrompt) return "prompt";
  if (platform === "ios") return "ios-guide";
  return "manual";
}

/** Only production web builds get a service worker: dev would serve stale code, and the single-file build is embedded. */
export function shouldRegisterServiceWorker({ supported, prod, mode }: { supported: boolean; prod: boolean; mode: string }): boolean {
  return supported && prod && mode !== "single";
}

/** The `beforeinstallprompt` event, which TypeScript's DOM types do not include yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const canPromptInstall = () => deferredPrompt !== null;

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Must run at startup: browsers fire `beforeinstallprompt` once, often before React mounts. */
export function listenForInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

/** Shows the browser's own install dialog. Returns whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

export function currentPlatform(): Platform {
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

export function runningStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone(window.matchMedia("(display-mode: standalone)").matches, iosStandalone);
}

export function registerServiceWorker(): void {
  const enabled = shouldRegisterServiceWorker({ supported: "serviceWorker" in navigator, prod: import.meta.env.PROD, mode: import.meta.env.MODE });
  if (!enabled) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[equidy] service worker registration failed:", err);
    });
  });
}
