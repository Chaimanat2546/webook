import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import type { NotificationActionResult } from "../lib/booking-notifications.ts";

const actor = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/fixture", keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") } };

async function fixture(existingBinding?: string) {
  const writes: unknown[] = [];
  const cookieWrites: unknown[] = [];
  const bundle = await build({ entryPoints: ["app/admin/notifications/actions.ts"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{ name: "action-boundaries", setup(builder) {
    builder.onResolve({ filter: /server\/auth\/notifications$/ }, () => ({ path: "auth-fixture", external: true }));
    builder.onResolve({ filter: /notifications\/runtime-config$/ }, () => ({ path: "runtime-fixture", external: true }));
  } }] });
  const loaded: { exports: { subscribePush?: (raw: unknown, expectedActor?: unknown) => Promise<NotificationActionResult> } } = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => {
    if (name === "auth-fixture") return { notificationSession: async () => ({ actorId: actor, repository: { subscribe: async (...args: unknown[]) => { writes.push(args); return other; } } }) };
    if (name === "runtime-fixture") return { getPushRuntimeConfig: async () => ({ publicKey: subscription.keys.p256dh }) };
    if (name === "next/headers") return { cookies: async () => ({ get: () => existingBinding ? { value: existingBinding } : undefined, set: (...args: unknown[]) => { cookieWrites.push(args); } }) };
    return require(name);
  }, loaded, loaded.exports);
  return { writes, cookieWrites, subscribe: loaded.exports.subscribePush! };
}

test("automatic Push registration refuses a request prepared for a different signed-in actor", async () => {
  const state = await fixture();
  assert.equal((await state.subscribe(subscription, other)).ok, false);
  assert.equal(state.writes.length, 0);
  assert.equal(state.cookieWrites.length, 0);
});

test("automatic Push registration validates the expected actor before privileged writes", async () => {
  const state = await fixture();
  assert.equal((await state.subscribe(subscription, "invalid")).ok, false);
  assert.equal(state.writes.length, 0);
});

test("matching actor registers its current device using authenticated server identity", async () => {
  const state = await fixture();
  assert.equal((await state.subscribe(subscription, actor)).ok, true);
  assert.deepEqual(state.writes, [[actor, subscription]]);
  assert.equal(state.cookieWrites.length, 1);
});

test("repeated automatic registration keeps its existing cookie without a layout refresh mutation", async () => {
  const state = await fixture(other);
  assert.equal((await state.subscribe(subscription, actor)).ok, true);
  assert.equal(state.writes.length, 1);
  assert.equal(state.cookieWrites.length, 0);
});
