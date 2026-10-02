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

test("payment-expiry migration preserves booking validation and audit attribution", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260930100000_booking_payment_expiry.sql", import.meta.url), "utf8");
  assert.match(migration, /current_setting\('request\.jwt\.claim\.sub', true\)/i);
  assert.match(migration, /set_config\('request\.jwt\.claim\.sub', p_actor_id::text, true\)/i);
  assert.match(migration, /not isfinite\(v_start\) or not isfinite\(v_end\)/i);
  assert.match(migration, /booking_agent_forbidden/i);
  assert.match(migration, /\(p_values ->> 'checkin_time'\)[\s\S]*?!~ '\^\(\[01\]\[0-9\]\|2\[0-3\]\)/i);
  assert.match(migration, /payment_expires_at=v_expiry/i);
});

test("expiry repository returns the number of cancelled bookings", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.match(request.url, /rpc\/admin_expire_waiting_bookings/);
    return new Response("3", { headers: { "Content-Type": "application/json" } });
  } } });
  assert.equal(await expireWaitingBookings(client), 3);
});
