import assert from "node:assert/strict";
import { test } from "node:test";
import { synchronizePushDevice, type PushSyncDependencies } from "../components/admin/notifications/push-sync.ts";
import { withPushDeviceLock } from "../components/admin/notifications/push-device.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}
function fixture() {
  let bound: string | null = "actor";
  let current = true;
  let permission: NotificationPermission = "granted";
  let exists = true;
  const calls: string[] = [];
  const value = { endpoint: "https://fcm.googleapis.com/current-device", keys: { p256dh: "fixture", auth: "fixture" } };
  const subscription = { endpoint: value.endpoint, toJSON: () => value, unsubscribe: async () => true };
  const dependencies: PushSyncDependencies = {
    boundActor: () => bound, stillCurrent: () => current, permission: () => permission,
    subscription: async () => exists ? subscription : null,
    restore: async () => { calls.push("restore"); return subscription; },
    register: async (raw, actor) => { assert.equal(raw, value); assert.equal(actor, "actor"); calls.push("register"); return { ok: true }; },
    retire: async () => { calls.push("retire"); },
  };
  return { dependencies, calls, bound: () => bound, optOut: () => { bound = null; }, changeActor: () => { current = false; }, permission: (next: NotificationPermission) => { permission = next; }, missing: () => { exists = false; } };
}

test("existing consent repairs the current subscription without recreating it", async () => {
  const state = fixture();
  assert.equal(await synchronizePushDevice("actor", state.dependencies), "enabled");
  assert.deepEqual(state.calls, ["register"]);
});

test("a lost subscription is restored only with existing consent and granted permission", async () => {
  const state = fixture(); state.missing();
  assert.equal(await synchronizePushDevice("actor", state.dependencies), "enabled");
  assert.deepEqual(state.calls, ["restore", "register"]);
});

test("explicit opt-out never silently recreates or registers a subscription", async () => {
  const state = fixture(); state.optOut(); state.missing();
  assert.equal(await synchronizePushDevice("actor", state.dependencies), "off");
  assert.deepEqual(state.calls, []);
});

for (const permission of ["default", "denied"] as const) {
  test(`automatic repair leaves ${permission} permission untouched`, async () => {
    const state = fixture(); state.permission(permission); state.missing();
    assert.equal(await synchronizePushDevice("actor", state.dependencies), "off");
    assert.deepEqual(state.calls, []);
  });
}

test("switching account during the browser lookup cancels registration", async () => {
  const state = fixture();
  const lookup = deferred<null>();
  state.dependencies.subscription = () => lookup.promise;
  const work = synchronizePushDevice("actor", state.dependencies);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.changeActor(); lookup.resolve(null);
  assert.equal(await work, "off");
  assert.deepEqual(state.calls, []);
});

test("failed server repair retains consent and retries without a Push off/on cycle", async () => {
  const state = fixture();
  state.dependencies.register = async () => ({ ok: false });
  assert.equal(await synchronizePushDevice("actor", state.dependencies), "unavailable");
  assert.equal(state.bound(), "actor");
  state.dependencies.register = async () => { state.calls.push("retry"); return { ok: true }; };
  assert.equal(await synchronizePushDevice("actor", state.dependencies), "enabled");
  assert.deepEqual(state.calls, ["retry"]);
});

test("opt-out waits for in-flight repair and queued repair cannot re-enable it", async () => {
  const state = fixture();
  const saved = deferred<{ ok: boolean }>();
  state.dependencies.register = async () => { state.calls.push("register-start"); const result = await saved.promise; state.calls.push("register-end"); return result; };
  const first = synchronizePushDevice("actor", state.dependencies);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.optOut();
  const disable = withPushDeviceLock(async () => { state.calls.push("disable"); });
  const queued = synchronizePushDevice("actor", state.dependencies);
  assert.deepEqual(state.calls, ["register-start"]);
  saved.resolve({ ok: true });
  assert.equal(await first, "off");
  await disable;
  assert.equal(await queued, "off");
  assert.deepEqual(state.calls, ["register-start", "register-end", "retire", "disable"]);
  assert.equal(state.bound(), null);
});

test("a UI timeout cannot release the device lock while registration is still mutating", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const state = fixture();
  const saved = deferred<{ ok: boolean }>();
  state.dependencies.register = () => saved.promise;
  const sync = synchronizePushDevice("actor", state.dependencies);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.optOut();
  const cleanup = withPushDeviceLock(async () => { state.calls.push("cleanup"); });
  context.mock.timers.tick(8_001);
  await new Promise<void>((resolve) => setImmediate(resolve));
  try { assert.deepEqual(state.calls, []); }
  finally { saved.resolve({ ok: true }); await sync; await cleanup; }
  assert.deepEqual(state.calls, ["retire", "cleanup"]);
});

test("closing the settings view during synchronization preserves existing device consent", async () => {
  const state = fixture();
  const saved = deferred<{ ok: boolean }>();
  state.dependencies.register = () => saved.promise;
  const sync = synchronizePushDevice("actor", state.dependencies);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.changeActor(); // stillCurrent also becomes false when its view unmounts.
  saved.resolve({ ok: true });
  assert.equal(await sync, "off");
  assert.deepEqual(state.calls, []);
  assert.equal(state.bound(), "actor");
});

test("a subscription created after opt-out is retired before any server registration", async () => {
  const state = fixture(); state.missing();
  const created = deferred<Awaited<ReturnType<PushSyncDependencies["restore"]>>>();
  state.dependencies.restore = () => created.promise;
  const sync = synchronizePushDevice("actor", state.dependencies);
  await new Promise<void>((resolve) => setImmediate(resolve));
  state.optOut();
  created.resolve({ endpoint: "https://fcm.googleapis.com/late", toJSON: () => ({}), unsubscribe: async () => true });
  assert.equal(await sync, "off");
  assert.deepEqual(state.calls, ["retire"]);
});
