import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createNotificationRepository } from "../server/repositories/booking-notifications.ts";
import { getBookingNotificationFeed } from "../server/services/booking-notifications.ts";

test("claimed database house IDs reach the dispatcher without number precision loss", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const client = createClient("https://supabase.test", "fixture", { global: { fetch: async (input, init) => {
    assert.equal(String(input), "https://supabase.test/rest/v1/rpc/booking_push_claim");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { p_limit: 50 });
    return Response.json([{ id, leaseToken: id, notificationId: id, subscriptionId: id, eventType: "booking_cancelled", propertyId: "9007199254740993", attempt: 1, endpoint: "https://fcm.googleapis.com/device", keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") } }]);
  } }, auth: { persistSession: false, autoRefreshToken: false } });
  const [job] = await createNotificationRepository(client).claim();
  assert.equal(job.propertyId, "9007199254740993");
  assert.equal(job.eventType, "booking_cancelled");
});

test("cursor API contract forwards microseconds and rejects incomplete poll windows", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const cursor = { id, createdAt: "2026-10-26T08:00:00.123456+00:00" };
  const client = createClient("https://supabase.test", "fixture", { global: { fetch: async (input, init) => {
    assert.equal(String(input), "https://supabase.test/rest/v1/rpc/booking_notification_feed");
    assert.deepEqual(JSON.parse(String(init?.body)), { p_actor: id, p_filter: "payment", p_cursor: cursor, p_head: null, p_tail: null, p_window_cursor: null });
    return Response.json({ items: [], total: 0, unreadCount: 5, page: 1, pageSize: 20, asOf: cursor.createdAt, nextCursor: null, retainedCursor: null, retained: null, hasNew: false });
  } }, auth: { persistSession: false, autoRefreshToken: false } });
  const repository = createNotificationRepository(client);
  const result = await getBookingNotificationFeed(repository, id, new URLSearchParams({ filter: "payment", cursor: JSON.stringify(cursor) }));
  assert.equal(result.unreadCount, 5);
  assert.equal(result.nextCursor, null);
  for (const params of [new URLSearchParams({ head: JSON.stringify(cursor) }), new URLSearchParams({ windowCursor: JSON.stringify(cursor) }), new URLSearchParams({ filter: "invalid" }), new URLSearchParams({ cursor: "bad" })]) {
    await assert.rejects(getBookingNotificationFeed(repository, id, params), /notification_invalid_input/);
  }
});
