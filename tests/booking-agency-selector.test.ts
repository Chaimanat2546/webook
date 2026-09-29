import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingAgencyChoices } from "../lib/booking-agency.ts";

test("an administrator receives active agency choices and retains an existing selection", () => {
  assert.deepEqual(
    bookingAgencyChoices(true, [{ id: "2", name: "North Agency" }], "9"),
    [
      { id: "", label: "ไม่ระบุเอเจนซี่" },
      { id: "2", label: "North Agency" },
      { id: "9", label: "เอเจนซี่เดิม #9" },
    ],
  );
});

test("a non-administrator receives no agency choices", () => {
  assert.deepEqual(bookingAgencyChoices(false, [{ id: "2", name: "North Agency" }], null), []);
});
