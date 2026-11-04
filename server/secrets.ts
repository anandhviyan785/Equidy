import crypto from "node:crypto";
import { getEnv } from "./env.js";

// AES-256-GCM encryption for secrets stored in the database (Plaid access tokens).
// The key comes from TOKEN_ENCRYPTION_KEY, or is derived from SESSION_SECRET.

const VERSION = "v1";

function key(): Buffer {
  const material = getEnv("TOKEN_ENCRYPTION_KEY") ?? getEnv("SESSION_SECRET");
  if (!material) throw new Error("Set SESSION_SECRET (or TOKEN_ENCRYPTION_KEY) to store bank connections.");
  return crypto.createHash("sha256").update(`equidy-token-key:${material}`).digest();
}

export const encryptionAvailable = () => !!(getEnv("TOKEN_ENCRYPTION_KEY") ?? getEnv("SESSION_SECRET"));

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised encrypted value.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Stable, non-reversible identifier for a user, safe to share with third parties. */
export const opaqueUserId = (userId: string) => crypto.createHash("sha256").update(`equidy-user:${userId}`).digest("hex").slice(0, 40);
