import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanupPushDevice, disablePushDevice, reconcilePushDevice, runNotificationSignOut, withTimeout } from "../components/admin/notifications/push-device.ts";

function device(serverFails = false) {
  const calls: string[] = [];
  const subscription = { endpoint: "https://push.test/device", unsubscribe: async () => { calls.push("browser"); return true; } };
  const remove = async () => { calls.push("server"); if (serverFails) throw new Error("offline"); return { ok: true as const }; };
  return { calls, subscription, remove };
}

test("device cleanup attempts server removal and browser unsubscribe even when offline", async () => {
  const state = device(true);
  assert.equal(await cleanupPushDevice(state.subscription, state.remove), false);
  assert.deepEqual(state.calls, ["server", "browser"]);
});

test("switching accounts retires the previous browser subscription without silently subscribing", async () => {
  const state = device();
  assert.equal(await reconcilePushDevice("new-user", "old-user", state.subscription, state.remove), null);
  assert.deepEqual(state.calls, ["server", "browser"]);
});

test("an unknown browser binding is retired and a matching actor binding is retained", async () => {
  const state = device();
  assert.equal(await reconcilePushDevice("user", "user", state.subscription, state.remove), state.subscription);
  assert.deepEqual(state.calls, []);
  assert.equal(await reconcilePushDevice("user", null, state.subscription, state.remove), null);
  assert.deepEqual(state.calls, ["server", "browser"]);
});

test("signout waits for cleanup, reports failure, and still signs out", async () => {
  const calls: string[] = [];
  await runNotificationSignOut(async () => { calls.push("cleanup"); return false; }, async () => { calls.push("signout"); }, () => { calls.push("notice"); });
  assert.deepEqual(calls, ["cleanup", "notice", "signout"]);
});

test("waiting for a missing worker terminates with a safe timeout", async () => {
  await assert.rejects(withTimeout(new Promise<never>(() => {}), 5), /อุปกรณ์ยังไม่พร้อม/);
});

test("account reconciliation fails closed when the browser cannot retire its old subscription", async () => {
  const state = device();
  state.subscription.unsubscribe = async () => false;
  await assert.rejects(reconcilePushDevice("new", "old", state.subscription, state.remove));
});

test("device disable reports incomplete cleanup when both server and browser fail", async () => {
  const state = device(true);
  state.subscription.unsubscribe = async () => false;
  assert.deepEqual(await disablePushDevice(async () => state.subscription, state.remove), { complete: false, state: "cleanup-failed" });
});

test("device disable reports off after browser retirement even if server cleanup is unavailable", async () => {
  const state = device(true);
  let exists = true;
  state.subscription.unsubscribe = async () => { exists = false; return true; };
  assert.deepEqual(await disablePushDevice(async () => exists ? state.subscription : null, state.remove), { complete: false, state: "off" });
});
