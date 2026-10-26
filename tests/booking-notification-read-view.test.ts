import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";

const actor = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";

test("detail reading waits for a visible client view and survives Strict Mode without duplicate actions", async () => {
  const bundle = await build({ entryPoints: ["components/admin/notifications/notification-read-marker.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "read-view-boundaries", setup(b) {
    for (const filter of [/notifications\/actions$/, /push-device$/]) b.onResolve({ filter }, args => ({ path: args.path, external: true }));
  } }] });
  const loaded = { exports: {} as { NotificationReadMarker: (props: { id: string; read: boolean; actorId: string; href?: string }) => null } };
  const calls: unknown[] = [];
  const destinations: string[] = [];
  const router = { replace: (href: string) => destinations.push(href) };
  let outcome: "success" | "failure" | "throw" = "success";
  const errors: string[] = [];
  const events: string[] = [];
  const timers = new Map<number, () => void>();
  const listeners = new Set<() => void>();
  const document = { visibilityState: "hidden", addEventListener: (_type: string, callback: () => void) => listeners.add(callback), removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback) };
  let timerId = 0;
  let cleanup: (() => void) | undefined;
  runInNewContext(bundle.outputFiles[0].text, { module: loaded, exports: loaded.exports, document, Event,
    clearTimeout: (timer: number) => timers.delete(timer),
    window: { setTimeout: (callback: () => void) => { const timer = ++timerId; timers.set(timer, callback); return timer; }, dispatchEvent: (event: Event) => events.push(event.type) },
    require(name: string) {
      if (name === "react") return { useEffect: (effect: () => (() => void) | undefined) => { cleanup = effect(); } };
      if (name === "next/navigation") return { useRouter: () => router };
      if (name.endsWith("notifications/actions")) return { readNotifications: async (input: unknown, expectedActor: string) => {
        calls.push({ input: structuredClone(input), expectedActor });
        if (outcome === "throw") throw new Error("network");
        return { ok: outcome === "success" };
      } };
      if (name.endsWith("push-device")) return { withTimeout: (promise: Promise<unknown>) => promise };
      if (name === "sonner") return { toast: { error: (message: string) => errors.push(message) } };
      throw new Error("Unexpected import: " + name);
    },
  });
  const props = { id, read: false, actorId: actor, href: "/admin/dashboard/bookings/722?month=2026-10&status=all" };
  assert.equal(loaded.exports.NotificationReadMarker(props), null);
  assert.equal(calls.length, 0);
  cleanup?.();
  assert.equal(timers.size, 0);
  loaded.exports.NotificationReadMarker(props);
  for (const callback of timers.values()) callback();
  await new Promise(setImmediate);
  assert.equal(calls.length, 0, "hidden details must not read");
  assert.equal(destinations.length, 0, "hidden views must not navigate");
  document.visibilityState = "visible";
  for (const callback of listeners) callback();
  await new Promise(setImmediate);
  assert.deepEqual(calls, [{ input: { id }, expectedActor: actor }]);
  assert.deepEqual(events, ["webook-notifications-refresh"]);
  assert.deepEqual(destinations, [props.href]);
  for (const callback of listeners) callback();
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  cleanup?.();
  loaded.exports.NotificationReadMarker({ ...props, read: true });
  for (const callback of timers.values()) callback();
  await new Promise(setImmediate);
  assert.equal(calls.length, 1, "already read links must not write again");
  assert.deepEqual(destinations, [props.href, props.href]);
  cleanup?.();
  for (const failure of ["failure", "throw"] as const) {
    outcome = failure;
    loaded.exports.NotificationReadMarker(props);
    for (const callback of timers.values()) callback();
    await new Promise(setImmediate);
    assert.equal(destinations.at(-1), props.href, "read failure must not block booking access");
    cleanup?.();
  }
  assert.equal(destinations.length, 4);
  assert.equal(errors.length, 2);
});

test("read actions reject a changed account before mutating read state", async () => {
  const bundle = await build({ entryPoints: ["app/admin/notifications/actions.ts"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "read-action-boundaries", setup(b) {
    for (const filter of [/server\/auth\/notifications$/, /server\/services\/booking-notifications$/, /server\/notifications\/runtime-config$/]) b.onResolve({ filter }, args => ({ path: args.path, external: true }));
  } }] });
  const loaded = { exports: {} as { readNotifications: (raw: unknown, expectedActor?: unknown) => Promise<{ ok: boolean }> } };
  const calls: unknown[] = [];
  const require = createRequire(import.meta.url);
  runInNewContext(bundle.outputFiles[0].text, { module: loaded, exports: loaded.exports, require(name: string) {
    if (name.endsWith("server/auth/notifications")) return { notificationSession: async () => ({ actorId: actor, repository: {} }) };
    if (name.endsWith("server/services/booking-notifications")) return { readBookingNotifications: async (_repo: unknown, uid: string, input: unknown) => calls.push({ uid, input }) };
    if (name.endsWith("server/notifications/runtime-config")) return {};
    return require(name);
  } });
  const input = { before: "2026-10-26T08:00:00.123456Z" };
  assert.equal((await loaded.exports.readNotifications(input, id)).ok, false);
  assert.equal(calls.length, 0);
  assert.equal((await loaded.exports.readNotifications(input, actor)).ok, true);
  assert.deepEqual(calls, [{ uid: actor, input }]);
});
