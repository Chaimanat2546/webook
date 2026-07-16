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
    assert.match(editor, /data-sortable-items/);
    assert.match(editor, /data-quotation-totals/);
    assert.doesNotMatch(editor, /quotation-paper|min-h-\[297mm\]|w-\[210mm\]/);
    assert.match(editor, /field="subject"[\s\S]*label="เรื่อง \/ ชื่องาน"/);
    assert.ok(editor.indexOf("data-document-section") < editor.indexOf('field="reference"'));
    assert.match(editor, /data-field="issueDate"/);
    assert.match(editor, /data-field=\{`items\./);
    assert.match(editor, /discountAmount/);
    assert.match(editor, /publicNotes/);
    assert.match(editor, /internalNotes/);
  });

  it("keeps quotation-specific customer and item fields focused on villa services", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/quotation-document.tsx");
    assert.doesNotMatch(editor, /customer\.(contactName|email|phone|serviceLocation|shippingAddress)/);
    assert.doesNotMatch(editor, /items\.\$\{index\}\.sku|aria-label="SKU"|placeholder="SKU"/);
    assert.doesNotMatch(document, /customer\.(contactName|email|phone|serviceLocation|shippingAddress)/);
  });

  it("composes the approved document workbench shell and semantic field sizes", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /type FieldSize =[\s\S]*?\| "address";/);
    for (const value of ["max-w-28", "max-w-40", "max-w-56", "max-w-32", "max-w-96", "max-w-[36rem]"]) {
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
    assert.match(editor, /<DropdownMenuItem disabled=\{isPending\} onSelect=\{onSave\}/);
    assert.equal(editor.match(/isPending=\{isPending\}/g)?.length, 1);
  });

  it("uses consistent native select geometry", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /minmax\(36px,1fr\)/);
    assert.match(editor, /data-customer-fields[^>]*className="grid gap-3 sm:grid-cols-2"/);
    assert.match(editor, /data-document-fields[^>]*className="grid gap-3 sm:grid-cols-2"/);
    assert.match(editor, /const selectClassName =[\s\S]*?"h-8 rounded-lg/);
    assert.match(editor, /className=\{controlClassName\("identifier", selectClassName\)\}[\s\S]*?data-field="customer\.officeType"/);
    assert.match(editor, /className=\{selectClassName\}[\s\S]*?data-field="seller\.officeType"/);
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
      ["publicNotes", "fieldErrors\\.publicNotes"],
      ["internalNotes", "fieldErrors\\.internalNotes"],
    ]) {
      assert.match(editor, new RegExp(`<(?:Input|Textarea|select)[^>]*aria-invalid=\\{Boolean\\(${binding}\\)\\}[^>]*data-field="${field}"`));
    }
    assert.match(editor, /<select[^>]*aria-invalid=\{Boolean\(error\("vatTreatment"\)\)\}[^>]*data-field=\{`items\.\$\{index\}\.vatTreatment`\}/);
    assert.match(editor, /const selectClassName =[\s\S]*?disabled:bg-input\/50[^";]*aria-invalid:border-destructive[^";]*aria-invalid:ring-destructive\/20/);
    assert.doesNotMatch(editor, /const selectClassName =[\s\S]*?appearance-none[^";]*";/);
  });

  it("uses compact metadata and one sortable responsive item ledger", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /customer\.contactName|customer\.phone|customer\.email/);
    assert.doesNotMatch(editor, /field="currency"|data-field="currency"|THB — บาท/);
    assert.doesNotMatch(editor, /field="priceMode"|data-field="priceMode"/);
    assert.match(editor, /DragDropProvider/);
    assert.match(editor, /useSortable/);
    assert.match(editor, /handleRef/);
    assert.match(editor, /move\(current\.items, event\)/);
    assert.match(editor, /aria-label=\{`ลากเพื่อจัดลำดับรายการ/);
    assert.doesNotMatch(editor, /ItemActionMenu|ArrowUp|ArrowDown|เลื่อนขึ้น|เลื่อนลง/);
    assert.match(editor, /data-sortable-item/);
    assert.equal(editor.match(/data-item-details/g)?.length, 1);
    assert.ok(editor.indexOf("data-sortable-items") < editor.indexOf("เพิ่มรายการ"));
    assert.match(editor, /calculation\?\.lines\[index\]\?\.preTaxAmount/);
    assert.match(editor, /data-item-detail-grid[^>]*grid-cols-2[^>]*sm:grid-cols-3[^>]*lg:grid-cols-5/);
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

  it("offers transient item discount and VAT document settings", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /ตั้งค่าเอกสาร/);
    assert.match(editor, /DropdownMenuCheckboxItem/);
    assert.match(editor, /ส่วนลดเฉพาะรายการ/);
    assert.match(editor, /VAT เฉพาะรายการ/);
    assert.match(editor, /initialPayload\.items\.some\(\(item\) => Number\(item\.discountAmount\) > 0\)/);
    assert.match(editor, /initialPayload\.items\.some\(\(item\) => item\.vatTreatment !== "none"\)/);
    assert.match(editor, /!enabled && payload\.items\.some\(\(item\) => Number\(item\.vatRate\) > 0\)[\s\S]*?!window\.confirm/);
    assert.match(editor, /vatRate: enabled \? "7\.00" : "0",[\s\S]*?vatTreatment: enabled \? "taxable" : "none"/);
    assert.doesNotMatch(editor, /!enabled && payload\.items\.some\(\(item\) => item\.vatTreatment !== "none"\)/);
  });

  it("uses fixed item discounts and pre-tax item values", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/quotation-document.tsx");
    assert.match(editor, /field=\{`items\.\$\{index\}\.discountAmount`\}/);
    assert.match(editor, /calculation\?\.lines\[index\]\?\.preTaxAmount/);
    const item = editor.slice(editor.indexOf("function SortableQuotationItem"), editor.indexOf("function ItemDetailsControls"));
    const header = editor.slice(editor.indexOf("itemGrid(showItemDiscount, showItemVat)"), editor.indexOf("<DragDropProvider"));
    assert.match(item, /<span className="xl:sr-only">มูลค่าก่อนภาษี <\/span>/);
    assert.match(header, /<span className="text-right">มูลค่าก่อนภาษี<\/span>/);
    assert.doesNotMatch(item + header, />รวม<|>รวม <|รวม<\/span>/);
    assert.match(document, /มูลค่าก่อนภาษี/);
    assert.doesNotMatch(editor + document, /documentDiscount|discountType|discountValue/);
    assert.doesNotMatch(editor, /<option value="percent">%<\/option>/);
  });

  it("clears branch numbers when head office is selected", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function updateSellerOfficeType/);
    assert.match(editor, /branchNumber:[\s\S]*?officeType === "branch" \? current\.seller\.branchNumber : ""/);
    assert.match(editor, /function updateCustomerOfficeType/);
    assert.match(editor, /branchNumber:[\s\S]*?officeType === "branch" \? current\.customer\.branchNumber : ""/);
    assert.match(editor, /payload\.seller\.officeType === "branch"/);
    assert.match(editor, /payload\.customer\.officeType === "branch"/);
  });

  it("does not add out-of-scope quotation workflow", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /accepted|rejected|approval|qrCode/i);
  });

  it("places document actions in the seller strip and keeps command bar actions text-only", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const commandBar = editor.slice(editor.indexOf("data-workbench-command-bar"), editor.indexOf("data-seller-strip"));
    const sellerStrip = editor.slice(editor.indexOf("data-seller-strip"), editor.indexOf("data-seller-edit"));
    assert.match(commandBar, /<Button[\s\S]*?onClick=\{closeEditor\}[\s\S]*?variant="outline"/);
    assert.match(commandBar, /onClick=\{\(\) => save\(\)\}[\s\S]*?\{isPending \?/);
    assert.doesNotMatch(commandBar, /<X|<Save/);
    assert.match(sellerStrip, /data-document-actions[\s\S]*<Share2[\s\S]*<Printer[\s\S]*<Download[\s\S]*<DocumentMore/);
    assert.match(editor, /<DropdownMenuItem onSelect=\{onPreview\}/);
    assert.match(sellerStrip, /<Button[\s\S]*?disabled[\s\S]*?size="sm"[\s\S]*?title=/);
    assert.doesNotMatch(sellerStrip, /<Button disabled title=.*<Share2/);
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
      "seller.email", "seller.website", "customer.taxId",
    ]) assert.ok(editor.includes(`fieldErrors[\"${field}\"]`) || editor.includes(`fieldErrors.${field}`));
    assert.match(editor, /const error = \(field: string\) => errors\[`items\.\$\{index\}\.\$\{field\}`\]/);
    assert.ok(editor.indexOf('data-field="seller.officeType"') < editor.indexOf("data-customer-section"));
    assert.ok(editor.indexOf('data-field="customer.officeType"') < editor.indexOf("data-sortable-items"));
  });

  it("keeps each item control in the one responsive sortable item", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const control of ["ItemQuantityControl", "ItemUnitControl", "ItemPriceControls", "ItemDiscountControls", "ItemVatControls"]) {
      assert.match(editor, new RegExp(`<${control}`));
    }
    assert.match(editor, /function SortableQuotationItem/);
    assert.doesNotMatch(editor, /<td className="p-2"><Item/);
  });

  it("surfaces optional item unit validation errors", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function ItemUnitControl\([\s\S]*?errors\[`items\.\$\{index\}\.unit`\]/);
    assert.match(editor, /field=\{`items\.\$\{index\}\.unit`\}[\s\S]*?onUpdate\("unit", value\)[\s\S]*?value=\{item\.unit\}/);
  });

  it("shows desktop select errors beside VAT controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const treatmentControl = labelled \?[\s\S]*?error=\{error\("vatTreatment"\)\}[\s\S]*?\{error\("vatTreatment"\) \?/);
  });

  it("keeps the total and delete controls last in every desktop item grid", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /if \(showItemDiscount && showItemVat\) return "xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /if \(showItemDiscount\) return "xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /if \(showItemVat\) return "xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /return "xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /aria-label=\{`ลบรายการ[\s\S]*?className="xl:col-start-\[-2\]"/);
    assert.match(editor, /className="[^"]*xl:col-start-\[-3\][^"]*"[\s\S]*?<span className="xl:sr-only">มูลค่าก่อนภาษี/);
    assert.doesNotMatch(editor, /xl:col-start-8/);
  });

  it("keeps optional item controls on the first desktop ledger row", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /showItemDiscount \? <div className="xl:col-start-6 xl:row-start-1"><ItemDiscountControls/);
    assert.match(editor, /showItemVat \? <div className=\{cn\("xl:row-start-1", props\.showItemDiscount \? "xl:col-start-7" : "xl:col-start-6"\)\}><ItemVatControls/);
  });

  it("keeps two-up item controls within their grid columns", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /className=\{cn\("w-full min-w-0", selectClassName\)\}/);
    assert.match(editor, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
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
    assert.match(document, /payload\.subject/);
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
