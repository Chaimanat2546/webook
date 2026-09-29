import assert from "node:assert/strict";
import { test } from "node:test";

import { bookingAgencyChoices } from "../lib/booking-agency.ts";
import { parseBookingUpdate } from "../lib/house-bookings.ts";

test("administrator choices include active Agents, an empty choice, and an inactive historic Agent", () => {
  assert.deepEqual(
    bookingAgencyChoices(true, [{ id: "101", name: "Active Agent" }], "99"),
    [
      { id: "", label: "ไม่ระบุเอเจนซี่" },
      { id: "101", label: "Active Agent" },
      { id: "99", label: "เอเจนซี่เดิม #99" },
    ],
  );
  assert.deepEqual(bookingAgencyChoices(false, [{ id: "101", name: "Active Agent" }], null), []);
});

test("booking update parses only a safe numeric Agent ID", () => {
  const base = {
    id: "1", updated_at: "2026-09-29T00:00:00Z", check_in: "2026-10-01", check_out: "2026-10-02",
    customer_id: "2", status: "waiting", quantity: 1, price_sell: 1, price_max: 1, extra_charge: 0,
    note: null, insurance: null, extra_person: null, checkin_time: null, checkout_time: null,
  };
  assert.equal(parseBookingUpdate({ ...base, agent_id: "101" }).agent_id, "101");
  assert.throws(() => parseBookingUpdate({ ...base, agent_id: "bad-agent" }), /รหัสข้อมูล/);
});
