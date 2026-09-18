import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../lib/house-bookings.ts";
import type { HouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { saveHouseBooking, getHouseBooking, bookingError } from "../server/services/house-bookings.ts";

const row: Booking = { id: "1", booking_code: "BK1", listing_id: "listing1", houseid: "1024", agent_id: null, customer_id: null, customer: null, check_in: "2026-09-28", check_out: "2026-10-03", status: "confirmed", booking_type: "booking", price_sell: 15000, price_max: 0, deposit_amount: 5000, extra_charge: 0, quantity: 1, details: null, note: null, updated_at: "2026-09-18T00:00:00Z" };
function memory() {
  let saved = { ...row };
  const repository: HouseBookingsRepository = {
    house: async property => property === "1024" ? { id: "listing1", property_id: "1024", title: "test" } : { id: "listing2", property_id: property, title: "other" },
    get: async (house, id) => house.id === saved.listing_id && id === saved.id ? saved : null,
    list: async () => [saved], customers: async () => [],
    update: async (house, actor, input) => { assert.equal(house.id, "listing1"); assert.equal(actor, "actor"); saved = { ...saved, ...input }; return saved; },
  };
  return { repository, value: () => saved };
}
test("cross-house lookup and save cannot reveal or change a booking", async () => {
  const store = memory();
  await assert.rejects(getHouseBooking(store.repository, "999", "1"), /booking_not_found/);
  await assert.rejects(saveHouseBooking(store.repository, "actor", "999", { ...row, price_sell: 1 }), /booking_not_found/);
  assert.equal(store.value().price_sell, 15000);
});
test("stale save does not overwrite the current total", async () => {
  const store = memory();
  await assert.rejects(saveHouseBooking(store.repository, "actor", "1024", { ...row, updated_at: "2026-09-17T00:00:00Z", price_sell: 1 }), /booking_stale/);
  assert.equal(store.value().price_sell, 15000);
});
test("save allowlists editable fields and preserves the single total when dates change", async () => {
  const store = memory();
  const saved = await saveHouseBooking(store.repository, "actor", "1024", { ...row, check_out: "2026-10-04", listing_id: "attacker", houseid: "999", details: "overwritten", price_max: 6900, price_sell: 3900, deposit_amount: 99999 });
  assert.equal(saved.price_sell, 3900);
  assert.equal(saved.price_max, 6900);
  assert.equal(saved.deposit_amount, 5000);
  assert.equal(saved.check_out, "2026-10-04");
  assert.equal(saved.listing_id, "listing1");
  assert.equal(saved.houseid, "1024");
  assert.equal(saved.details, null);
});
test("database errors use actionable messages without leaking raw SQL", () => {
  assert.match(bookingError({ code: "23P01", message: "private SQL" }), /ซ้อน/);
  assert.match(bookingError({ code: "PGRST202", message: "private SQL" }), /ฐานข้อมูล/);
  assert.equal(bookingError({ code: "XX000", message: "private SQL" }).includes("private"), false);
});
