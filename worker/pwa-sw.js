import { PrecacheController } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { HOUSE_IMAGE_CACHE_MAX_AGE_SECONDS, shouldCacheHouseImageRequest } from "../lib/house-image-cache.ts";

const offlineUrl = "/pwa/offline.html";
const precache = new PrecacheController({ cacheName: "webook-pwa-precache-v1" });
precache.precache(self.__WB_MANIFEST);

// Match only exact public assets, including the absence of query parameters.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && !url.search && precache.getCachedURLs().includes(url.href),
  async ({ request }) => (await precache.matchPrecache(request)) || fetch(request),
);

const houseImageCache = new CacheFirst({
  cacheName: "webook-house-images-v1",
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: HOUSE_IMAGE_CACHE_MAX_AGE_SECONDS }),
  ],
});

registerRoute(
  ({ request, url }) => shouldCacheHouseImageRequest({ url: url.href, method: request.method, destination: request.destination }),
  houseImageCache,
);

const navigation = new NetworkOnly({
  plugins: [{
    // Workbox deliberately omits fetchOptions for navigation requests.
    requestWillFetch: async ({ request }) => new Request(request, { cache: "no-store" }),
  }],
});

registerRoute(
  ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate"
    && url.pathname !== "/api" && !url.pathname.startsWith("/api/"),
  async (context) => {
    try {
      return await navigation.handle(context);
    } catch {
      return (await precache.matchPrecache(offlineUrl)) || new Response(
        "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาเชื่อมต่อแล้วลองใหม่",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
  },
);

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("webook-offline-")) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "WEBOOK_ACTIVATE_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});
// Activation only on explicit confirmation. No automatic reload or replay.

function notificationId(value) {
  return typeof value?.notificationId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.notificationId)
    ? value.notificationId : null;
}

self.addEventListener("push", (event) => {
  let id;
  try { id = notificationId(event.data?.json()); } catch { return; }
  if (!id) return;
  event.waitUntil(self.registration.showNotification("WeBooks: มี booking ใหม่", {
    body: "เปิด WeBooks เพื่อดูรายละเอียด",
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: id,
    data: { notificationId: id },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = notificationId(event.notification.data);
  if (!id) return;
  const target = new URL(`/admin/notifications/${id}`, self.location.origin);
  event.waitUntil((async () => {
    // Same-origin clients can be ordinary Safari tabs. Let the platform launch
    // the installed app associated with this registration instead of choosing a tab.
    const opened = await self.clients.openWindow(target.href);
    if (opened) await opened.focus();
  })());
});
