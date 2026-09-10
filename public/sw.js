/* Public offline assets only. Bump this version whenever these assets change. */
const CACHE_NAME = "webook-offline-v4";
const CACHE_PREFIX = "webook-offline-";
const OFFLINE_URL = "/pwa/offline.html";
const OFFLINE_ASSETS = [
  OFFLINE_URL,
  "/pwa/offline.js",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(OFFLINE_ASSETS);
  })());
  // Let existing tabs finish with their current worker; never reload an editor.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (!url.search && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
    return;
  }

  // RSC, API calls, uploads, Server Actions, and private assets stay network-only.
  if (request.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      return await fetch(request, { cache: "no-store" });
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || new Response(
        "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาเชื่อมต่อแล้วลองใหม่",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
  })());
});
