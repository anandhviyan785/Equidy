import { Redis } from "@upstash/redis";
import { getEnv } from "./env.js";

// Upstash Redis over HTTP: shared rate limits and cache across serverless instances.
// Optional. Everything that uses it falls back to per-instance memory when it is missing or slow.

const REDIS_TIMEOUT_MS = 800;

const restUrl = () => getEnv("UPSTASH_REDIS_REST_URL") ?? getEnv("KV_REST_API_URL");
const restToken = () => getEnv("UPSTASH_REDIS_REST_TOKEN") ?? getEnv("KV_REST_API_TOKEN");

export const redisEnabled = () => !!(restUrl() && restToken());

let client: { url: string; redis: Redis } | null = null;

export function redis(): Redis | null {
  const url = restUrl();
  const token = restToken();
  if (!url || !token) return null;
  if (client?.url !== url) client = { url, redis: new Redis({ url, token, retry: { retries: 0 } }) };
  return client.redis;
}

/** Rejects if Redis doesn't answer quickly, so a slow connection never holds up a request. */
export function withRedisTimeout<T>(work: Promise<T>, ms = REDIS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Redis timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
