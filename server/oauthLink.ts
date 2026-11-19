import type { SessionUser } from "./auth.js";

export interface LinkableAccount {
  id: string;
  email: string;
  name: string;
}

/**
 * When a provider vouches for an email that already has an Equidy email account, sign in to that account,
 * so one person keeps one portfolio whichever way they sign in. Unverified emails are never linked.
 */
export async function linkOAuthUser(
  user: SessionUser,
  emailVerified: boolean,
  findAccount: (email: string) => Promise<LinkableAccount | null>,
): Promise<SessionUser> {
  if (!emailVerified || !user.email) return user;
  try {
    const account = await findAccount(user.email.trim().toLowerCase());
    if (!account) return user;
    return { id: `email:${account.id}`, provider: "email", name: account.name, email: account.email, avatar: user.avatar };
  } catch (err) {
    console.warn("[equidy] account link lookup failed, keeping provider identity:", (err as Error).message);
    return user;
  }
}
