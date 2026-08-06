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
const newPage = readFileSync(
  new URL("../app/admin/quotations/new/page.tsx", import.meta.url),
  "utf8",
);
const editPage = readFileSync(
  new URL("../app/admin/quotations/[id]/page.tsx", import.meta.url),
  "utf8",
);
const certificationUploadRoute = readFileSync(
  new URL("../app/api/admin/quotations/certification-assets/route.ts", import.meta.url),
  "utf8",
);
const certificationUploadService = readFileSync(
  new URL("../server/services/quotation-certification-assets.ts", import.meta.url),
  "utf8",
);
const certificationFields = readFileSync(
  new URL("../components/admin/quotations/certification-fields.tsx", import.meta.url),
  "utf8",
);
const logoUploadRoute = readFileSync(
  new URL("../app/api/admin/quotations/logo-assets/route.ts", import.meta.url),
  "utf8",
);
const logoUploadService = readFileSync(
  new URL("../server/services/quotation-logo-assets.ts", import.meta.url),
  "utf8",
);
const quotationLogoInput = readFileSync(
  new URL("../components/admin/quotations/quotation-logo-image-input.tsx", import.meta.url),
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

  it("loads, validates, and owner-scopes quotation template defaults", () => {
    assert.match(repository, /document_template_default/);
    assert.match(repository, /document_template_snapshot/);
    assert.match(repository, /companyProfileToTemplate/);
    assert.match(
      repository,
      /normalizeQuotationTemplate\(row\.document_template_snapshot\)/,
    );
    assert.match(
      repository,
      /saveQuotationTemplateDefault[\s\S]*\.eq\("user_id", userId\)/,
    );
    assert.match(actions, /isQuotationTemplate\(value\)/);
    assert.match(
      actions,
      /saveQuotationTemplateDefault\(supabase, value, user\.id\)/,
    );
  });

  it("initializes a new quotation from the account template default", () => {
    assert.match(newPage, /companyProfileToTemplate\(profile\)/);
  });

  it("keeps the account default separate from an edit snapshot", () => {
    assert.match(editPage, /getQuotationCompanyProfile/);
    assert.match(
      editPage,
      /initialTemplateDefault=\{companyProfileToTemplate\(profile\)\}/,
    );
  });

  it("validates and uploads normalized payment PNGs after permission checks", () => {
    assert.match(actions, /validateNormalizedQuotationPng\(file\)/);
    assert.match(actions, /validateQuotationUploadedImage\(normalized, "png"\)/);
    assert.match(actions, /buildQuotationPaymentAssetObjectKey\(\)/);
    assert.match(actions, /contentType: "image\/png"/);
    assert.match(actions, /validateQuotationPaymentAssetUrl\(url/);
    assert.match(actions, /prepareCompanyPaymentMethods\(value\)/);
  });

  it("validates and uploads normalized certification PNGs after permission checks", () => {
    assert.match(actions, /validateNormalizedQuotationPng\(file\)/);
    assert.match(actions, /validateQuotationUploadedImage\(normalized, "png"\)/);
    assert.match(actions, /buildQuotationCertificationAssetObjectKey\(\)/);
    assert.match(actions, /contentType: "image\/png"/);
    assert.match(actions, /validateQuotationCertificationAssetUrl\(url/);
    assert.match(actions, /certification\.issuer\.signatureUrl/);
    assert.match(actions, /certification\.approver\.signatureUrl/);
    assert.match(actions, /certification\.companyStampUrl/);
  });

  it("validates payment and certification asset URLs against the deployed runtime origin", () => {
    assert.match(actions, /async function paymentAssetErrors[\s\S]*await getQuotationAssetRuntimeEnv\(\)/);
    assert.match(actions, /async function certificationAssetErrors[\s\S]*await getQuotationAssetRuntimeEnv\(\)/);
    assert.match(actions, /validateQuotationAssetUrl\(prepared\.payload\.seller\.logoUrl, \(await getQuotationAssetRuntimeEnv\(\)\)\.workerUrl\)/);
    assert.match(actions, /await paymentAssetErrors\(prepared\.payload\.paymentMethods\)/);
    assert.match(actions, /await certificationAssetErrors\(prepared\.payload\.certification\)/);
  });

  it("uploads certification images through an authorized same-origin API boundary", () => {
    assert.match(certificationUploadRoute, /requestOrigin !== new URL\(request\.url\)\.origin/);
    assert.match(certificationUploadRoute, /canUseQuotation\(adminUser\)/);
    assert.match(certificationUploadRoute, /uploadQuotationCertificationImage\(value\)/);
    assert.match(certificationUploadService, /file\.size > QUOTATION_SNAPSHOT_IMAGE_MAX_BYTES/);
    assert.match(certificationUploadService, /validateQuotationUploadedImage\(file, "png"\)/);
    assert.match(certificationUploadService, /contentType: "image\/png"/);
    assert.match(certificationFields, /fetch\("\/api\/admin\/quotations\/certification-assets"/);
    assert.doesNotMatch(certificationFields, /uploadQuotationCertificationAssetAction/);
  });

  it("uploads quotation-only seller logos through an authorized same-origin API boundary", () => {
    assert.match(logoUploadRoute, /requestOrigin !== new URL\(request\.url\)\.origin/);
    assert.match(logoUploadRoute, /canUseQuotation\(adminUser\)/);
    assert.match(logoUploadRoute, /uploadQuotationLogoImage\(value\)/);
    assert.match(logoUploadService, /file\.size > QUOTATION_ASSET_MAX_BYTES/);
    assert.match(logoUploadService, /validateQuotationUploadedImage\(file, "webp"\)/);
    assert.match(logoUploadService, /contentType: "image\/webp"/);
    assert.match(quotationLogoInput, /fetch\("\/api\/admin\/quotations\/logo-assets"/);
    assert.match(quotationLogoInput, /validateQuotationAssetFile\(file\)/);
    assert.match(quotationLogoInput, /"image\/webp"/);
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
