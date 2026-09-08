import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const name = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((entry) => entry.endsWith("_review_booking_verifications.sql"));

describe("review booking verification migration", () => {
  it("creates a service-only view that joins a booking to its customer phone", () => {
    assert.ok(name, "review-booking verification migration must exist");
    const sql = readFileSync(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );

    assert.match(sql, /create or replace view public\.review_booking_verifications/i);
    assert.match(sql, /with \(security_invoker = true\)/i);
    assert.match(sql, /from public\.bookings b\s+join public\.customers c on c\.id = b\.customer_id/i);
    assert.match(sql, /join public\.listings l on l\.id = b\.listing_id/i);
    assert.match(sql, /b\.booking_code/i);
    assert.match(sql, /c\.phone/i);
    assert.match(sql, /l\.property_id/i);
    assert.match(sql, /revoke all on table public\.review_booking_verifications from anon, authenticated/i);
    assert.match(sql, /grant select on table public\.review_booking_verifications to service_role/i);
    assert.doesNotMatch(sql, /^\s*(?:drop table|truncate)\b/im);
    assert.match(sql, /notify pgrst, 'reload schema';/i);
  });
});
