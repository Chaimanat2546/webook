import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createNotificationRepository } from "../server/repositories/booking-notifications.ts";

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
