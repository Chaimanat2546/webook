import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

interface WorkerEvent {
  type: string;
  request?: Request;
  waitUntil: (work: Promise<unknown>) => void;
  respondWith: (response: Promise<Response>) => void;
}

// The VM executes the shipped worker. Only browser-provided APIs are simulated.
function worker() {
  const listeners = new Map<string, Array<(event: WorkerEvent) => void>>();
  const stores = new Map<string, Map<string, Response>>();
  const requests: string[] = [];
  let online = true;
  let status = 200;
  let skippedWaiting = false;
  const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const keyUrl = (key: Request | string) => new URL(typeof key === "string" ? key : key.url, "https://webook.test").href;
  const cacheStorage = {
      match: async (key: Request | string, options?: { cacheName?: string }) => {
        for (const [name, store] of stores) {
          if (options?.cacheName && name !== options.cacheName) continue;
          const response = store.get(keyUrl(key));
          if (response) return response.clone();
        }
        return undefined;
      },
      keys: async () => [...stores.keys()],
      delete: async (key: string) => stores.delete(key),
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
          put: async (key: Request | string, response: Response) => { store.set(keyUrl(key), response.clone()); },
          match: async (key: Request | string) => store.get(keyUrl(key))?.clone(),
          delete: async (key: Request | string) => store.delete(keyUrl(key)),
          keys: async () => [...store.keys()].map((key) => new Request(key)),
        };
      },
    };
  const location = new URL("https://webook.test/sw.js");
  runInNewContext(source, {
    URL, Response, Request, Headers, setTimeout, clearTimeout, location,
    FetchEvent: class FetchEvent {},
    self: {
      location,
      registration: { scope: "https://webook.test/" },
      caches: cacheStorage,
      clients: { claim: async () => {} },
      skipWaiting: async () => { skippedWaiting = true; },
      addEventListener: (type: string, callback: (event: WorkerEvent) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), callback]);
      },
    },
    caches: cacheStorage,
    fetch: async (request: Request | string) => {
      const url = keyUrl(request);
      requests.push(url);
      if (!online) throw new TypeError("Network unavailable");
      if (new URL(url).pathname.startsWith("/pwa/")) return new Response(`asset:${new URL(url).pathname}`, { status });
      assert.equal(typeof request !== "string" && request.cache, "no-store");
      return new Response("server response", { status });
    },
  });
  async function dispatch(type: string, request?: WorkerEvent["request"]) {
    const work: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const event: WorkerEvent = {
      type,
      request,
      waitUntil: (promise) => { work.push(promise); },
      respondWith: (promise) => { response = promise; },
    };
    for (const listener of listeners.get(type) ?? []) listener(event);
    // Workbox may add waitUntil promises during asynchronous plugin callbacks.
    for (let i = 0; i < work.length; i++) await work[i];
    return response;
  }
  return {
    dispatch, stores, requests,
    setOffline: () => { online = false; },
    setStatus: (value: number) => { status = value; },
    skippedWaiting: () => skippedWaiting,
  };
}

function request(path: string, mode = "navigate", method = "GET") {
  const value = new Request(new URL(path, "https://webook.test"), { method });
  // Node cannot construct navigation requests; browsers supply them to the worker.
  Object.defineProperty(value, "mode", { value: mode });
  return value;
}

test("offline navigation returns a public fallback, never previously visited private HTML", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
  const online = await runtime.dispatch("fetch", request("/admin/quotations/secret"));
  assert.equal(await online?.text(), "server response");
  runtime.setOffline();
  for (const path of ["/", "/login", "/admin/houses", "/admin/quotations/secret", "/q/private-token"]) {
    const response = await runtime.dispatch("fetch", request(path));
    assert.equal(await response?.text(), "asset:/pwa/offline.html");
  }
  for (const store of runtime.stores.values()) {
    assert.ok(store.size > 0);
    for (const key of store.keys()) {
      assert.ok(new URL(key).pathname.startsWith("/pwa/"), `Unexpected cached URL: ${key}`);
      assert.match(new URL(key).searchParams.get("__WB_REVISION__") ?? "", /^[a-f0-9]{32}$/);
    }
  }
});

test("API, RSC, scripts, external requests, and mutations bypass the offline handler", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
  runtime.requests.length = 0;
  runtime.setOffline();
  for (const req of [
    request("/api/admin/customers", "cors"),
    request("/api/admin/export", "navigate"),
    request("/admin/houses?_rsc=123", "cors"),
    request("/_next/static/chunks/app.js", "cors"),
    request("https://tenant.supabase.co/rest/v1/customers", "cors"),
    request("https://other.test/", "navigate"),
    request("/login", "navigate", "POST"),
    request("/admin/houses", "cors", "POST"),
    request("/pwa/icon-192.png?private=value", "cors"),
  ]) assert.equal(await runtime.dispatch("fetch", req), undefined, req.url);
  assert.equal(runtime.requests.length, 0);
});

test("HTTP authorization and server errors remain server responses", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
  for (const status of [401, 403, 404, 500]) {
    runtime.setStatus(status);
    const response = await runtime.dispatch("fetch", request("/admin/houses"));
    assert.equal(response?.status, status);
    assert.equal(await response?.text(), "server response");
  }
});

test("offline assets are available without network access", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
  runtime.setOffline();
  for (const path of ["/pwa/offline.js", "/pwa/icon-192.png"]) {
    const response = await runtime.dispatch("fetch", request(path, "cors"));
    assert.equal(await response?.text(), `asset:${path}`);
  }
});

test("updates remove only old WeBooks offline caches and never force activation", async () => {
  const runtime = worker();
  runtime.stores.set("webook-offline-v0", new Map());
  runtime.stores.set("other-app-cache", new Map());
  await runtime.dispatch("install");
  await runtime.dispatch("activate");
  assert.equal(runtime.stores.has("webook-offline-v0"), false);
  assert.equal(runtime.stores.has("other-app-cache"), true);
  assert.equal(runtime.skippedWaiting(), false);
  assert.ok([...runtime.stores.values()].some((store) => [...store.keys()].some((key) => new URL(key).pathname === "/pwa/offline.html")));
});

test("a failed precache install rejects and leaves legacy caches in place", async () => {
  const runtime = worker();
  runtime.stores.set("webook-offline-v4", new Map());
  runtime.setStatus(500);
  await assert.rejects(runtime.dispatch("install"));
  assert.equal(runtime.stores.has("webook-offline-v4"), true);
  assert.equal(runtime.skippedWaiting(), false);
});

test("activation removes obsolete revisions from only the owned Workbox cache", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
  const cache = runtime.stores.get("webook-pwa-precache-v1")!;
  const obsolete = "https://webook.test/pwa/offline.html?__WB_REVISION__=obsolete";
  cache.set(obsolete, new Response("old"));
  await runtime.dispatch("activate");
  assert.equal(cache.has(obsolete), false);
  assert.equal(cache.size, 5);
});
