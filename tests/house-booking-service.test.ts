import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../lib/house-bookings.ts";
import type { HouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { cancelHouseBooking, createHouseBooking, saveHouseBooking, getHouseBooking, listHouseBookings, bookingError } from "../server/services/house-bookings.ts";

const row: Booking = { id: "1", booking_code: "BK1", listing_id: "listing1", houseid: "1024", agent_id: null, customer_id: null, customer: null, check_in: "2026-09-28", check_out: "2026-10-03", status: "confirmed", booking_type: "booking", price_sell: 15000, price_max: 0, deposit_amount: 5000, extra_charge: 0, quantity: 1, details: null, note: null, updated_at: "2026-09-18T00:00:00Z" };
function memory() {
  let saved = { ...row };
  const repository: HouseBookingsRepository = {
    galleryHouses: async () => [], galleryBookings: async () => [],
    house: async property => property === "1024" ? { id: "listing1", property_id: "1024", title: "test" } : { id: "listing2", property_id: property, title: "other" },
    get: async (house, id) => house.id === saved.listing_id && id === saved.id ? saved : null,
    create: async () => { throw new Error("unused"); },
    list: async () => [saved], customers: async () => [],
    ownsCustomer: async () => true, customerDetail: async () => null, updateCustomer: async () => { throw new Error("unused"); }, customersByPhone: async () => [], createCustomer: async () => { throw new Error("unused"); },
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

test("cancelled bookings disappear from the calendar but remain stored", async () => {
  const store = memory();
  await saveHouseBooking(store.repository, "actor", "1024", { ...row, status: "cancelled" });
  assert.deepEqual(await listHouseBookings(store.repository, "1024", "2026-09-01", "2026-10-12"), []);
  assert.equal(store.value().status, "cancelled");
});

test("creation derives nights and house from the route and accepts only an existing customer reference", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-21T00:00:00Z") });
  const store = memory();
  let calls = 0;
  store.repository.create = async (house, actor, input) => {
    calls++;
    assert.equal(house.property_id, "1024");
    assert.equal(actor, "actor");
    assert.equal(input.quantity, 5);
    assert.equal(input.customer_id, "42");
    assert.equal("houseid" in input, false);
    assert.equal("deposit_amount" in input, false);
    return { ...row, ...input };
  };
  const input = { ...row, request_id: "00000000-0000-4000-8000-000000000001", customer_id: "42", houseid: "999" };
  await createHouseBooking(store.repository, "actor", "1024", input);
  await assert.rejects(createHouseBooking(store.repository, "actor", "1024", { ...input, customer_id: null }));
  assert.equal(calls, 1);
});

test("creation rejects past check-in before writing", async t => {
 t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-21T00:00:00Z") });
 const store = memory();
 await assert.rejects(createHouseBooking(store.repository, "actor", "1024", { ...row, check_in: "2026-09-20", request_id: "00000000-0000-4000-8000-000000000001", customer_id: "42" }), /ผ่านมา/);
});

test("repair may be cancelled without a customer; conversion to booking requires one", async t => {
 t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-21T00:00:00Z") });
 const store = memory();
 const repaired = await saveHouseBooking(store.repository, "actor", "1024", { ...row, status: "repair" });
 assert.equal(repaired.customer_id, null);
 assert.equal(repaired.price_sell, 0);
 await assert.rejects(saveHouseBooking(store.repository, "actor", "1024", { ...repaired, status: "confirmed" }), /เลือกลูกค้า/);
 const cancelled = await saveHouseBooking(store.repository, "actor", "1024", { ...repaired, status: "cancelled" });
 assert.equal(cancelled.status, "cancelled");
});

test("cancel uses persisted values and rejects stale or cross-house requests", async () => {
 const store = memory();
 await assert.rejects(cancelHouseBooking(store.repository, "actor", "999", row.id, row.updated_at), /booking_not_found/);
 await assert.rejects(cancelHouseBooking(store.repository, "actor", "1024", row.id, "old"), /booking_stale/);
 const result = await cancelHouseBooking(store.repository, "actor", "1024", row.id, row.updated_at);
 assert.equal(result.status, "cancelled");
 assert.equal(result.check_in, row.check_in);
 assert.equal(result.price_sell, row.price_sell);
 assert.equal(result.deposit_amount, row.deposit_amount);
});


test("forged cross-house customer IDs cannot create or update bookings", async t => {
 t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-22T00:00:00Z") });
 const store = memory();
 store.repository.ownsCustomer = async () => false;
 await assert.rejects(createHouseBooking(store.repository, "actor", "1024", { ...row, request_id: "00000000-0000-4000-8000-000000000001", customer_id: "42" }), /ลูกค้า/);
 await assert.rejects(saveHouseBooking(store.repository, "actor", "1024", { ...row, customer_id: "42" }), /ลูกค้า/);
});
