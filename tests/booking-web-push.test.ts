import assert from "node:assert/strict";
import { test } from "node:test";
import { sendBookingPush, pushConfig, pushResult } from "../server/notifications/web-push.ts";

const now = new Date("2026-10-22T10:00:00.000Z");
test("Push outcomes bound retries, respect Retry-After and retire only gone subscriptions", () => {
  assert.deepEqual(pushResult(201, null, 1, now), { status: "sent", error: null, retryAt: null });
  assert.deepEqual(pushResult(410, null, 1, now), { status: "expired", error: "push_subscription_gone", retryAt: null });
  assert.equal(pushResult(403, null, 1, now).status, "failed");
  assert.equal(pushResult(429, "180", 1, now).retryAt, "2026-10-22T10:03:00.000Z");
  assert.equal(pushResult(503, "Thu, 22 Oct 2026 10:20:00 GMT", 2, now).retryAt, "2026-10-22T10:20:00.000Z");
  assert.equal(pushResult(503, "bad", 4, now).retryAt, "2026-10-22T10:08:00.000Z");
  assert.equal(pushResult(503, null, 5, now).status, "failed");
  assert.equal(pushResult(0, null, 1, now).retryAt, "2026-10-22T10:01:00.000Z");
});

test("missing or malformed VAPID disables Push without throwing or exposing configuration", () => {
  assert.equal(pushConfig({}), null);
  assert.equal(pushConfig({ VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: "secret", VAPID_SUBJECT: "mailto:test@example.test" }), null);
});

test("adapter sends encrypted generic payload with no redirects and no recipient details", async () => {
  const vapidPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapidPrivate = await crypto.subtle.exportKey("jwk", vapidPair.privateKey);
  const vapidPublic = await crypto.subtle.exportKey("raw", vapidPair.publicKey);
  const device = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const devicePublic = await crypto.subtle.exportKey("raw", device.publicKey);
  const config = { publicKey: Buffer.from(vapidPublic).toString("base64url"), privateKey: vapidPrivate.d!, subject: "mailto:notifications@example.test" };
  const endpoint = "https://fcm.googleapis.com/fcm/send/device";
  let sent = false;
  const result = await sendBookingPush({ notificationId: "00000000-0000-4000-8000-000000000001", endpoint, keys: { p256dh: Buffer.from(devicePublic).toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") }, attempt: 1 }, config, async (input, init) => {
    sent = true;
    assert.equal(input, endpoint);
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Content-Encoding"), "aes128gcm");
    assert.match(headers.get("Authorization") ?? "", /^vapid /);
    const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
    assert.equal(body.length, 4096);
    assert.ok(!new TextDecoder().decode(body).includes("notificationId"));
    // Independently decrypt using the recipient private key and RFC8291 derivation.
    const senderKey = await crypto.subtle.importKey("raw", body.slice(21, 86), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, device.privateKey, 256);
    const hkdf = async (ikm: BufferSource, salt: BufferSource, info: Uint8Array, length: number) => {
      const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
      return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array(info) }, key, length * 8);
    };
    const info = Buffer.concat([Buffer.from("WebPush: info\0"), Buffer.from(devicePublic), body.slice(21, 86)]);
    const ikm = await hkdf(shared, Buffer.alloc(16, 7), info, 32);
    const key = await hkdf(ikm, body.slice(0, 16), new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(ikm, body.slice(0, 16), new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
    const aes = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, body.slice(86)));
    let end = plain.length - 1;
    while (plain[end] === 0) end--;
    assert.equal(plain[end], 2);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(plain.slice(0, end))), { notificationId: "00000000-0000-4000-8000-000000000001" });
    return new Response(null, { status: 201 });
  });
  assert.ok(sent);
  assert.equal(result.status, "sent");
});
