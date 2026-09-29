import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { parseBookingUpdate } from "../lib/house-bookings.ts";
import { createHouseBookingsRepository, mapBooking } from "../server/repositories/house-bookings.ts";
import { bookingHouseInformationValue } from "../lib/booking-house-information.ts";

const booking = {
  id: "1",
  updated_at: "2026-09-28T00:00:00Z",
  check_in: "2026-10-01",
  check_out: "2026-10-03",
  customer_id: "2",
  status: "waiting",
  price_sell: 500,
  price_max: 1500,
  extra_charge: 0,
  note: null,
};

test("booking validation preserves house-information overrides for this booking", () => {
  const result = parseBookingUpdate({
    ...booking,
    extra_beds: 300,
    insurance_fee: 3000,
    checkin_time: "14:00:00",
    checkout_time: "12:00:00",
  });

  assert.deepEqual(
    {
      extra_beds: result.extra_beds,
      insurance_fee: result.insurance_fee,
      checkin_time: result.checkin_time,
      checkout_time: result.checkout_time,
    },
    { extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "12:00:00" },
  );
});

test("booking validation rejects malformed house-information overrides", () => {
  assert.throws(() => parseBookingUpdate({ ...booking, extra_beds: -1, insurance_fee: 0, checkin_time: null, checkout_time: null }), /ยอดเงิน/);
  assert.throws(() => parseBookingUpdate({ ...booking, extra_beds: 0, insurance_fee: 0, checkin_time: "noon", checkout_time: null }), /เวลา/);
});

test("booking repository sends house-information overrides to the booking RPC", async () => {
  let payload: unknown = null;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.includes("/rpc/admin_update_house_booking")) payload = await request.json();
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  } } });
  const repository = createHouseBookingsRepository(client);
  await assert.rejects(() => repository.update({ id: "listing", property_id: "12", title: "test" }, "actor", parseBookingUpdate({
    ...booking, extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00", checkout_time: "12:00",
  })), /booking_not_found/);
  assert.deepEqual((payload as { p_values: Record<string, unknown> }).p_values, {
    check_in: "2026-10-01", check_out: "2026-10-03", customer_id: "2", agent_id: null, status: "waiting", quantity: 2,
    price_sell: 500, price_max: 1500, extra_charge: 0, note: null,
    extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "12:00:00",
  });
});

test("booking repository returns saved house-information overrides", () => {
  const bookingRow = mapBooking({
    id: 1, booking_code: "BK-1", listing_id: "listing", houseid: 12, agent_id: null, customer_id: null, customer: null,
    booking_type: null, status: "waiting", check_in: "2026-10-01", check_out: "2026-10-03", price_sell: 500, price_max: 1500,
    deposit_amount: 0, extra_charge: 0, quantity: 2, details: null, note: null, updated_at: "2026-09-28T00:00:00Z",
    extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "12:00:00",
  });
  assert.deepEqual(
    { extra_beds: bookingRow.extra_beds, insurance_fee: bookingRow.insurance_fee, checkin_time: bookingRow.checkin_time, checkout_time: bookingRow.checkout_time },
    { extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "12:00:00" },
  );
});

test("a cleared booking override stays blank until the editor closes", () => {
  const data = { extra_beds: 300, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "12:00:00" };
  const values = { extra_beds: null, insurance_fee: null, checkin_time: null, checkout_time: null };
  assert.equal(bookingHouseInformationValue(values, data, "extra_beds", false), 300);
  assert.equal(bookingHouseInformationValue(values, data, "extra_beds", true), null);
});
