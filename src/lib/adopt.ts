/**
 * Moving to Clerk gives each person a new account ID, which would otherwise reset this browser's saved data.
 * The data carries over only when the email matches, so someone else on a shared computer can't inherit it.
 */
export function shouldAdoptLocalData(
  previousOwner: string | null,
  user: { id: string; provider: string; email?: string | null },
  savedEmail: string,
): boolean {
  if (user.provider !== "clerk" || !previousOwner || previousOwner === "demo") return false;
  if (previousOwner === user.id || previousOwner.startsWith("clerk:")) return false;
  const email = user.email?.trim().toLowerCase();
  return !!email && email === savedEmail.trim().toLowerCase();
}
