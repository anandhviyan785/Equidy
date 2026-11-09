import fs from "node:fs/promises";
import path from "node:path";
import { envFlag } from "./env.js";

// Local-development account store: a JSON file instead of Postgres, so email sign-in works with no database.
// Opt-in with EQUIDY_DEV_ACCOUNTS=1 and never active in production (serverless hosts can't persist files safely).

export interface StoredAccount {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

const FILE = path.resolve(process.cwd(), ".data", "accounts.json");
const IS_PRODUCTION = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL;

export const devAccountsEnabled = () => envFlag("EQUIDY_DEV_ACCOUNTS") && !IS_PRODUCTION();

// Serialises read-modify-write cycles so concurrent sign-ups can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<StoredAccount[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function save(accounts: StoredAccount[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(accounts, null, 2), { mode: 0o600 });
}

/** Adds the account; returns null when the email is already registered. */
export const devInsert = (account: StoredAccount) =>
  exclusive(async () => {
    const all = await load();
    if (all.some((a) => a.email === account.email)) return null;
    await save([...all, account]);
    return account;
  });

export const devFindByEmail = async (email: string) => (await load()).find((a) => a.email === email);

export const devDelete = (id: string) =>
  exclusive(async () => save((await load()).filter((a) => a.id !== id)));
