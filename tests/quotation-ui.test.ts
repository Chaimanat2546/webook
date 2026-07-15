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
    assert.match(editor, /data-seller-strip/);
    assert.match(editor, /data-customer-section/);
    assert.match(editor, /data-document-section/);
    assert.match(editor, /data-item-ledger/);
    assert.match(editor, /data-item-cards/);
    assert.match(editor, /data-quotation-totals/);
    assert.match(editor, /xl:hidden/);
    assert.match(editor, /hidden[^\"]*xl:block/);
    assert.doesNotMatch(editor, /quotation-paper|min-h-\[297mm\]|w-\[210mm\]/);
    assert.doesNotMatch(editor, /field="subject"|data-field="subject"/);
    assert.ok(editor.indexOf("data-document-section") < editor.indexOf('field="reference"'));
    assert.ok(editor.indexOf('field="priceMode"') < editor.indexOf("data-item-ledger"));
    assert.match(editor, /data-field="issueDate"/);
    assert.match(editor, /data-field=\{`items\./);
    assert.match(editor, /documentDiscountValue/);
    assert.match(editor, /publicNotes/);
    assert.match(editor, /internalNotes/);
  });

  it("keeps quotation-specific customer and item fields focused on villa services", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/quotation-document.tsx");
    assert.doesNotMatch(editor, /customer\.shippingAddress|customer\.serviceLocation/);
    assert.doesNotMatch(editor, /items\.\$\{index\}\.sku|aria-label="SKU"|placeholder="SKU"/);
    assert.doesNotMatch(document, /customer\.shippingAddress|customer\.serviceLocation/);
  });

  it("composes the approved document workbench shell and semantic field sizes", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /type FieldSize = "fluid" \| "compact" \| "date" \| "identifier" \| "person" \| "name" \| "address" \| "contact"/);
    for (const value of ["max-w-28", "max-w-40", "max-w-64", "max-w-72", "max-w-md", "max-w-[40rem]", "max-w-[22rem]"]) {
      assert.match(editor, new RegExp(value.replace("[", "\\[").replace("]", "\\]")));
    }
    assert.match(editor, /data-workbench-command-bar/);
    assert.match(editor, /data-seller-strip/);
    assert.match(editor, /data-workbench-metadata[^>]*lg:grid-cols-12/);
    assert.match(editor, /data-customer-section[^>]*lg:col-span-7/);
    assert.match(editor, /data-document-section[^>]*lg:col-span-5/);
    assert.doesNotMatch(editor, /lg:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
  });

  it("disables save and close while a save is pending", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /<DropdownMenuItem disabled=\{isPending\} onSelect=\{onSaveAndClose\}/);
    assert.equal(editor.match(/isPending=\{isPending\}/g)?.length, 2);
  });

  it("uses consistent native select geometry", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /minmax\(36px,1fr\)/);
    assert.match(editor, /data-customer-fields[^>]*className="grid gap-3 sm:grid-cols-2"/);
    assert.match(editor, /data-document-fields[^>]*className="grid gap-3 sm:grid-cols-2"/);
    assert.match(editor, /const selectClassName = "h-8 rounded-lg/);
    assert.match(editor, /className=\{controlClassName\("identifier", selectClassName\)\} data-field="customer\.officeType"/);
    assert.match(editor, /className=\{selectClassName\} data-field="seller\.officeType"/);
    assert.match(editor, /className=\{controlClassName\("identifier", selectClassName\)\} data-field="documentDiscountType"/);
    assert.match(editor, /className=\{controlClassName\("identifier", selectClassName\)\} data-field="priceMode"/);
  });

  it("marks every editable native error control as invalid", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const [field, binding] of [
      ["seller\\.address", 'fieldErrors\\["seller\\.address"\\]'],
      ["seller\\.officeType", 'fieldErrors\\["seller\\.officeType"\\]'],
      ["customer\\.address", 'fieldErrors\\["customer\\.address"\\]'],
      ["customer\\.officeType", 'fieldErrors\\["customer\\.officeType"\\]'],
      ["issueDate", "fieldErrors\\.issueDate"],
      ["validUntil", "fieldErrors\\.validUntil"],
      ["priceMode", "fieldErrors\\.priceMode"],
      ["publicNotes", "fieldErrors\\.publicNotes"],
      ["internalNotes", "fieldErrors\\.internalNotes"],
      ["documentDiscountType", "fieldErrors\\.documentDiscountType"],
    ]) {
      assert.match(editor, new RegExp(`<(?:Input|Textarea|select)[^>]*aria-invalid=\\{Boolean\\(${binding}\\)\\}[^>]*data-field="${field}"`));
    }
    assert.match(editor, /<select[^>]*aria-invalid=\{Boolean\(error\("discountType"\)\)\}[^>]*data-field=\{`items\.\$\{index\}\.discountType`\}/);
    assert.match(editor, /<select[^>]*aria-invalid=\{Boolean\(error\("vatTreatment"\)\)\}[^>]*data-field=\{`items\.\$\{index\}\.vatTreatment`\}/);
    assert.match(editor, /const selectClassName = "[^"]*disabled:bg-input\/50[^"]*aria-invalid:border-destructive[^"]*aria-invalid:ring-destructive\/20/);
    assert.doesNotMatch(editor, /const selectClassName = "[^"]*appearance-none/);
  });

  it("uses the approved fixed ledger and responsive item cards", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function ItemActionMenu/);
    assert.match(editor, /data-item-ledger[^>]*hidden[^>]*xl:block/);
    assert.match(editor, /min-w-\[62\.5rem\][^\"]*table-fixed/);
    assert.match(editor, /<colgroup>/);
    for (const width of ["w-10", "w-20", "w-[7.5rem]", "w-36", "w-[8.5rem]"]) {
      assert.match(editor, new RegExp(width.replace("[", "\\[").replace("]", "\\]")));
    }
    assert.match(editor, /data-item-cards[^>]*xl:hidden/);
    assert.match(editor, /data-item-detail-grid[^>]*grid-cols-2[^>]*sm:grid-cols-3[^>]*lg:grid-cols-5/);
    assert.doesNotMatch(editor, /data-item-actions/);
  });

  it("finishes the workbench with ruled notes and aligned totals", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /data-workbench-completion[^>]*lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
    assert.match(editor, /data-notes-grid[^>]*lg:grid-cols-2/);
    assert.match(editor, /data-quotation-totals[^>]*border-t-2/);
    assert.ok(editor.indexOf('data-field="publicNotes"') < editor.indexOf('data-field="internalNotes"'));
    assert.ok(editor.indexOf('data-field="internalNotes"') < editor.indexOf("data-quotation-totals"));
    assert.doesNotMatch(editor, /data-internal-notes[^>]*rounded-xl/);
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

  it("focuses the visible copy of responsive item controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /querySelectorAll<HTMLElement>/);
    assert.match(editor, /offsetParent !== null/);
  });

  it("shows server field errors beside all editable quotation controls in paper order", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const field of [
      "seller.email", "seller.website", "customer.taxId", "customer.contactName", "customer.phone", "customer.email",
      "priceMode", "documentDiscountType",
    ]) assert.ok(editor.includes(`fieldErrors[\"${field}\"]`) || editor.includes(`fieldErrors.${field}`));
    assert.match(editor, /const error = \(field: string\) => errors\[`items\.\$\{index\}\.\$\{field\}`\]/);
    assert.ok(editor.indexOf('data-field="seller.officeType"') < editor.indexOf("data-customer-section"));
    assert.ok(editor.indexOf('data-field="customer.officeType"') < editor.indexOf("data-item-ledger"));
  });

  it("keeps desktop item inputs in their matching table columns", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const control of ["ItemQuantityControl", "ItemUnitControl", "ItemPriceControls", "ItemDiscountControls", "ItemVatControls"]) {
      assert.match(editor, new RegExp(`<${control}`));
    }
    assert.match(editor, /<td className="p-2"><ItemQuantityControl/);
    assert.match(editor, /<td className="p-2"><ItemUnitControl/);
    assert.match(editor, /<td className="p-2"><ItemPriceControls/);
    assert.match(editor, /<td className="p-2"><ItemDiscountControls/);
    assert.match(editor, /<td className="p-2"><ItemVatControls/);
  });

  it("surfaces optional item unit validation errors", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function ItemUnitControl\(\{ errors, index, item, onUpdate, labelled \}: Pick<ItemProps, "errors" \| "index" \| "item" \| "onUpdate">/);
    assert.match(editor, /<TextInput error=\{errors\[`items\.\$\{index\}\.unit`\]\} field=\{`items\.\$\{index\}\.unit`\} label=\{labelled \? "หน่วย" : undefined\} onChange=\{\(value\) => onUpdate\("unit", value\)\} size="compact" value=\{item\.unit\} \/>/);
  });

  it("shows desktop select errors beside discount and VAT controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const typeControl = labelled \? <Field error=\{error\("discountType"\)[\s\S]*?\{error\("discountType"\) \? <span className="text-xs text-destructive">\{error\("discountType"\)\}/);
    assert.match(editor, /const treatmentControl = labelled \? <Field error=\{error\("vatTreatment"\)[\s\S]*?\{error\("vatTreatment"\) \? <span className="text-xs text-destructive">\{error\("vatTreatment"\)\}/);
  });

  it("keeps preview current while printing only the saved quotation document", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/quotation-document.tsx");
    assert.match(editor, /lastSavedPayload/);
    assert.match(editor, /setLastSavedPayload\(payload\)/);
    assert.match(editor, /window\.print\(\)/);
    assert.match(editor, /data-quotation-print/);
    assert.match(editor, /QuotationDocument/);
    assert.match(document, /data-quotation-document/);
    assert.doesNotMatch(document, /internalNotes/);
    assert.doesNotMatch(document, /subject/);
  });

  it("guards dirty editor navigation and supports saved quotation deletion", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /beforeunload/);
    assert.match(editor, /deleteQuotationAction/);
    assert.match(editor, /window\.confirm/);
    assert.match(editor, /router\.push\("\/admin\/quotations"\)/);
  });

  it("loads an edit quotation with a one-time print option and isolates print CSS", () => {
    const page = source("../app/admin/quotations/[id]/page.tsx");
    const css = source("../app/globals.css");
    assert.match(page, /searchParams: Promise<\{ print\?: string \}>/);
    assert.match(page, /printOnLoad=\{print === "1"\}/);
    assert.match(css, /html\.quotation-printing \[data-quotation-print\]/);
    assert.match(css, /\[data-quotation-document\] tr/);
  });

  it("prints the last saved quotation while a newer draft is dirty", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const css = source("../app/globals.css");
    assert.match(editor, /const canPrint = Boolean\(documentNumber && lastSavedPayload && !isPending\)/);
    assert.match(editor, /if \(!canPrint\) return/);
    assert.match(editor, /printStyle\.textContent = "@page \{ size: A4; margin: 0; \}"/);
    assert.match(editor, /printStyle\.remove\(\)/);
    assert.doesNotMatch(css, /@page\s*\{/);
  });
});
