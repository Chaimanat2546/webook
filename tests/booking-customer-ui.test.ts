import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const form = readFileSync(new URL("../components/admin/houses/bookings/booking-customer-form.tsx", import.meta.url), "utf8");
const summary = readFileSync(new URL("../components/admin/houses/bookings/booking-customer-summary.tsx", import.meta.url), "utf8");

test("booking customer form uses telephone controls with numeric keyboards for both phone fields", () => {
  assert.match(form, /<Input type="tel" inputMode="numeric"[^>]*autoComplete="tel"/);
  assert.match(form, /field\.key === "secondary_phone"[\s\S]*?<Input type="tel" inputMode="numeric"/);
});

test("booking customer review leaves the saved customer fields without a review heading", () => {
  assert.doesNotMatch(summary, /ตรวจสอบข้อมูลก่อนบันทึก/);
  assert.doesNotMatch(summary, /ClipboardCheck/);
});
