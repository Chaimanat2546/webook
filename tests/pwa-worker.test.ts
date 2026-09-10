import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

interface WorkerEvent {
  request?: { url: string; method: string; mode: string; headers: Headers };
  waitUntil: (work: Promise<unknown>) => void;
  respondWith: (response: Promise<Response>) => void;
}

// The VM executes the shipped worker. Only browser-provided APIs are simulated.
function worker() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const requests: string[] = [];
  let online = true;
  let status = 200;
  let skippedWaiting = false;
  const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, {
    URL, Response,
    self: {
      location: { origin: "https://webook.test" },
      clients: { claim: async () => {} },
      skipWaiting: async () => { skippedWaiting = true; },
      addEventListener: (type: string, callback: (event: WorkerEvent) => void) => listeners.set(type, callback),
    },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (key: string) => stores.delete(key),
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
          addAll: async (urls: string[]) => {
            for (const url of urls) store.set(url, new Response(`asset:${url}`));
          },
          match: async (key: string) => store.get(key)?.clone(),
        };
      },
    },
    fetch: async (request: { url: string } | string) => {
      requests.push(typeof request === "string" ? request : request.url);
      if (!online) throw new TypeError("Network unavailable");
      return new Response("server response", { status });
    },
  });
  async function dispatch(type: string, request?: WorkerEvent["request"]) {
    const work: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)?.({
      request,
      waitUntil: (promise) => { work.push(promise); },
      respondWith: (promise) => { response = promise; },
    });
    await Promise.all(work);
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
  return { url: new URL(path, "https://webook.test").href, mode, method, headers: new Headers() };
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
    for (const key of store.keys()) assert.ok(key.startsWith("/pwa/"), `Unexpected cached URL: ${key}`);
  }
});

test("API, RSC, scripts, external requests, and mutations bypass the offline handler", async () => {
  const runtime = worker();
  await runtime.dispatch("install");
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

test("updates remove only old Webook offline caches and never force activation", async () => {
  const runtime = worker();
  runtime.stores.set("webook-offline-v0", new Map());
  runtime.stores.set("other-app-cache", new Map());
  await runtime.dispatch("install");
  await runtime.dispatch("activate");
  assert.equal(runtime.stores.has("webook-offline-v0"), false);
  assert.equal(runtime.stores.has("other-app-cache"), true);
  assert.equal(runtime.skippedWaiting(), false);
  assert.ok([...runtime.stores.values()].some((store) => store.has("/pwa/offline.html")));
});
