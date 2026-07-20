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
    assert.match(actions, /prepareQuotationPayload\(value\)/);
    assert.match(actions, /saveQuotation\(supabase, prepared\.rpcPayload\)/);
    assert.match(actions, /softDeleteQuotation\(supabase, id\)/);
    assert.match(actions, /uploadQuotationPaymentAssetAction/);
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

  it("validates and uploads normalized payment PNGs after permission checks", () => {
    assert.match(actions, /validateQuotationPaymentAssetFile\(file\)/);
    assert.match(actions, /file\.type !== "image\/png"/);
    assert.match(actions, /buildQuotationPaymentAssetObjectKey\(\)/);
    assert.match(actions, /contentType: "image\/png"/);
    assert.match(actions, /validateQuotationPaymentAssetUrl\(url/);
    assert.match(actions, /prepareCompanyPaymentMethods\(value\)/);
  });

  it("hydrates ordered payment snapshots and returns the saved normalized payload", () => {
    assert.match(repository, /quotation_payment_methods\(/);
    assert.match(repository, /paymentMethods: \(row\.quotation_payment_methods \?\? \[\]\)/);
    assert.match(actions, /return \{ \.\.\.saved, ok: true, payload: prepared\.payload \}/);
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
