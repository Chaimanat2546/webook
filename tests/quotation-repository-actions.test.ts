import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  quotationPersistenceError,
  QuotationPaymentAssetOriginNotConfiguredError,
} from "../server/repositories/quotation-errors.ts";

const repository = readFileSync(
  new URL("../server/repositories/quotations.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../app/admin/quotations/actions.ts", import.meta.url),
  "utf8",
);

describe("quotation repository and actions", () => {
  it("uses the transactional RPC for writes", () => {
    assert.match(repository, /\.rpc\("save_quotation_with_payments"/);
    assert.match(repository, /\.rpc\("soft_delete_quotation"/);
    assert.match(repository, /\.rpc\("list_quotations"/);
    assert.doesNotMatch(repository, /\.from\("quotation_items"\)\.insert/);
  });

  it("loads public quotations only through the token RPC", () => {
    assert.match(repository, /\.rpc\("get_public_quotation"/);
    assert.match(repository, /publicToken/);
    assert.match(repository, /public_token/);
    assert.doesNotMatch(repository, /serviceRole/i);
  });

  it("checks the quotation permission before every action mutation", () => {
    assert.match(actions, /canUseQuotation\(adminUser\)/);
    assert.match(actions, /const itemNames = await listQuotationItemNames\(supabase\)/);
    assert.match(actions, /prepareQuotationPayload\(value, itemNames\)/);
    assert.match(actions, /saveQuotation\(supabase, prepared\.rpcPayload\)/);
    assert.match(actions, /softDeleteQuotation\(supabase, id\)/);
    assert.match(actions, /uploadQuotationPaymentAssetAction/);
    assert.match(actions, /uploadQuotationCertificationAssetAction/);
    assert.match(actions, /saveCompanyPaymentMethodsAction/);
  });

  it("scopes seller and payment masters to the authenticated account", () => {
    assert.match(repository, /user_id: string/);
    assert.match(repository, /select\("id,user_id,seller_name/);
    assert.match(repository, /\.eq\("user_id", userId\)/);
    assert.match(repository, /user_id: userId/);
    assert.doesNotMatch(repository, /\.eq\("id", 1\)/);
    assert.match(repository, /from\("banks"\)/);
    assert.match(repository, /\.not\("code", "is", null\)/);
    assert.match(repository, /\.order\("sort_order"\)/);
    assert.match(repository, /\.order\("name"\)/);
    assert.match(repository, /from\("quotation_company_payment_methods"\)/);
    assert.match(repository, /\.order\("position"\)/);
    assert.match(repository, /\.rpc\("save_quotation_company_payment_methods"/);
    assert.match(repository, /account_type/);
    assert.match(repository, /accountType:\s*stringValue\(method\.account_type\)/);
    assert.match(repository, /account_type:\s*method\.accountType/);
  });

  it("scopes document display default updates to the authenticated account", () => {
    const saveDefaults = repository.slice(
      repository.indexOf("export async function saveQuotationDocumentDisplayDefaults"),
      repository.indexOf("export async function saveQuotationCompanyProfile"),
    );
    assert.match(saveDefaults, /userId: string/);
    assert.match(saveDefaults, /\.update\([\s\S]*\.eq\("user_id", userId\)[\s\S]*\.select\("id"\)/);
    assert.match(
      actions,
      /saveQuotationDocumentDisplayDefaults\(supabase, value, user\.id\)/,
    );
  });

  it("validates and uploads normalized payment PNGs after permission checks", () => {
    assert.match(actions, /validateQuotationPaymentAssetFile\(file\)/);
    assert.match(actions, /file\.type !== "image\/png"/);
    assert.match(actions, /buildQuotationPaymentAssetObjectKey\(\)/);
    assert.match(actions, /contentType: "image\/png"/);
    assert.match(actions, /validateQuotationPaymentAssetUrl\(url/);
    assert.match(actions, /prepareCompanyPaymentMethods\(value\)/);
  });

  it("validates and uploads normalized certification PNGs after permission checks", () => {
    assert.match(actions, /validateQuotationCertificationAssetFile\(file\)/);
    assert.match(actions, /file\.type !== "image\/png"/);
    assert.match(actions, /buildQuotationCertificationAssetObjectKey\(\)/);
    assert.match(actions, /contentType: "image\/png"/);
    assert.match(actions, /validateQuotationCertificationAssetUrl\(url/);
    assert.match(actions, /certification\.issuer\.signatureUrl/);
    assert.match(actions, /certification\.approver\.signatureUrl/);
    assert.match(actions, /certification\.companyStampUrl/);
  });

  it("saves the certification master through the validated owner-scoped RPC", () => {
    assert.match(repository, /export async function saveQuotationCompanyCertification/);
    assert.match(repository, /\.rpc\(\s*"save_quotation_company_certification"/);
    assert.match(repository, /p_value: certificationSnapshotToJson\(certification\)/);
    assert.doesNotMatch(repository, /issuer_name:\s*certification|approver_name:\s*certification|company_stamp_url:\s*certification/);

    assert.match(actions, /export async function saveCompanyCertificationAction/);
    assert.match(actions, /canUseQuotation\(adminUser\)/);
    assert.match(actions, /prepareCertificationSnapshot\(value\)/);
    assert.match(actions, /certificationAssetErrors\(certification\)/);
    assert.match(actions, /saveQuotationCompanyCertification\(supabase, certification\)/);
    assert.match(actions, /revalidatePath\("\/admin\/quotations\/settings\/company"\)/);
    assert.doesNotMatch(actions, /certification_snapshot\s*:/);
  });

  it("hydrates ordered payment snapshots and returns the saved normalized payload", () => {
    assert.match(repository, /quotation_payment_methods\(/);
    assert.match(repository, /paymentMethods: \(row\.quotation_payment_methods \?\? \[\]\)/);
    assert.match(actions, /return \{ \.\.\.saved, ok: true, payload: prepared\.payload \}/);
  });

  it("loads quotation item names from the ordered database catalogue", () => {
    assert.match(repository, /export async function listQuotationItemNames/);
    assert.match(repository, /from\("quotation_item_catalog"\)[\s\S]*select\("name"\)[\s\S]*order\("sort_order"\)/);
  });

  it("keeps legacy VAT snapshots lossless for saved and public documents", () => {
    assert.match(repository, /return value === "taxable" \|\| value === "exempt" \? value : "none"/);
    assert.match(repository, /vatRate: stringValue\(item\.vat_rate\)/);
    assert.doesNotMatch(repository, /function vatRate/);
  });

  it("returns field validation without leaking database errors", () => {
    assert.match(actions, /error instanceof QuotationValidationError/);
    assert.match(actions, /fieldErrors: error\.fieldErrors/);
    assert.match(actions, /ไม่สามารถบันทึกใบเสนอราคาได้/);
    assert.doesNotMatch(actions, /formError: error\.message/);
  });

  it("maps only the stable missing payment-asset-origin database error", () => {
    const configured = quotationPersistenceError({
      code: "P0001",
      message: "quotation_payment_asset_origin_not_configured",
    });
    assert.ok(configured instanceof QuotationPaymentAssetOriginNotConfiguredError);
    assert.equal(
      quotationPersistenceError({ code: "P0001", message: "Unexpected database failure" }).message,
      "Unexpected database failure",
    );
    assert.match(actions, /error instanceof QuotationPaymentAssetOriginNotConfiguredError/);
    assert.match(actions, /ADVERTISEMENT_IMAGE_WORKER_URL/);
  });
});
