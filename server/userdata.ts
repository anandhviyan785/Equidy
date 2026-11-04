import { dbDelete, dbSelect, dbUpsert, supabaseDbEnabled } from "./supabase.js";

// Per-user app data (portfolio, watchlist, conversations, settings) kept in Supabase so it follows
// the person across devices. Stored as JSON documents in the equidy_user_data table.

const TABLE = "equidy_user_data";
export const MAX_DATA_BYTES = 3_500_000; // below Vercel's 4.5 MB request limit
const MAX_CONVERSATIONS = 300;

export interface UserData {
  portfolio: { holdings: unknown[]; watchlist: string[] };
  chats: unknown[];
  settings: Record<string, unknown>;
  updatedAt: number;
}

export const syncEnabled = () => supabaseDbEnabled();

export class DataError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Validates and normalises a document sent by the browser. */
export function parseUserData(input: unknown): UserData {
  if (!isObject(input)) throw new DataError("Expected an object.");
  const portfolio = isObject(input.portfolio) ? input.portfolio : {};
  const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings.filter(isObject) : [];
  const watchlist = Array.isArray(portfolio.watchlist) ? portfolio.watchlist.filter((s): s is string => typeof s === "string" && s.length <= 15) : [];
  const chats = Array.isArray(input.chats) ? input.chats.filter(isObject).slice(0, MAX_CONVERSATIONS) : [];
  const settings = isObject(input.settings) ? input.settings : {};
  const updatedAt = typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now();
  const doc: UserData = { portfolio: { holdings: holdings.slice(0, 500), watchlist: watchlist.slice(0, 200) }, chats, settings, updatedAt };
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_DATA_BYTES) throw new DataError("Your saved data is too large to sync. Delete some old conversations and try again.", 413);
  return doc;
}

interface Row {
  user_id: string;
  portfolio: UserData["portfolio"];
  chats: unknown[];
  settings: Record<string, unknown>;
  client_updated_at: number;
}

export async function loadUserData(userId: string): Promise<UserData | null> {
  const [row] = await dbSelect<Row>(TABLE, { user_id: userId });
  if (!row) return null;
  return { portfolio: row.portfolio, chats: row.chats, settings: row.settings, updatedAt: Number(row.client_updated_at) || 0 };
}

export async function saveUserData(userId: string, data: UserData): Promise<void> {
  await dbUpsert(
    TABLE,
    { user_id: userId, portfolio: data.portfolio, chats: data.chats, settings: data.settings, client_updated_at: data.updatedAt, updated_at: new Date().toISOString() },
    "user_id",
  );
}

export async function deleteUserData(userId: string): Promise<void> {
  if (!syncEnabled()) return;
  await dbDelete(TABLE, { user_id: userId });
}
