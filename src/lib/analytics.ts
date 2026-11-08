import type { PostHog } from "posthog-js";

// PostHog product analytics. Off unless VITE_POSTHOG_KEY is set, and only runs after someone accepts.
// Records page views only: no autocapture, no session recording, and no portfolio, chat or identity data.

const CONSENT_KEY = "equidy.analytics";
const posthogKey = () => import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const posthogHost = () => (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

export type Consent = "yes" | "no" | null;

export const analyticsAvailable = () => !!posthogKey();

export function getConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "yes" || value === "no" ? value : null;
  } catch {
    return null;
  }
}

/** Conversation IDs are removed so analytics can't link a page view to a chat. */
export const cleanPath = (path: string) => path.split(/[?#]/)[0].replace(/^\/c\/[^/]+/, "/c");

let client: Promise<PostHog | null> | null = null;

function loadClient(): Promise<PostHog | null> {
  const key = posthogKey();
  if (!key) return Promise.resolve(null);
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: posthogHost(),
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        person_profiles: "identified_only",
        before_send: (event) => {
          if (event?.properties) {
            for (const prop of ["$current_url", "$pathname", "$referrer", "$initial_current_url", "$initial_referrer"]) {
              const value = event.properties[prop];
              if (typeof value === "string") event.properties[prop] = value.split("?")[0].replace(/\/c\/[^/#]+/, "/c");
            }
          }
          return event;
        },
      });
      return posthog;
    })
    .catch(() => null);
  return client;
}

export function setConsent(choice: "yes" | "no") {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch { /* storage unavailable: applies to this visit only */ }
  if (choice === "yes") {
    void loadClient().then((posthog) => posthog?.opt_in_capturing());
  } else if (client) {
    void client.then((posthog) => { posthog?.opt_out_capturing(); posthog?.reset(); });
  }
}

export function trackPage(path: string) {
  if (!analyticsAvailable() || getConsent() !== "yes") return;
  void loadClient().then((posthog) => posthog?.capture("$pageview", { path: cleanPath(path) }));
}
