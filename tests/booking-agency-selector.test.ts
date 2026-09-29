import assert from "node:assert/strict";
import { test } from "node:test";

import { bookingAgencyChoices } from "../lib/booking-agency.ts";
import { parseBookingUpdate } from "../lib/house-bookings.ts";

test("administrator choices include active Agents, an empty choice, and an inactive historic Agent", () => {
  const activeId = "00000000-0000-4000-8000-000000000101";
  const historicId = "00000000-0000-4000-8000-000000000199";
  assert.deepEqual(
    bookingAgencyChoices(true, [{ id: activeId, name: "Active Agent" }], historicId),
    [
      { id: "", label: "ไม่ระบุเอเจนซี่" },
      { id: activeId, label: "Active Agent" },
      { id: historicId, label: `เอเจนซี่เดิม #${historicId}` },
    ],
  );
  assert.deepEqual(bookingAgencyChoices(false, [{ id: activeId, name: "Active Agent" }], null), []);
});

test("booking update parses only a safe UUID Agent ID", () => {
  const base = {
    id: "1", updated_at: "2026-09-29T00:00:00Z", check_in: "2026-10-01", check_out: "2026-10-02",
    customer_id: "2", status: "waiting", quantity: 1, price_sell: 1, price_max: 1, extra_charge: 0,
    note: null, insurance: null, extra_person: null, checkin_time: null, checkout_time: null,
  };
  const agentId = "00000000-0000-4000-8000-000000000101";
  assert.equal(parseBookingUpdate({ ...base, agent_id: agentId }).agent_id, agentId);
  assert.throws(() => parseBookingUpdate({ ...base, agent_id: "101" }), /รหัสเอเจนซี่/);
  assert.throws(() => parseBookingUpdate({ ...base, agent_id: "bad-agent" }), /รหัสเอเจนซี่/);
});
