import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("quotation UI", () => {
  it("protects and renders the single seller profile page", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(page, /CompanyProfileForm/);
  });

  it("collects the approved seller snapshot fields and normalizes the logo", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");
    for (const name of [
      "name", "address", "taxId", "officeType", "branchNumber", "phone", "email",
      "website", "contactName", "contactPhone", "contactEmail", "logo",
    ]) {
      assert.match(form, new RegExp(`name=["']${name}["']`));
    }
    assert.match(form, /resizeQuotationImageToMax/);
    assert.match(form, /image\/webp/);
    assert.match(form, /10 \* 1024 \* 1024/);
    assert.match(form, /officeType === "branch"[\s\S]*name="branchNumber"[\s\S]*required/);
    assert.match(form, /name="branchNumber" type="hidden" value=""/);
    assert.match(form, /error=\{fieldErrors\.branchNumber\}/);
    assert.match(form, /aria-invalid=\{Boolean\(error\)\}/);
  });

  it("keeps the old asset after a successful profile replacement", () => {
    const actions = source("../app/admin/quotations/actions.ts");
    assert.match(actions, /saveCompanyProfileAction/);
    assert.match(actions, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(actions, /cleanup newly uploaded quotation logo/i);
    assert.doesNotMatch(actions, /deleteQuotationAssetObject\([^)]*existing/i);
  });

  it("lists quotations with server search and pagination", () => {
    const page = source("../app/admin/quotations/page.tsx");
    const list = source("../components/admin/quotations/quotation-list.tsx");
    assert.match(page, /listQuotations\(supabase/);
    assert.match(page, /pageSize: 20/);
    assert.match(page, /name="q"/);
    assert.match(page, /href="\/admin\/quotations\/new"/);
    assert.match(page, /href="\/admin\/quotations\/settings\/company"/);
    assert.match(list, /"use client"/);
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden[^"']*md:block/);
    assert.match(list, /deleteQuotationAction/);
    assert.match(list, /\?print=1/);
    assert.doesNotMatch(list, /สถานะ/);
  });
  it("loads create and edit routes through server repositories", () => {
    const createPage = source("../app/admin/quotations/new/page.tsx");
    const editPage = source("../app/admin/quotations/[id]/page.tsx");
    assert.match(createPage, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(createPage, /emptyQuotationPayload/);
    assert.match(editPage, /getQuotationById\(supabase, id\)/);
    assert.match(editPage, /notFound\(\)/);
    assert.match(createPage, /canUseQuotation\(adminUser\)/);
    assert.match(editPage, /canUseQuotation\(adminUser\)/);
  });

  it("uses the approved full-width responsive quotation editor", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /"use client"/);
    assert.match(editor, /useState<QuotationPayload>/);
    assert.match(editor, /calculateQuotation/);
    assert.match(editor, /saveQuotationAction/);
    assert.match(editor, /data-quotation-editor/);
    assert.match(editor, /data-seller-actions/);
    assert.match(editor, /data-customer-section/);
    assert.match(editor, /data-document-section/);
    assert.match(editor, /data-item-table/);
    assert.match(editor, /data-item-cards/);
    assert.match(editor, /data-quotation-totals/);
    assert.match(editor, /md:hidden/);
    assert.match(editor, /hidden[^\"]*md:block/);
    assert.doesNotMatch(editor, /quotation-paper|min-h-\[297mm\]|w-\[210mm\]/);
    assert.doesNotMatch(editor, /field="subject"|data-field="subject"/);
    assert.ok(editor.indexOf("data-document-section") < editor.indexOf('field="reference"'));
    assert.ok(editor.indexOf('field="priceMode"') < editor.indexOf("data-item-table"));
    assert.match(editor, /data-field="issueDate"/);
    assert.match(editor, /data-field=\{`items\./);
    assert.match(editor, /documentDiscountValue/);
    assert.match(editor, /publicNotes/);
    assert.match(editor, /internalNotes/);
  });

  it("clears branch numbers when head office is selected", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function updateSellerOfficeType/);
    assert.match(editor, /branchNumber: officeType === "branch" \? current\.seller\.branchNumber : ""/);
    assert.match(editor, /function updateCustomerOfficeType/);
    assert.match(editor, /branchNumber: officeType === "branch" \? current\.customer\.branchNumber : ""/);
    assert.match(editor, /payload\.seller\.officeType === "branch"/);
    assert.match(editor, /payload\.customer\.officeType === "branch"/);
  });

  it("does not add out-of-scope quotation workflow", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /accepted|rejected|approval|publicToken|qrCode/i);
  });

  it("keeps invalid dates editable and exposes office and field-error controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function recalculateValidUntil/);
    assert.match(editor, /data-field="seller\.officeType"/);
    assert.match(editor, /field="seller\.branchNumber"/);
    assert.match(editor, /data-field="customer\.officeType"/);
    assert.match(editor, /field="customer\.branchNumber"/);
    assert.match(editor, /aria-invalid/);
    assert.match(editor, /focusableFieldErrors/);
  });

  it("shows server field errors beside all editable quotation controls in paper order", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const field of [
      "seller.email", "seller.website", "customer.taxId", "customer.contactName", "customer.phone", "customer.email",
      "priceMode", "documentDiscountType",
    ]) assert.ok(editor.includes(`fieldErrors[\"${field}\"]`) || editor.includes(`fieldErrors.${field}`));
    assert.match(editor, /const error = \(field: string\) => errors\[`items\.\$\{index\}\.\$\{field\}`\]/);
    assert.ok(editor.indexOf('data-field="seller.officeType"') < editor.indexOf("data-customer-section"));
    assert.ok(editor.indexOf('data-field="customer.officeType"') < editor.indexOf("data-item-table"));
  });

  it("keeps desktop item inputs in their matching table columns", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const control of ["ItemQuantityControls", "ItemPriceControls", "ItemDiscountControls", "ItemVatControls"]) {
      assert.match(editor, new RegExp(`<${control}`));
    }
    assert.match(editor, /<td className="p-2"><ItemQuantityControls/);
    assert.match(editor, /<td className="p-2"><ItemPriceControls/);
    assert.match(editor, /<td className="p-2"><ItemDiscountControls/);
    assert.match(editor, /<td className="p-2"><ItemVatControls/);
  });
});
