import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1";
const url = process.env.LOCAL_SUPABASE_URL ?? "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "Quotation-local-test-2026!";
const issueDate = "2099-12-31";
const otherDate = new Date(
  Date.UTC(2100, 0, 1) + (Number.parseInt(crypto.randomUUID().slice(0, 8), 16) % 36525) * 86_400_000,
).toISOString().slice(0, 10);
const seller = { name: "Seller", address: "Seller address", taxId: "0100000000000" };

function payload(
  id: string | null,
  date = issueDate,
  sellerSnapshot = seller,
  unit: string | null = "งาน",
) {
  return {
    customer_snapshot: { name: "Customer", address: "Customer address" },
    id,
    internal_notes: "",
    issue_date: date,
    items: [{
      description: "",
      discount_amount: "0.00",
      name: "Item",
      position: 1,
      quantity: "1.000",
      unit,
      unit_price: "100.00",
      vat_rate: "7.00",
      vat_treatment: "taxable",
    }],
    public_notes: "",
    reference: "",
    seller_snapshot: sellerSnapshot,
    subject: "",
    totals: {
      amountDue: "104.00",
      discountTotal: "0.00",
      grandTotal: "107.00",
      grossTotal: "100.00",
      preTaxTotal: "100.00",
      vatTotal: "7.00",
      withholdingTaxTotal: "3.00",
    },
    valid_until: date,
    validity_days: 0,
    withholding_tax_rate: "3.00",
  };
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
  const anonymous = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  let allowedId = "";
  let deniedId = "";
  let originalProfile: Record<string, unknown> | null = null;

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
    const profile = await service.from("quotation_company_profiles").select().eq("id", 1).maybeSingle();
    assert.equal(profile.error, null, profile.error?.message);
    originalProfile = profile.data;
    assert.equal((await allowed.auth.signInWithPassword({ email: allowedEmail, password })).error, null);
    assert.equal((await denied.auth.signInWithPassword({ email: deniedEmail, password })).error, null);
  });

  after(async () => {
    await service.from("quotations").delete().in("issue_date", [issueDate, otherDate]);
    if (originalProfile) await service.from("quotation_company_profiles").upsert(originalProfile);
    else await service.from("quotation_company_profiles").delete().eq("id", 1);
    if (allowedId) await service.from("users").delete().eq("uid", allowedId);
    if (deniedId) await service.from("users").delete().eq("uid", deniedId);
    if (allowedId) await service.auth.admin.deleteUser(allowedId);
    if (deniedId) await service.auth.admin.deleteUser(deniedId);
  });

  it("enforces permission, atomic daily numbers, edit stability, and soft delete", async () => {
    const deniedSave = await denied.rpc("save_quotation", { p_payload: payload(null) });
    assert.equal(deniedSave.error?.code, "42501");
    const created = await Promise.all(Array.from({ length: 12 }, () => save(allowed, payload(null))));
    const dailyNumbers = created.map(({ document_number }) => Number(document_number.slice(document_number.lastIndexOf("-") + 1))).sort((left, right) => left - right);
    assert.deepEqual(dailyNumbers, Array.from({ length: 12 }, (_, index) => dailyNumbers[0] + index));
    const first = created[0];
    assert.equal((await save(allowed, payload(first.id, otherDate))).document_number, first.document_number);
    const otherDay = await Promise.all([save(allowed, payload(null, otherDate)), save(allowed, payload(null, otherDate))]);
    const otherDayNumbers = otherDay.map(({ document_number }) => Number(document_number.slice(document_number.lastIndexOf("-") + 1))).sort((left, right) => left - right);
    assert.deepEqual(otherDayNumbers, [1, 2]);
    assert.equal((await allowed.rpc("soft_delete_quotation", { p_id: first.id })).error, null);
    assert.equal((await allowed.from("quotations").select("id").eq("id", first.id)).data?.length, 0);
    const nextDocumentNumber = (await save(allowed, payload(null))).document_number;
    assert.equal(Number(nextDocumentNumber.slice(nextDocumentNumber.lastIndexOf("-") + 1)), dailyNumbers.at(-1)! + 1);
    assert.deepEqual((await denied.from("quotations").select("id")).data, []);
  });

  it("keeps a saved seller snapshot after the company profile changes", async () => {
    const originalSeller = { ...seller, name: "Snapshot seller" };
    const profileSave = await allowed.from("quotation_company_profiles").upsert({ id: 1, seller_name: originalSeller.name, address: originalSeller.address, tax_id: originalSeller.taxId });
    assert.equal(profileSave.error, null, profileSave.error?.message);
    const created = await save(allowed, payload(null, issueDate, originalSeller));
    const profileChange = await allowed.from("quotation_company_profiles").update({ seller_name: "Changed company profile" }).eq("id", 1);
    assert.equal(profileChange.error, null, profileChange.error?.message);
    const quotation = await allowed.from("quotations").select("seller_snapshot").eq("id", created.id).single();
    assert.equal(quotation.error, null, quotation.error?.message);
    assert.deepEqual(quotation.data.seller_snapshot, originalSeller);
  });

  it("persists a null unit while quantity remains required", async () => {
    const created = await save(allowed, payload(null, issueDate, seller, null));
    const item = await allowed.from("quotation_items").select("quantity,unit").eq("quotation_id", created.id).single();
    assert.equal(item.error, null, item.error?.message);
    assert.equal(item.data.quantity, 1);
    assert.equal(item.data.unit, null);
  });

  it("rejects inconsistent item and quotation money", async () => {
    const excessiveDiscount = payload(null);
    excessiveDiscount.items[0]!.discount_amount = "100.01";
    assert.equal((await allowed.rpc("save_quotation", { p_payload: excessiveDiscount })).error?.code, "23514");

    const hiddenVat = payload(null);
    hiddenVat.items[0]!.vat_treatment = "none";
    assert.equal((await allowed.rpc("save_quotation", { p_payload: hiddenVat })).error?.code, "23514");

    const inconsistentTotals = payload(null);
    inconsistentTotals.totals.preTaxTotal = "99.00";
    assert.equal((await allowed.rpc("save_quotation", { p_payload: inconsistentTotals })).error?.code, "23514");

    const inconsistentItems = payload(null);
    inconsistentItems.totals = {
      amountDue: "1.04",
      discountTotal: "0.00",
      grandTotal: "1.07",
      grossTotal: "1.00",
      preTaxTotal: "1.00",
      vatTotal: "0.07",
      withholdingTaxTotal: "0.03",
    };
    assert.equal((await allowed.rpc("save_quotation", { p_payload: inconsistentItems })).error?.code, "23514");

    const precisionBypass = payload(null);
    precisionBypass.items[0]!.discount_amount = "0.004";
    precisionBypass.items.push({ ...precisionBypass.items[0]!, position: 2 });
    precisionBypass.totals = {
      amountDue: "207.992",
      discountTotal: "0.008",
      grandTotal: "213.992",
      grossTotal: "200.00",
      preTaxTotal: "199.992",
      vatTotal: "14.00",
      withholdingTaxTotal: "6.00",
    };
    assert.equal((await allowed.rpc("save_quotation", { p_payload: precisionBypass })).error?.code, "23514");
  });

  it("requires 1 to 100 items", async () => {
    const nonArray = { ...payload(null), items: {} };
    assert.equal((await allowed.rpc("save_quotation", { p_payload: nonArray })).error?.code, "22023");

    const empty = payload(null);
    empty.items = [];
    assert.equal((await allowed.rpc("save_quotation", { p_payload: empty })).error?.code, "22023");

    const excessive = payload(null);
    excessive.items = Array.from({ length: 101 }, (_, index) => ({
      ...excessive.items[0]!,
      position: index + 1,
    }));
    assert.equal((await allowed.rpc("save_quotation", { p_payload: excessive })).error?.code, "22023");
  });

  it("persists withholding and exposes only saved public data", async () => {
    const created = await save(allowed, payload(null));
    const stored = await allowed
      .from("quotations")
      .select("public_token,withholding_tax_rate,withholding_tax_total,amount_due")
      .eq("id", created.id)
      .single();
    assert.equal(stored.error, null, stored.error?.message);
    assert.equal(stored.data.withholding_tax_rate, 3);
    assert.equal(stored.data.withholding_tax_total, 3);
    assert.equal(stored.data.amount_due, 104);

    const publicRead = await anonymous.rpc("get_public_quotation", {
      p_token: stored.data.public_token,
    });
    assert.equal(publicRead.error, null, publicRead.error?.message);
    assert.equal(publicRead.data.document_number, created.document_number);
    assert.equal("internal_notes" in publicRead.data, false);
    assert.deepEqual(Object.keys(publicRead.data.customer_snapshot).sort(), [
      "address", "branchNumber", "name", "officeType", "taxId",
    ]);

    const updated = payload(created.id);
    updated.reference = "LATEST-SAVED";
    await save(allowed, updated);
    const latest = await anonymous.rpc("get_public_quotation", {
      p_token: stored.data.public_token,
    });
    assert.equal(latest.data.reference, "LATEST-SAVED");

    await allowed.rpc("soft_delete_quotation", { p_id: created.id });
    const deleted = await anonymous.rpc("get_public_quotation", {
      p_token: stored.data.public_token,
    });
    assert.equal(deleted.data, null);
  });
});
