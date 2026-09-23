import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCustomerSection } from "../lib/booking-customer-validation.ts";

const empty = { first_name: "", last_name: null, phone: "" };
test("empty sections pass while only populated fields are validated", () => {
  for (const section of ["general", "tax", "contact", "address", "extra"] as const) {
    assert.deepEqual(validateCustomerSection(empty, section, ""), {});
  }
  const errors = validateCustomerSection({ ...empty, phone: "123", email: "bad", secondary_phone: "abc" }, "contact", "");
  assert.deepEqual(Object.keys(errors).sort(), ["email", "phone", "secondary_phone"]);
});
test("section validation ignores errors in other sections", () => {
  assert.deepEqual(validateCustomerSection({ ...empty, phone: "bad", tax_id: "12" }, "general", ""), {});
  assert.deepEqual(Object.keys(validateCustomerSection({ ...empty, phone: "bad", tax_id: "12" }, "tax", "")), ["tax_id"]);
});
test("general validates the Buddhist draft rather than an older stored date", () => {
  assert.ok(validateCustomerSection({ ...empty, date_of_birth: "1992-09-23" }, "general", "31/02/2535").date_of_birth);
  assert.deepEqual(validateCustomerSection(empty, "general", "23/09/2535"), {});
});
