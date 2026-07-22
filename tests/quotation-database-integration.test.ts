import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1"
  || process.env.RUN_QUOTATION_DB_TESTS === "1";
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
    certification_snapshot: {
      approver: { name: null, position: null, signature_url: null },
      company_stamp_url: null,
      issuer: { name: "Issuer", position: "Sales", signature_url: null },
    },
    customer_snapshot: { name: "Customer", address: "Customer address" },
    company_profile_id: null as string | null,
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
    payment_methods: [] as Array<Record<string, unknown>>,
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

async function saveWithPayments(client: SupabaseClient, value: ReturnType<typeof payload>) {
  const { data, error } = await client.rpc("save_quotation_with_payments", { p_payload: value });
  assert.equal(error, null, error?.message);
  const row = (data as Array<{ document_number: string; id: string }> | null)?.[0];
  assert.ok(row);
  return row;
}

describe("quotation local database integration", { skip: !enabled }, () => {
  it("grants authenticated users SELECT-only snapshot table privileges", () => {
    const privileges = execFileSync("docker", [
      "exec", "supabase_db_webook", "psql", "-U", "postgres", "-d", "postgres", "-Atqc",
      "select has_table_privilege('authenticated', 'public.quotation_payment_methods', 'SELECT'), has_table_privilege('authenticated', 'public.quotation_payment_methods', 'INSERT'), has_table_privilege('authenticated', 'public.quotation_payment_methods', 'UPDATE'), has_table_privilege('authenticated', 'public.quotation_payment_methods', 'DELETE'), has_table_privilege('authenticated', 'public.quotation_payment_methods', 'TRUNCATE');",
    ], { encoding: "utf8" }).trim();
    assert.equal(privileges, "t|f|f|f|f");
  });
  const service = createClient(url || "http://127.0.0.1:54321", serviceRoleKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const allowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const denied = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const otherAllowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  const anonymous = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", { auth: { autoRefreshToken: false, persistSession: false } });
  let allowedId = "";
  let deniedId = "";
  let otherAllowedId = "";
  let allowedProfileId = "";
  let otherAllowedProfileId = "";
  let originalAssetOrigin: string | null = null;

  before(async () => {
    assert.ok(url && anonKey && serviceRoleKey, "local Supabase environment is required");
    originalAssetOrigin = execFileSync("docker", [
      "exec", "supabase_db_webook", "psql", "-U", "postgres", "-d", "postgres", "-Atqc",
      "select coalesce((select origin from private.quotation_payment_asset_config where singleton), '');",
    ], { encoding: "utf8" }).trim() || null;
    const allowedEmail = `quotation-allowed-${crypto.randomUUID()}@example.test`;
    const deniedEmail = `quotation-denied-${crypto.randomUUID()}@example.test`;
    const otherAllowedEmail = `quotation-other-allowed-${crypto.randomUUID()}@example.test`;
    const allowedCreated = await service.auth.admin.createUser({ email: allowedEmail, email_confirm: true, password });
    const deniedCreated = await service.auth.admin.createUser({ email: deniedEmail, email_confirm: true, password });
    const otherAllowedCreated = await service.auth.admin.createUser({ email: otherAllowedEmail, email_confirm: true, password });
    assert.equal(allowedCreated.error, null, allowedCreated.error?.message);
    assert.equal(deniedCreated.error, null, deniedCreated.error?.message);
    assert.equal(otherAllowedCreated.error, null, otherAllowedCreated.error?.message);
    allowedId = allowedCreated.data.user!.id; deniedId = deniedCreated.data.user!.id; otherAllowedId = otherAllowedCreated.data.user!.id;
    const usersInsert = await service.from("users").insert([{ allow_tools: { allow_quotation: true }, email: allowedEmail, uid: allowedId }, { allow_tools: {}, email: deniedEmail, uid: deniedId }, { allow_tools: { allow_quotation: true }, email: otherAllowedEmail, uid: otherAllowedId }]);
    assert.equal(usersInsert.error, null, usersInsert.error?.message);
    assert.equal((await allowed.auth.signInWithPassword({ email: allowedEmail, password })).error, null);
    assert.equal((await denied.auth.signInWithPassword({ email: deniedEmail, password })).error, null);
    assert.equal((await otherAllowed.auth.signInWithPassword({ email: otherAllowedEmail, password })).error, null);
    const allowedProfile = await allowed.from("quotation_company_profiles").insert({ seller_name: "Allowed seller", address: "Allowed address", tax_id: "0100000000000" }).select("id").single();
    const otherAllowedProfile = await otherAllowed.from("quotation_company_profiles").insert({ seller_name: "Other seller", address: "Other address", tax_id: "0200000000000" }).select("id").single();
    assert.equal(allowedProfile.error, null, allowedProfile.error?.message);
    assert.equal(otherAllowedProfile.error, null, otherAllowedProfile.error?.message);
    allowedProfileId = allowedProfile.data.id;
    otherAllowedProfileId = otherAllowedProfile.data.id;
    const clearedAssetOrigin = await service.rpc("configure_quotation_payment_asset_origin", {
      p_origin: null,
    });
    assert.equal(clearedAssetOrigin.error, null, clearedAssetOrigin.error?.message);
  });

  after(async () => {
    await service.from("quotations").delete().in("issue_date", [issueDate, otherDate]);
    await service.from("quotation_company_profiles").delete().in("user_id", [allowedId, otherAllowedId]);
    if (allowedId) await service.from("users").delete().eq("uid", allowedId);
    if (deniedId) await service.from("users").delete().eq("uid", deniedId);
    if (otherAllowedId) await service.from("users").delete().eq("uid", otherAllowedId);
    if (allowedId) await service.auth.admin.deleteUser(allowedId);
    if (deniedId) await service.auth.admin.deleteUser(deniedId);
    if (otherAllowedId) await service.auth.admin.deleteUser(otherAllowedId);
    const restoredAssetOrigin = await service.rpc("configure_quotation_payment_asset_origin", {
      p_origin: originalAssetOrigin,
    });
    assert.equal(restoredAssetOrigin.error, null, restoredAssetOrigin.error?.message);
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
    const profileSave = await allowed.from("quotation_company_profiles").update({ seller_name: originalSeller.name, address: originalSeller.address, tax_id: originalSeller.taxId }).eq("id", allowedProfileId);
    assert.equal(profileSave.error, null, profileSave.error?.message);
    const created = await save(allowed, payload(null, issueDate, originalSeller));
    const profileChange = await allowed.from("quotation_company_profiles").update({ seller_name: "Changed company profile" }).eq("id", allowedProfileId);
    assert.equal(profileChange.error, null, profileChange.error?.message);
    const quotation = await allowed.from("quotations").select("seller_snapshot").eq("id", created.id).single();
    assert.equal(quotation.error, null, quotation.error?.message);
    assert.deepEqual(quotation.data.seller_snapshot, originalSeller);
  });

  it("persists certification snapshots independently of profile changes and public reads", async () => {
    const createdPayload = payload(null);
    createdPayload.internal_notes = "private certification note";
    const created = await saveWithPayments(allowed, createdPayload);
    const stored = await allowed
      .from("quotations")
      .select("certification_snapshot,public_token")
      .eq("id", created.id)
      .single();
    assert.equal(stored.error, null, stored.error?.message);
    const changedCertification = {
      ...createdPayload.certification_snapshot,
      issuer: { ...createdPayload.certification_snapshot.issuer, name: "Changed issuer" },
    };
    assert.equal((await allowed.rpc("save_quotation_company_certification", {
      p_value: changedCertification,
    })).error, null);
    const changedProfile = await allowed.from("quotation_company_profiles")
      .select("issuer_name").eq("id", allowedProfileId).single();
    assert.equal(changedProfile.error, null, changedProfile.error?.message);
    assert.equal(changedProfile.data.issuer_name, "Changed issuer");
    assert.deepEqual(stored.data.certification_snapshot, createdPayload.certification_snapshot);

    const publicRead = await anonymous.rpc("get_public_quotation", {
      p_token: stored.data.public_token,
    });
    assert.equal(publicRead.error, null, publicRead.error?.message);
    assert.deepEqual(publicRead.data.certification_snapshot, createdPayload.certification_snapshot);
    assert.equal("internal_notes" in publicRead.data, false);

    assert.equal((await allowed.rpc("soft_delete_quotation", { p_id: created.id })).error, null);
    const deleted = await anonymous.rpc("get_public_quotation", {
      p_token: stored.data.public_token,
    });
    assert.equal(deleted.error, null, deleted.error?.message);
    assert.equal(deleted.data, null);
  });

  it("validates certification masters and snapshots at the database boundary", async () => {
    const origin = "https://webook-media.example.workers.dev";
    const assetKey = "123e4567-e89b-42d3-a456-426614174000.png";
    assert.equal((await service.rpc("configure_quotation_payment_asset_origin", {
      p_origin: origin,
    })).error, null);
    const trustedUrl = `${origin}/quotations/certification-assets/${assetKey}`;
    const certification = {
      approver: { name: " Approver ", position: " Director ", signature_url: trustedUrl },
      company_stamp_url: trustedUrl,
      issuer: { name: " Issuer ", position: " Sales ", signature_url: trustedUrl },
    };
    const savedMaster = await allowed.rpc("save_quotation_company_certification", {
      p_value: certification,
    });
    assert.equal(savedMaster.error, null, savedMaster.error?.message);
    const storedMaster = await allowed.from("quotation_company_profiles")
      .select("issuer_name,issuer_position,issuer_signature_url,approver_name,approver_position,approver_signature_url,company_stamp_url")
      .eq("id", allowedProfileId).single();
    assert.equal(storedMaster.error, null, storedMaster.error?.message);
    assert.deepEqual(storedMaster.data, {
      approver_name: "Approver", approver_position: "Director", approver_signature_url: trustedUrl,
      company_stamp_url: trustedUrl,
      issuer_name: "Issuer", issuer_position: "Sales", issuer_signature_url: trustedUrl,
    });

    assert.equal((await allowed.from("quotation_company_profiles")
      .update({ issuer_name: "Direct bypass" }).eq("id", allowedProfileId)).error?.code, "42501");
    assert.equal((await allowed.from("quotation_company_profiles").insert({
      issuer_name: "Direct bypass", user_id: allowedId,
    })).error?.code, "42501");
    assert.equal((await allowed.from("quotation_company_profiles")
      .update({ address: "Validated seller update" }).eq("id", allowedProfileId)).error, null);
    const sellerUpdate = await allowed.from("quotation_company_profiles")
      .select("address").eq("id", allowedProfileId).single();
    assert.equal(sellerUpdate.error, null, sellerUpdate.error?.message);
    assert.equal(sellerUpdate.data.address, "Validated seller update");

    const trustedSnapshot = {
      ...payload(null),
      certification_snapshot: certification,
    };
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: trustedSnapshot,
    })).error, null);

    const invalidUrl = (url: string) => ({
      ...certification,
      company_stamp_url: url,
    });
    for (const invalid of [
      invalidUrl(`https://foreign.example/quotations/certification-assets/${assetKey}`),
      invalidUrl(`${origin}/quotations/payment-assets/${assetKey}`),
      invalidUrl(`${trustedUrl}?tracking=1`),
      invalidUrl(`${origin}/quotations/certification-assets/not-a-uuid.png`),
      { ...certification, issuer: { ...certification.issuer, name: "x".repeat(201) } },
      { ...certification, company_stamp_url: "x".repeat(2049) },
    ]) {
      assert.equal((await allowed.rpc("save_quotation_company_certification", {
        p_value: invalid,
      })).error?.code, "22023");
    }

    const nonStringLeaf = (
      section: "approver" | "issuer" | "root",
      key: string,
      value: unknown,
    ) => {
      const invalid = structuredClone(certification) as Record<string, unknown>;
      if (section === "root") invalid[key] = value;
      else (invalid[section] as Record<string, unknown>)[key] = value;
      return invalid;
    };
    for (const invalid of [
      nonStringLeaf("issuer", "name", 7),
      nonStringLeaf("issuer", "position", false),
      nonStringLeaf("issuer", "signature_url", []),
      nonStringLeaf("approver", "name", {}),
      nonStringLeaf("approver", "position", 7),
      nonStringLeaf("approver", "signature_url", true),
      nonStringLeaf("root", "company_stamp_url", []),
    ]) {
      assert.equal((await allowed.rpc("save_quotation_company_certification", {
        p_value: invalid,
      })).error?.code, "22023");
    }

    const invalidSnapshot = {
      ...payload(null),
      certification_snapshot: nonStringLeaf("issuer", "name", 7),
    };
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: invalidSnapshot,
    })).error?.code, "22023");
    assert.equal((await denied.rpc("save_quotation_company_certification", {
      p_value: nonStringLeaf("issuer", "name", 7),
    })).error?.code, "42501");
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

  it("isolates seller, masters, quotations, and public payment snapshots by owner", async () => {
    const bank = await service.from("banks").select("id,code,name,logo_path").eq("code", "004").single();
    assert.equal(bank.error, null, bank.error?.message);
    const masterMethod = { account_name: "Allowed seller", account_number: "137-1-17528-4", account_type: "current", bank_id: bank.data.id, id: crypto.randomUUID(), instructions: "", is_default: true, position: 9, promptpay_id: "", provider_name: "", qr_image_url: "", qr_mode: "none", type: "bank_transfer" };
    const master = await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [masterMethod],
    });
    assert.equal(master.error, null, master.error?.message);
    const masterId = (master.data as Array<{ id: string }>)[0]!.id;
    const storedMaster = await allowed.from("quotation_company_payment_methods").select("account_type").eq("id", masterId).single();
    assert.equal(storedMaster.error, null, storedMaster.error?.message);
    assert.equal(storedMaster.data.account_type, "current");
    assert.equal((await allowed.from("quotation_company_payment_methods").insert({ id: crypto.randomUUID(), user_id: allowedId, type: "cash", position: 99 })).error?.code, "42501");
    assert.equal((await allowed.from("quotation_company_payment_methods").update({ instructions: "bypass" }).eq("id", masterId)).error?.code, "42501");
    assert.equal((await allowed.from("quotation_company_payment_methods").delete().eq("id", masterId)).error?.code, "42501");
    assert.equal((await otherAllowed.from("quotation_company_profiles").select("id")).data?.some((row) => row.id === allowedProfileId), false);
    assert.deepEqual((await otherAllowed.from("quotation_company_profiles")
      .select("issuer_name,approver_name,company_stamp_url")
      .eq("id", allowedProfileId)).data, []);
    const crossAccountCertificationUpdate = await otherAllowed
      .from("quotation_company_profiles")
      .update({ issuer_name: "Cross-account issuer" })
      .eq("id", allowedProfileId)
      .select("issuer_name");
    assert.equal(crossAccountCertificationUpdate.error?.code, "42501");
    const allowedCertificationProfile = await allowed.from("quotation_company_profiles")
      .select("issuer_name").eq("id", allowedProfileId).single();
    assert.equal(allowedCertificationProfile.error, null, allowedCertificationProfile.error?.message);
    assert.notEqual(allowedCertificationProfile.data.issuer_name, "Cross-account issuer");
    assert.deepEqual((await otherAllowed.from("quotation_company_payment_methods").select("id")).data, []);

    const createdPayload = payload(null);
    createdPayload.company_profile_id = allowedProfileId;
    const publicAssetOrigin = "https://webook-media.example.workers.dev";
    assert.equal((await service.rpc("configure_quotation_payment_asset_origin", { p_origin: publicAssetOrigin })).error, null);
    const qrImage = `${publicAssetOrigin}/quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png`;
    createdPayload.payment_methods = [
      { account_name: "Allowed seller", account_number: "137-1-17528-4", account_type: "current", bank_id: bank.data.id, bank_code: "004", bank_logo_url: "/quotation/banks/kbank.svg", bank_name: bank.data.name, custom_bank_logo_url: "", custom_bank_name: "", id: crypto.randomUUID(), instructions: "", position: 7, promptpay_id: "", provider_name: "", qr_image_url: "", qr_mode: "none", type: "bank_transfer" },
      { account_name: "Allowed seller", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "", id: crypto.randomUUID(), instructions: "", position: 8, promptpay_id: "0812345678", provider_name: "", qr_image_url: "", qr_mode: "auto_promptpay", type: "promptpay" },
      { account_name: "", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "", id: crypto.randomUUID(), instructions: "", position: 9, promptpay_id: "", provider_name: "Provider", qr_image_url: qrImage, qr_mode: "upload", type: "qr_payment" },
      { account_name: "", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "", id: crypto.randomUUID(), instructions: "Cashier", position: 10, promptpay_id: "", provider_name: "", qr_image_url: "", qr_mode: "none", type: "cash" },
      { account_name: "", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "", id: crypto.randomUUID(), instructions: "", position: 11, promptpay_id: "", provider_name: "Cheque", qr_image_url: "", qr_mode: "none", type: "other" },
    ];
    const created = await saveWithPayments(allowed, createdPayload);
    const changedMaster = await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [{ ...masterMethod, account_type: "fixed" }],
    });
    assert.equal(changedMaster.error, null, changedMaster.error?.message);
    const changedStoredMaster = await allowed.from("quotation_company_payment_methods").select("account_type").eq("id", masterId).single();
    assert.equal(changedStoredMaster.error, null, changedStoredMaster.error?.message);
    assert.equal(changedStoredMaster.data.account_type, "fixed");
    const snapshotRows = await allowed.from("quotation_payment_methods").select("id,account_type,type").eq("quotation_id", created.id);
    assert.equal(snapshotRows.error, null, snapshotRows.error?.message);
    assert.equal(snapshotRows.data?.find((method) => method.type === "bank_transfer")?.account_type, "current");
    const snapshotId = snapshotRows.data?.[0]?.id;
    assert.ok(snapshotId);
    assert.equal((await allowed.from("quotation_payment_methods").insert({ id: crypto.randomUUID(), quotation_id: created.id, type: "cash", position: 99 })).error?.code, "42501");
    assert.equal((await allowed.from("quotation_payment_methods").update({ instructions: "bypass" }).eq("id", snapshotId)).error?.code, "42501");
    assert.equal((await allowed.from("quotation_payment_methods").delete().eq("id", snapshotId)).error?.code, "42501");
    assert.deepEqual((await otherAllowed.from("quotations").select("id")).data, []);

    const crossAccountUpdate = payload(created.id);
    crossAccountUpdate.company_profile_id = otherAllowedProfileId;
    assert.equal((await otherAllowed.rpc("save_quotation_with_payments", { p_payload: crossAccountUpdate })).error?.code, "P0002");
    assert.equal((await otherAllowed.rpc("soft_delete_quotation", { p_id: created.id })).error?.code, "P0002");

    const stored = await allowed.from("quotations").select("public_token").eq("id", created.id).single();
    assert.equal(stored.error, null, stored.error?.message);
    const publicRead = await anonymous.rpc("get_public_quotation", { p_token: stored.data.public_token });
    assert.equal(publicRead.error, null, publicRead.error?.message);
    assert.equal("internal_notes" in publicRead.data, false);
    assert.deepEqual(publicRead.data.quotation_payment_methods.map((method: { position: number }) => method.position), [1, 2, 3, 4, 5]);
    for (const method of publicRead.data.quotation_payment_methods) {
      assert.equal("internal_notes" in method, false);
      if (method.type === "bank_transfer") assert.equal(method.account_type, "current");
      if (method.type !== "bank_transfer") assert.equal(method.account_type, "");
      if (method.type !== "bank_transfer") assert.equal(method.account_number, "");
      if (method.type !== "promptpay") assert.equal(method.promptpay_id, "");
      if (!['qr_payment', 'other'].includes(method.type)) assert.equal(method.provider_name, "");
    }
  });

  it("allows empty payment data without an asset-origin configuration", async () => {
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [] })).error, null);
    const noAssetSnapshot = payload(null);
    noAssetSnapshot.payment_methods = [];
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: noAssetSnapshot,
    })).error, null);
  });

  it("reports missing payment asset origin through master and snapshot RPCs", async () => {
    assert.equal((await service.rpc("configure_quotation_payment_asset_origin", { p_origin: null })).error, null);
    const paymentKey = "123e4567-e89b-42d3-a456-426614174000.png";
    const unconfiguredUrl = `https://webook-media.example.workers.dev/quotations/payment-assets/${paymentKey}`;
    const paymentMethod = (url: string) => ({
      account_name: "", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "",
      id: crypto.randomUUID(), instructions: "", is_default: false, position: 1, promptpay_id: "",
      provider_name: "PromptPay", qr_image_url: url, qr_mode: "upload", type: "qr_payment",
    });
    const masterError = (await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(unconfiguredUrl)],
    })).error;
    assert.equal(masterError?.code, "P0001");
    assert.equal(masterError?.message, "quotation_payment_asset_origin_not_configured");
    const snapshot = payload(null);
    snapshot.payment_methods = [paymentMethod(unconfiguredUrl)];
    const snapshotError = (await allowed.rpc("save_quotation_with_payments", {
      p_payload: snapshot,
    })).error;
    assert.equal(snapshotError?.code, "P0001");
    assert.equal(snapshotError?.message, "quotation_payment_asset_origin_not_configured");
  });

  it("rejects external payment media through direct master and snapshot RPC calls", async () => {
    const paymentKey = "123e4567-e89b-42d3-a456-426614174000.png";
    const trustedUrl = `https://webook-media.example.workers.dev/quotations/payment-assets/${paymentKey}`;
    const paymentMethod = (url: string) => ({
      account_name: "", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "",
      id: crypto.randomUUID(), instructions: "", is_default: false, position: 1, promptpay_id: "",
      provider_name: "PromptPay", qr_image_url: url, qr_mode: "upload", type: "qr_payment",
    });

    const assetOrigin = await service.rpc("configure_quotation_payment_asset_origin", {
      p_origin: "https://webook-media.example.workers.dev",
    });
    assert.equal(assetOrigin.error, null, assetOrigin.error?.message);

    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod("https://tracker.example/payment.png")],
    })).error?.code, "22023");
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(`https://webook-media.other.workers.dev/quotations/payment-assets/${paymentKey}`)],
    })).error?.code, "22023");
    assert.equal((await allowed.rpc("configure_quotation_payment_asset_origin", {
      p_origin: "https://attacker.example",
    })).error?.code, "42501");
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(trustedUrl)],
    })).error, null);
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(`${trustedUrl}x`)],
    })).error?.code, "22023");
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(`${trustedUrl}?tracking=1`)],
    })).error?.code, "22023");

    const externalSnapshot = payload(null);
    externalSnapshot.payment_methods = [paymentMethod("https://tracker.example/payment.png")];
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: externalSnapshot,
    })).error?.code, "22023");

    const trustedSnapshot = payload(null);
    trustedSnapshot.payment_methods = [paymentMethod(trustedUrl)];
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: trustedSnapshot,
    })).error, null);

    const customOrigin = "https://media.poolvilla.example";
    assert.equal((await service.rpc("configure_quotation_payment_asset_origin", {
      p_origin: customOrigin,
    })).error, null);
    const customUrl = `${customOrigin}/quotations/payment-assets/${paymentKey}`;
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", {
      p_methods: [paymentMethod(customUrl)],
    })).error, null);
    const customSnapshot = payload(null);
    customSnapshot.payment_methods = [paymentMethod(customUrl)];
    assert.equal((await allowed.rpc("save_quotation_with_payments", {
      p_payload: customSnapshot,
    })).error, null);
  });

  it("normalizes PromptPay and rejects duplicate, hidden, oversized, and invalid automatic methods at the database boundary", async () => {
    const prompt = {
      account_name: "Allowed seller", account_number: "", bank_id: null, custom_bank_logo_url: "", custom_bank_name: "",
      id: crypto.randomUUID(), instructions: "", is_default: false, position: 1, promptpay_id: "081-234-5678",
      provider_name: "", qr_image_url: "", qr_mode: "auto_promptpay", type: "promptpay",
    };
    const normalized = await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [prompt] });
    assert.equal(normalized.error, null, normalized.error?.message);
    assert.equal((normalized.data as Array<{ promptpay_id: string }>)[0]?.promptpay_id, "0812345678");
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [prompt, prompt] })).error?.code, "22023");
    const hiddenPrompt = await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [{ ...prompt, account_number: "hidden", bank_code: "hidden", custom_bank_name: "hidden", provider_name: "hidden" }] });
    assert.equal(hiddenPrompt.error, null, hiddenPrompt.error?.message);
    assert.deepEqual(
      Object.fromEntries(["account_number", "custom_bank_name", "provider_name"].map((key) => [key, (hiddenPrompt.data as Array<Record<string, unknown>>)[0]?.[key]])),
      { account_number: "", custom_bank_name: "", provider_name: "" },
    );
    assert.equal((await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [{ ...prompt, instructions: "x".repeat(2001) }] })).error?.code, "22023");

    for (const required of [
      { ...prompt, account_name: "   " },
      { ...prompt, promptpay_id: "   " },
      { ...prompt, id: crypto.randomUUID(), provider_name: "   ", qr_image_url: "hidden", qr_mode: "none", type: "other" },
      { ...prompt, account_name: "", id: crypto.randomUUID(), provider_name: "   ", qr_image_url: "hidden", qr_mode: "none", type: "qr_payment" },
    ]) {
      assert.equal((await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [required] })).error?.code, "22023");
    }

    const bank = await service.from("banks").select("id").eq("code", "004").single();
    assert.equal(bank.error, null, bank.error?.message);
    const builtIn = await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [{
      ...prompt, account_number: " 123-4 ", bank_id: bank.data.id, custom_bank_logo_url: "https://ignored.example/logo.png",
      custom_bank_name: " Hidden custom ", id: crypto.randomUUID(), promptpay_id: "hidden", qr_mode: "none", type: "bank_transfer",
    }] });
    assert.equal(builtIn.error, null, builtIn.error?.message);
    assert.equal((builtIn.data as Array<Record<string, unknown>>)[0]?.custom_bank_name, "");
    assert.equal((builtIn.data as Array<Record<string, unknown>>)[0]?.custom_bank_logo_url, "");

    const custom = await allowed.rpc("save_quotation_company_payment_methods", { p_methods: [{
      ...prompt, account_name: " Custom account ", account_number: " 999 ", bank_code: "legacy", bank_id: null,
      custom_bank_name: " Custom bank ", id: crypto.randomUUID(), promptpay_id: "hidden", qr_mode: "none", type: "bank_transfer",
    }] });
    assert.equal(custom.error, null, custom.error?.message);
    assert.equal((custom.data as Array<Record<string, unknown>>)[0]?.custom_bank_name, "Custom bank");

    const normalizedSnapshot = payload(null);
    normalizedSnapshot.payment_methods = [{
      ...prompt, account_number: " hidden ", bank_code: "hidden", custom_bank_name: "hidden",
      provider_name: "hidden", id: crypto.randomUUID(), instructions: " note ",
    }];
    const normalizedSaved = await saveWithPayments(allowed, normalizedSnapshot);
    const storedNormalized = await allowed.from("quotation_payment_methods")
      .select("account_number,bank_code,custom_bank_name,provider_name,instructions")
      .eq("quotation_id", normalizedSaved.id).single();
    assert.equal(storedNormalized.error, null, storedNormalized.error?.message);
    assert.deepEqual(storedNormalized.data, { account_number: "", bank_code: "", custom_bank_name: "", provider_name: "", instructions: "note" });

    const zeroAmount = payload(null);
    zeroAmount.items[0]!.unit_price = "0.00";
    zeroAmount.totals = { amountDue: "0.00", discountTotal: "0.00", grandTotal: "0.00", grossTotal: "0.00", preTaxTotal: "0.00", vatTotal: "0.00", withholdingTaxTotal: "0.00" };
    zeroAmount.payment_methods = [prompt];
    assert.equal((await allowed.rpc("save_quotation_with_payments", { p_payload: zeroAmount })).error?.code, "22023");
  });
});
