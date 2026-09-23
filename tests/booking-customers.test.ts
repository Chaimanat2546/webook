import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBookingPhone, parseBookingCustomer } from "../lib/booking-customers.ts";
import { createBookingCustomer, updateBookingCustomer } from "../server/services/booking-customers.ts";

test("customer input allowlists fields and normalizes Thai phone numbers", () => {
  assert.deepEqual(parseBookingCustomer({ first_name: " สมชาย ", last_name: " ", phone: "+66 81-234-5678", created_at: "tampered" }), {
    first_name: "สมชาย", last_name: null, phone: "0812345678",
  });
  assert.equal(normalizeBookingPhone("081 234 5678"), "0812345678");
  for (const phone of ["abc0812345678", "123", "0".repeat(21), "---"]) {
    assert.throws(() => parseBookingCustomer({ first_name: "ทดสอบ", phone }));
  }
  assert.equal(parseBookingCustomer({ first_name: " ", phone: "0812345678" }).first_name, "");
  assert.throws(() => parseBookingCustomer({ first_name: "ก".repeat(101), phone: "0812345678" }));
});

test("blank customers can be created repeatedly without looking up empty phone numbers", async () => {
  assert.deepEqual(parseBookingCustomer({}), { first_name: "", last_name: null, phone: "" });
  let inserts = 0;
  const repository = {
    house: async () => ({ id: "listing", property_id: "1", title: "house" }),
    customersByPhone: async () => { throw new Error("must not search blank phones"); },
    createCustomer: async () => ({ id: String(++inserts), first_name: "", last_name: null, phone: "" }),
  };
  assert.equal((await createBookingCustomer(repository, "1", {})).kind, "created");
  assert.equal((await createBookingCustomer(repository, "1", {})).kind, "created");
  assert.equal(inserts, 2);
});

test("customer creation checks house and returns existing phone matches without inserting", async () => {
  let inserts = 0;
  const customer = { id: "42", first_name: "สมชาย", last_name: null, phone: "0812345678" };
  const repository = {
    house: async (id: string) => id === "1" ? { id: "listing", property_id: "1", title: "house" } : null,
    customersByPhone: async () => [customer],
    createCustomer: async () => { inserts++; return customer; },
  };
  const input = { first_name: "ชื่อใหม่", phone: "+66812345678" };
  await assert.rejects(createBookingCustomer(repository, "2", input), /booking_house_not_found/);
  assert.deepEqual(await createBookingCustomer(repository, "1", input), { kind: "existing", customers: [customer] });
  assert.equal(inserts, 0);
  repository.customersByPhone = async () => [];
  assert.deepEqual(await createBookingCustomer(repository, "1", input), { kind: "created", customer });
  assert.equal(inserts, 1);
});


test("full customer input validates optional details without accepting system fields", () => {
  const base = { first_name: "Test", phone: "0812345678" };
  const result = parseBookingCustomer({ ...base, email: " test@example.com ", address: " A ", vip_status: true, tax_head_office: false, tax_branch_code: "00001", date_of_birth: "2000-02-29", id: "99", updated_at: "tampered" });
  assert.equal(result.email, "test@example.com");
  assert.equal(result.address, "A");
  assert.equal(result.vip_status, true);
  assert.equal(result.tax_branch_code, "00001");
  assert.equal("updated_at" in result, false);
  assert.equal("id" in result, false);
  for (const extra of [{ email: "bad" }, { date_of_birth: "2025-02-30" }, { date_of_birth: "2999-01-01" }, { vip_status: "false" }, { tax_id: "123" }]) {
    assert.throws(() => parseBookingCustomer({ ...base, ...extra }));
  }
  assert.equal(parseBookingCustomer({ ...base, email: "" }).email, null);
});


test("customer edit rejects stale writes and preserves omitted fields", async () => {
  const stored = { id: "42", first_name: "Test", last_name: "Surname", phone: "0812345678", email: "saved@example.com", dv_id: "9", updated_at: "2026-09-22T00:00:00Z" };
  let writes = 0;
  const repository = {
    house: async () => ({ id: "listing", property_id: "1", title: "test" }),
    customerDetail: async () => stored,
    customersByPhone: async () => [stored],
    updateCustomer: async (_house: { property_id: string }, id: string, revision: string | null, input: ReturnType<typeof parseBookingCustomer>) => {
      assert.equal(id, "42"); assert.equal(revision, stored.updated_at); writes++;
      Object.assign(stored, input); return stored;
    },
  };
  await assert.rejects(updateBookingCustomer(repository, "1", "42", "stale", { first_name: "Changed", phone: stored.phone }));
  assert.equal(writes, 0);
  await updateBookingCustomer(repository, "1", "42", stored.updated_at, { first_name: "Changed", phone: stored.phone, dv_id: "hijack" });
  assert.equal(stored.last_name, "Surname"); assert.equal(stored.first_name, "Changed"); assert.equal(stored.email, "saved@example.com"); assert.equal(stored.dv_id, "9");
});

test("branch code remains optional", () => { assert.equal(parseBookingCustomer({ first_name: "Test", phone: "0812345678", tax_head_office: false }).tax_head_office, false); });
