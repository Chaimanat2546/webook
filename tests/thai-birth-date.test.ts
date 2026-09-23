import assert from "node:assert/strict";
import { test } from "node:test";
import { formatThaiBirthDate, parseThaiBirthDate } from "../lib/thai-birth-date.ts";
import { parseBookingCustomer } from "../lib/booking-customers.ts";

test("stored Gregorian birthdays display as Thai Buddhist dates without timezone shifts", () => {
  assert.equal(formatThaiBirthDate("1992-09-23"), "23/09/2535");
  assert.equal(formatThaiBirthDate("2000-02-29"), "29/02/2543");
  assert.equal(formatThaiBirthDate(null), "");
  assert.equal(formatThaiBirthDate(undefined), "");
});

test("Thai birthday input produces a Gregorian customer payload and can be cleared", () => {
  const birthday = parseThaiBirthDate("23/09/2535", "2026-09-23");
  assert.equal(birthday, "1992-09-23");
  assert.equal(parseBookingCustomer({ first_name: "Test", phone: "0812345678", date_of_birth: birthday }).date_of_birth, "1992-09-23");
  assert.equal(parseThaiBirthDate("", "2026-09-23"), null);
  assert.equal(parseThaiBirthDate("  ", "2026-09-23"), null);
});

test("birthdays validate leap days against the Gregorian year and reject malformed dates", () => {
  assert.equal(parseThaiBirthDate("29/02/2543", "2026-09-23"), "2000-02-29");
  for (const input of ["29/02/2544", "31/04/2535", "00/09/2535", "23/13/2535", "23/09/25", "1992-09-23", "abc", "01/01/0543"]) {
    assert.throws(() => parseThaiBirthDate(input, "2026-09-23"), Error, input);
  }
});

test("today is a valid birthday but tomorrow is not", () => {
  assert.equal(parseThaiBirthDate("23/09/2569", "2026-09-23"), "2026-09-23");
  assert.throws(() => parseThaiBirthDate("24/09/2569", "2026-09-23"));
});
