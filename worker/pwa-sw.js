import { PrecacheController } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

const offlineUrl = "/pwa/offline.html";
const precache = new PrecacheController({ cacheName: "webook-pwa-precache-v1" });
precache.precache(self.__WB_MANIFEST);

// Match only exact public assets, including the absence of query parameters.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && !url.search && precache.getCachedURLs().includes(url.href),
  async ({ request }) => (await precache.matchPrecache(request)) || fetch(request),
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
// No skipWaiting, push, background replay, or caching of authenticated responses.
