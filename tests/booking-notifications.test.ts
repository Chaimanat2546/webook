import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePushSubscription, parseNotificationRead, notificationId, pushEndpoint, notificationPage } from "../lib/booking-notifications.ts";

const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");
const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/device", keys: { p256dh: publicKey, auth: Buffer.alloc(16, 2).toString("base64url") } };

test("subscription validation accepts supported providers and strips untrusted recipient input", () => {
  assert.deepEqual(parsePushSubscription({ ...subscription, userId: "someone-else", dv: 999 }), subscription);
  for (const endpoint of ["https://web.push.apple.com/device", "https://updates.push.services.mozilla.com/wpush/v2/device", "https://wns2-db5p.notify.windows.com/w/?token=device"]) assert.equal(pushEndpoint(endpoint), endpoint);
});

test("subscription validation rejects arbitrary endpoints and malformed keys before privileged work", () => {
  for (const endpoint of ["http://fcm.googleapis.com/send/a", "https://fcm.googleapis.com.evil.test/a", "https://127.0.0.1/a", "https://fcm.googleapis.com:444/a", "https://user@fcm.googleapis.com/a", "https://fcm.googleapis.com/a#x", " https://fcm.googleapis.com/a", "https://fcm.googleapis.com/a\n"]) assert.throws(() => parsePushSubscription({ ...subscription, endpoint }));
  for (const keys of [{ p256dh: "invalid", auth: subscription.keys.auth }, { p256dh: publicKey, auth: "bad" }, { p256dh: Buffer.alloc(65).toString("base64url"), auth: subscription.keys.auth }]) assert.throws(() => parsePushSubscription({ ...subscription, keys }));
  assert.throws(() => parsePushSubscription(null));
});

test("read mutations accept one UUID or a bounded cutoff and reject ambiguous input", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(notificationId(id), id);
  assert.deepEqual(parseNotificationRead({ id }), { id });
  assert.deepEqual(parseNotificationRead({ before: "2026-10-22T10:00:00.000Z" }), { before: "2026-10-22T10:00:00.000Z" });
  assert.deepEqual(parseNotificationRead({ before: "2026-10-22T10:00:00.123456+00:00" }), { before: "2026-10-22T10:00:00.123456+00:00" });
  for (const raw of [{}, { id, before: "2026-10-22T10:00:00Z" }, { id: "../outside" }, { before: "yesterday" }, { before: "2026-02-30T10:00:00Z" }]) assert.throws(() => parseNotificationRead(raw));
  assert.throws(() => notificationPage("-1"));
  assert.throws(() => notificationPage("1.5"));
  assert.equal(notificationPage(null), 1);
});
