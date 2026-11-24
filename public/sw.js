// Equidy service worker: makes the app installable and shows a friendly page when offline.
// Pages always come from the network first, so users never see stale app code.
// The API is never cached: chats, portfolios and account data stay live and private.

const CACHE = "equidy-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Hashed build files never change, so a cached copy is always correct. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // The host rewrites unknown paths to index.html with status 200, so never cache an HTML reply under an asset URL.
  const type = response.headers.get("content-type") || "";
  if (response.ok && !type.includes("text/html")) {
    const copy = response.clone();
    const cache = await caches.open(CACHE);
    await cache.put(request, copy);
  }
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkOrOffline(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(request));
});
