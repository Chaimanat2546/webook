import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1";
const url = process.env.LOCAL_SUPABASE_URL ?? "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "Quotation-local-test-2026!";
const issueDate = "2099-12-31";
const otherDate = "2099-12-30";

function payload(id: string | null, date = issueDate) {
  return { id, currency: "THB", customer_snapshot: { name: "Customer", address: "Customer address" }, document_discount_type: null, document_discount_value: "0.00", internal_notes: "", issue_date: date, items: [{ position: 1, sku: "", name: "Item", description: "", quantity: "1.000", unit: "งาน", unit_price: "100.00", discount_type: null, discount_value: "0.00", gross_amount: "100.00", discount_amount: "0.00", document_discount_allocation: "0.00", vat_treatment: "taxable", vat_rate: "7.00", taxable_amount: "100.00", vat_amount: "7.00", line_total: "107.00" }], price_mode: "vat_exclusive", public_notes: "", reference: "", seller_snapshot: { name: "Seller", address: "Seller address", taxId: "0100000000000" }, subject: "Integration test", totals: { subtotal: "100.00", itemDiscountTotal: "0.00", documentDiscountTotal: "0.00", taxableTotal: "100.00", vatTotal: "7.00", grandTotal: "107.00" }, valid_until: date, validity_days: 0 };
}

async function save(client: SupabaseClient, value: ReturnType<typeof payload>) {
  const { data, error } = await client.rpc("save_quotation", { p_payload: value });
  assert.equal(error, null, error?.message);
  const row = (data as Array<{ document_number: string; id: string }> | null)?.[0];
  assert.ok(row);
  return row;
}

describe("quotation local database integration", { skip: !enabled }, () => {
  const service = createClient(url || "http://127.0.0.1:54321", serviceRoleKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const allowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const denied = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  let allowedId = "";
  let deniedId = "";

  before(async () => {
    assert.ok(url && anonKey && serviceRoleKey, "local Supabase environment is required");
    const allowedEmail = `quotation-allowed-${crypto.randomUUID()}@example.test`;
    const deniedEmail = `quotation-denied-${crypto.randomUUID()}@example.test`;
    const allowedCreated = await service.auth.admin.createUser({ email: allowedEmail, email_confirm: true, password });
    const deniedCreated = await service.auth.admin.createUser({ email: deniedEmail, email_confirm: true, password });
    assert.equal(allowedCreated.error, null, allowedCreated.error?.message);
    assert.equal(deniedCreated.error, null, deniedCreated.error?.message);
    allowedId = allowedCreated.data.user!.id; deniedId = deniedCreated.data.user!.id;
    const usersInsert = await service.from("users").insert([{ allow_tools: { allow_quotation: true }, email: allowedEmail, uid: allowedId }, { allow_tools: {}, email: deniedEmail, uid: deniedId }]);
    assert.equal(usersInsert.error, null, usersInsert.error?.message);
    assert.equal((await allowed.auth.signInWithPassword({ email: allowedEmail, password })).error, null);
    assert.equal((await denied.auth.signInWithPassword({ email: deniedEmail, password })).error, null);
  });

  after(async () => {
    await service.from("quotations").delete().in("issue_date", [issueDate, otherDate]);
    if (allowedId) await service.from("users").delete().eq("uid", allowedId);
    if (deniedId) await service.from("users").delete().eq("uid", deniedId);
    if (allowedId) await service.auth.admin.deleteUser(allowedId);
    if (deniedId) await service.auth.admin.deleteUser(deniedId);
  });

  it("enforces permission, atomic daily numbers, edit stability, and soft delete", async () => {
    const deniedSave = await denied.rpc("save_quotation", { p_payload: payload(null) });
    assert.equal(deniedSave.error?.code, "42501");
    const created = await Promise.all(Array.from({ length: 12 }, () => save(allowed, payload(null))));
    assert.deepEqual(created.map((row) => row.document_number).sort(), Array.from({ length: 12 }, (_, index) => `QO-20991231-${String(index + 1).padStart(4, "0")}`));
    const first = created.find((row) => row.document_number.endsWith("-0001"))!;
    assert.equal((await save(allowed, payload(first.id, otherDate))).document_number, "QO-20991231-0001");
    assert.equal((await save(allowed, payload(null, otherDate))).document_number, "QO-20991230-0001");
    assert.equal((await allowed.rpc("soft_delete_quotation", { p_id: first.id })).error, null);
    assert.equal((await allowed.from("quotations").select("id").eq("id", first.id)).data?.length, 0);
    assert.equal((await save(allowed, payload(null))).document_number, "QO-20991231-0013");
    assert.deepEqual((await denied.from("quotations").select("id")).data, []);
  });
});
