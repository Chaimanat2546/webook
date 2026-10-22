import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;

const bundledGuard = build({
  entryPoints: ["components/pwa/push-session-guard.tsx"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "cjs",
  plugins: [{
    name: "browser-session-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: "react-effect", external: true }));
      builder.onResolve({ filter: /supabase\/browser$/ }, () => ({ path: "auth-events", external: true }));
      // In a browser build Next replaces this module with its Server Action transport.
      // Model that transport through fetch, without importing server-only application code.
      builder.onResolve({ filter: /notifications\/actions$/ }, () => ({ path: "action-transport", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        export async function subscribePush(subscription, expectedActor) {
          const response = await fetch("/fixture/subscribe", { method: "POST", body: JSON.stringify({ subscription, expectedActor }) });
          return await response.json();
        }
        export async function unsubscribePush(endpoint) {
          const response = await fetch("/fixture/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) });
          return await response.json();
        }
      ` }));
    },
  }],
});

async function mountGuard(initialActor: string | null, boundActor = "previous", missing = false) {
  const bundle = await bundledGuard;
  const listeners = new Map<string, Set<() => void>>();
  const timers = new Map<number, { delay: number; callback: () => void }>();
  const storage = new Map<string, string>([["webook-push-actor", boundActor]]);
  const calls: string[] = [];
  let callback: AuthCallback | undefined;
  let cleanup: (() => void) | undefined;
  let timerId = 0;
  let present = !missing;
  let browserFails = false;
  let networkFails = false;
  let authUnsubscribed = false;
  const serverBindings = new Set<string>();
  let endpoint = "https://fcm.googleapis.com/fake-device";
  const subscription = {
    get endpoint() { return endpoint; },
    toJSON: () => ({ endpoint, keys: { p256dh: "fixture", auth: "fixture" } }),
    unsubscribe: async () => {
      calls.push("browser-retire");
      if (browserFails) return false;
      present = false;
      return true;
    },
  };
  const exported: { exports: { PushSessionGuard?: () => null } } = { exports: {} };
  const manager = { getSubscription: async () => present ? subscription : null, subscribe: async () => { calls.push("browser-restore"); present = true; return subscription; } };
  runInNewContext(bundle.outputFiles[0].text, {
    module: exported,
    exports: exported.exports,
    require: (id: string) => {
      if (id === "react-effect") return { useEffect: (effect: () => () => void) => { cleanup = effect(); } };
      if (id === "auth-events") return { createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (listener: AuthCallback) => {
        callback = listener;
        callback("INITIAL_SESSION", initialActor ? { user: { id: initialActor } } : null);
        return { data: { subscription: { unsubscribe: () => { authUnsubscribed = true; callback = undefined; } } } };
      } } }) };
      throw new Error(`Unexpected external module: ${id}`);
    },
    setTimeout: (listener: () => void, delay: number) => { const id = ++timerId; timers.set(id, { delay, callback: listener }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
    AbortController, atob,
    document: {
      visibilityState: "visible",
      addEventListener: (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener); },
      removeEventListener: (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); },
    },
    window: {
      PushManager: class PushManager {},
      addEventListener: (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener); },
      removeEventListener: (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); },
    },
    navigator: { serviceWorker: {
      getRegistration: async () => ({ pushManager: manager }),
      ready: Promise.resolve({ pushManager: manager }),
      addEventListener: (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener); },
      removeEventListener: (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); },
    } },
    Notification: { permission: "granted", requestPermission: () => assert.fail("automatic synchronization must never request permission") },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
    fetch: async (_url: string, options: { body: string }) => {
      if (_url === "/api/notifications") return { ok: true, json: async () => ({ actorId: "previous", pushPublicKey: "AQ" }) };
      if (_url === "/fixture/subscribe") {
        const value = JSON.parse(options.body) as { subscription: { endpoint: string }; expectedActor: string };
        assert.equal(value.expectedActor, "previous");
        calls.push("server-sync");
        if (networkFails) throw new TypeError("offline");
        serverBindings.add(value.subscription.endpoint);
        return { json: async () => ({ ok: true }) };
      }
      assert.equal(JSON.parse(options.body).endpoint, subscription.endpoint);
      calls.push("server-retire");
      if (networkFails) throw new TypeError("offline");
      return { json: async () => ({ ok: true }) };
    },
  });
  assert.equal(exported.exports.PushSessionGuard?.(), null);

  async function flush() {
    for (const [id, timer] of timers) {
      if (timer.delay !== 0) continue;
      timers.delete(id);
      timer.callback();
    }
    // Drain async browser/action promises without advancing bounded timeout timers.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return {
    calls, timers, storage, listeners, flush,
    present: () => present,
    authUnsubscribed: () => authUnsubscribed,
    browserFails: (value: boolean) => { browserFails = value; },
    serverBound: () => serverBindings.has(endpoint),
    renew: () => { endpoint = "https://fcm.googleapis.com/renewed-device"; },
    networkFails: (value: boolean) => { networkFails = value; },
    auth: (actor: string | null) => { callback?.(actor ? "SIGNED_IN" : "SIGNED_OUT", actor ? { user: { id: actor } } : null); },
    event: (type: string) => { for (const listener of listeners.get(type) ?? []) listener(); },
    unmount: () => { cleanup?.(); },
  };
}

test("global guard repairs a missing server binding for an already opted-in device without toggling Push", async () => {
  const guard = await mountGuard("previous");
  await guard.flush();
  assert.equal(guard.present(), true);
  assert.deepEqual(guard.calls, ["server-sync"]);
  assert.equal(guard.serverBound(), true);
  assert.equal(guard.storage.get("webook-push-actor"), "previous");
  guard.unmount();
});

test("global guard retires a different actor's subscription without an admin provider", async () => {
  const guard = await mountGuard("new-actor");
  await guard.flush();
  assert.equal(guard.present(), false);
  assert.deepEqual(guard.calls, ["server-retire", "browser-retire"]);
  assert.equal(guard.storage.has("webook-push-actor"), false);
  guard.unmount();
});

test("global guard retires subscriptions on initial signed-out state and later signout events", async () => {
  const initial = await mountGuard(null);
  await initial.flush();
  assert.equal(initial.present(), false);
  initial.unmount();
  const later = await mountGuard("previous");
  await later.flush();
  later.auth(null);
  await later.flush();
  assert.equal(later.present(), false);
  assert.deepEqual(later.calls, ["server-sync", "server-retire", "browser-retire"]);
  later.unmount();
});

test("global guard registers a renewed browser endpoint on focus without replacing its subscription", async () => {
  const guard = await mountGuard("previous");
  await guard.flush();
  guard.renew();
  assert.equal(guard.serverBound(), false);
  guard.event("focus");
  await guard.flush();
  assert.equal(guard.serverBound(), true);
  assert.equal(guard.present(), true);
  assert.deepEqual(guard.calls, ["server-sync", "server-sync"]);
  guard.unmount();
});

test("global guard restores a missing browser subscription with prior consent without a permission dialog", async () => {
  const guard = await mountGuard("previous", "previous", true);
  await guard.flush();
  assert.deepEqual(guard.calls, ["browser-restore", "server-sync"]);
  assert.equal(guard.serverBound(), true);
  guard.unmount();
});

for (const event of ["online", "visibilitychange", "controllerchange"]) {
  test(`global guard retries failed registration on ${event} without off/on`, async () => {
    const guard = await mountGuard("previous");
    guard.networkFails(true); await guard.flush();
    assert.equal(guard.serverBound(), false);
    guard.networkFails(false); guard.event(event); await guard.flush();
    assert.equal(guard.serverBound(), true);
    assert.deepEqual(guard.calls, ["server-sync", "server-sync"]);
    guard.unmount();
  });
}

test("an auth account change retires the former subscription even outside admin routes", async () => {
  const guard = await mountGuard("previous");
  await guard.flush();
  guard.auth("different");
  await guard.flush();
  assert.equal(guard.present(), false);
  assert.equal(guard.storage.has("webook-push-actor"), false);
  guard.unmount();
});

for (const event of ["focus", "online"]) {
  test(`global guard retries browser retirement on ${event} after a failed cleanup`, async () => {
    const guard = await mountGuard("new-actor");
    guard.browserFails(true);
    guard.networkFails(true);
    await guard.flush();
    assert.equal(guard.present(), true);
    assert.equal(guard.storage.get("webook-push-actor"), "previous");
    guard.browserFails(false);
    guard.networkFails(false);
    guard.event(event);
    await guard.flush();
    assert.equal(guard.present(), false);
    assert.deepEqual(guard.calls, ["server-retire", "browser-retire", "server-retire", "browser-retire"]);
    assert.equal(guard.storage.has("webook-push-actor"), false);
    guard.unmount();
  });
}

test("unmount removes auth subscription, browser listeners and queued reconciliation", async () => {
  const guard = await mountGuard("new-actor");
  assert.equal(guard.timers.size, 1);
  guard.unmount();
  assert.equal(guard.authUnsubscribed(), true);
  assert.equal(guard.listeners.get("focus")?.size, 0);
  assert.equal(guard.listeners.get("online")?.size, 0);
  assert.equal(guard.listeners.get("visibilitychange")?.size, 0);
  assert.equal(guard.listeners.get("controllerchange")?.size, 0);
  assert.equal(guard.timers.size, 0);
  guard.event("focus");
  guard.event("online");
  guard.auth(null);
  await guard.flush();
  assert.deepEqual(guard.calls, []);
  assert.equal(guard.present(), true);
});
