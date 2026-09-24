import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBookingCreate, parseBookingUpdate, nightsBetween, parseBookingRange, bookingEvent } from "../lib/house-bookings.ts";
import { canUseBooking, canAccessHouses } from "../server/auth/admin.ts";

const input = { id: "17", updated_at: "2026-09-18T10:00:00+00:00", check_in: "2026-09-28", check_out: "2026-10-03", customer_id: null, status: "confirmed", quantity: 1, price_max: 6900, price_sell: 3900, deposit_amount: 5000, extra_charge: 0, note: "" };
test("changing dates preserves one total rather than multiplying by nights", () => {
  const result = parseBookingUpdate({ ...input, check_out: "2026-10-04", extra_charge: 725 });
  assert.equal(result.price_max, 6900);
  assert.equal(result.price_sell, 3900);
  assert.equal(result.extra_charge, 725);
  assert.equal(nightsBetween(result.check_in, result.check_out), 6);
});
test("rejects nonexistent dates and nonpositive stays", () => {
  for (const dates of [{ check_in: "2026-02-30" }, { check_out: input.check_in }, { check_out: "2026-09-01" }]) {
    assert.throws(() => parseBookingUpdate({ ...input, ...dates }));
  }
});
test("rejects invalid money, IDs, revisions and status", () => {
  for (const patch of [{ price_sell: Infinity }, { price_max: -1 }, { id: "17 OR 1=1" }, { customer_id: "bad" }, { status: "paid" }, { updated_at: "" }]) {
    assert.throws(() => parseBookingUpdate({ ...input, ...patch }));
  }
});
test("query ranges accept month spillover and reject unlimited ranges", () => {
  assert.deepEqual(parseBookingRange("2026-08-31", "2026-10-12"), { start: "2026-08-31", end: "2026-10-12" });
  assert.throws(() => parseBookingRange("2020-01-01", "2027-01-01"));
});
test("calendar event uses exclusive checkout, stable identity and confirmed red", () => {
  const event = bookingEvent({ ...input, booking_code: "BK17", customer: null, booking_type: "booking", price_max: 0, details: null, listing_id: "house", houseid: "1024", agent_id: null });
  assert.equal(event.id, "17");
  assert.equal(event.start, "2026-09-28");
  assert.equal(event.end, "2026-10-03");
  assert.equal(event.allDay, true);
  assert.equal(event.className, "booking-confirmed");
});
test("booking permission is explicit and independently permits house-list access", () => {
  assert.equal(canUseBooking(null), false);
  assert.equal(canUseBooking({ allow_tools: {} }), false);
  assert.equal(canUseBooking({ allow_tools: { allow_accommodation: true } }), false);
  assert.equal(canUseBooking({ allow_tools: { allow_booking: true } }), true);
  assert.equal(canAccessHouses({ allow_tools: { allow_booking: true } }), true);
});

test("money edits use full price and required deposit, ignoring deposit_amount", () => {
  const result = parseBookingUpdate({ ...input, deposit_amount: 99999 });
  assert.equal(result.price_max, 6900);
  assert.equal(result.price_sell, 3900);
  assert.equal("deposit_amount" in result, false);
  assert.equal(parseBookingUpdate({ ...input, price_max: null }).price_max, null);
});

test("quantity is calculated from nights, ignoring submitted or stale quantities", () => {
  for (const quantity of [undefined, 0, 1, 999, "invalid"]) {
    assert.equal(parseBookingUpdate({ ...input, quantity }).quantity, 5);
    assert.equal(parseBookingUpdate({ ...input, quantity, check_out: "2026-10-04" }).quantity, 6);
  }
  assert.equal(parseBookingUpdate({ ...input, check_in: "2028-02-28", check_out: "2028-03-01" }).quantity, 2);
});

test("creation requires an existing customer reference, full price and stable request ID", () => {
  const draft = { ...input, request_id: "00000000-0000-4000-8000-000000000001", customer_id: "42", status: "waiting" };
  const result = parseBookingCreate(draft);
  assert.equal(result.quantity, 5);
  assert.equal(result.customer_id, "42");
  assert.equal("id" in result, false);
  for (const patch of [{ customer_id: null }, { price_max: null }, { request_id: "bad" }, { status: "cancelled" }]) {
    assert.throws(() => parseBookingCreate({ ...draft, ...patch }));
  }
});

test("repair needs only dates and note and clears customer/money payload", () => {
 const result = parseBookingCreate({ ...input, request_id: "00000000-0000-4000-8000-000000000001", status: "repair", customer_id: null, price_max: null });
 assert.equal(result.customer_id, null);
 assert.equal(result.price_max, 0);
 assert.equal(result.price_sell, 0);
 assert.equal(result.extra_charge, 0);
 assert.equal(result.quantity, 5);
});

test("a new stay cannot save before the user chooses checkout", () => {
 assert.throws(() => parseBookingCreate({ ...input, request_id: "00000000-0000-4000-8000-000000000001", check_in: "2026-09-21", check_out: "", customer_id: "42" }), /วันที่/);
 const selected = parseBookingCreate({ ...input, request_id: "00000000-0000-4000-8000-000000000001", check_in: "2026-09-21", check_out: "2026-09-23", customer_id: "42" });
 assert.equal(selected.quantity, 2);
});
