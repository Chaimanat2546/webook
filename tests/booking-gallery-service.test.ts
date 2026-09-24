import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("both gallery actions and route require booking authorization at their server entry points", () => {
  const action = readFileSync(new URL("../app/admin/bookings/actions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/admin/bookings/page.tsx", import.meta.url), "utf8");
  assert.match(action, /listBookingGalleryHousesAction\(input: unknown\)[\s\S]*?await requireBookingAdmin\(\)/);
  assert.match(action, /listBookingGalleryCalendarsAction\(input: unknown\)[\s\S]*?await requireBookingAdmin\(\)/);
  assert.doesNotMatch(action, /listBookingGalleryAction\(/);
  assert.match(page, /await requireBookingAdmin\(\)/);
});
