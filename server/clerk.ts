import { appUrl, getEnv } from "./env.js";
import type { SessionUser } from "./auth.js";

// Clerk sign-in. Optional: needs CLERK_SECRET_KEY here and VITE_CLERK_PUBLISHABLE_KEY in the browser.
// The browser signs in with Clerk and sends its token once. After verifying it, Equidy starts its
// normal session cookie, so the rest of the server doesn't change.

const NEW_USER_WINDOW_MS = 5 * 60_000;

export const clerkEnabled = () => !!getEnv("CLERK_SECRET_KEY");

/** The site's address with and without www, the only pages allowed to send Clerk tokens here. */
function allowedOrigins(): string[] {
  const url = new URL(appUrl());
  const bare = url.hostname.replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  return [`${url.protocol}//${bare}${port}`, `${url.protocol}//www.${bare}${port}`];
}

export async function verifyClerkUser(token: string): Promise<{ user: SessionUser; isNew: boolean }> {
  const secretKey = getEnv("CLERK_SECRET_KEY");
  if (!secretKey) throw new Error("Clerk isn't configured.");
  const { createClerkClient, verifyToken } = await import("@clerk/backend");
  const claims = await verifyToken(token, { secretKey, authorizedParties: allowedOrigins() });
  const person = await createClerkClient({ secretKey }).users.getUser(claims.sub);
  const email = person.primaryEmailAddress?.emailAddress ?? person.emailAddresses[0]?.emailAddress ?? null;
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || email?.split("@")[0] || "Equidy user";
  return {
    user: { id: `clerk:${person.id}`, provider: "clerk", name, email, avatar: person.imageUrl ?? null },
    isNew: Date.now() - person.createdAt < NEW_USER_WINDOW_MS,
  };
}

/** Removes the person from Clerk when they delete their Equidy account. */
export async function deleteClerkUser(id: string): Promise<void> {
  const secretKey = getEnv("CLERK_SECRET_KEY");
  if (!secretKey) return;
  const { createClerkClient } = await import("@clerk/backend");
  await createClerkClient({ secretKey }).users.deleteUser(id);
}
