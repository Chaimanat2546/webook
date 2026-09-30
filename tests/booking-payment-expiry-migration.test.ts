import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { expireWaitingBookings } from "../server/repositories/booking-expiry.ts";

test("payment-expiry migration creates an atomic service-role-only waiting sweep", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260930100000_booking_payment_expiry.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists payment_expires_at timestamptz/i);
  assert.match(migration, /where status = 'waiting' and payment_expires_at is not null/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /status = 'waiting' and payment_expires_at <= clock_timestamp\(\)/i);
  assert.match(migration, /grant execute on function public\.admin_expire_waiting_bookings\(integer\) to service_role/i);
  assert.match(migration, /revoke all on function public\.admin_expire_waiting_bookings\(integer\) from public, anon, authenticated/i);
});

test("expiry repository returns the number of cancelled bookings", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.match(request.url, /rpc\/admin_expire_waiting_bookings/);
    return new Response("3", { headers: { "Content-Type": "application/json" } });
  } } });
  assert.equal(await expireWaitingBookings(client), 3);
});
