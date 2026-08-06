import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyPaymentMethod, paymentMethodEditorState, updatePaymentMethodType } from "../lib/quotation-payment-methods.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("quotation UI", () => {
  it("renders every template from one complete shared fixture", () => {
    const output = execFileSync(process.execPath, [
      "--loader", "./tests/tsx-loader.mjs",
      "./tests/fixtures/quotation-template-parity.mjs",
    ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const renders = JSON.parse(output) as Record<string, {
      hiddenHtml: string;
      hiddenPdfByteLength: number;
      hiddenPdfTreeText: string;
      html: string;
      pdfByteLength: number;
      pdfTreeText: string;
    }>;

    for (const template of ["current", "hospitality", "corporate"]) {
      const html = renders[template]!.html;
      for (const value of [
        "Seller Fixture",
        "QO-PARITY-001",
        "Customer Fixture",
        "Suite Fixture",
        "Fixture service detail",
        "9,876.50",
        "Fixture payment instruction",
        "Fixture public note",
        "Fixture issuer",
      ]) assert.ok(html.includes(value), `${template} must render ${value}`);
      assert.ok(html.includes(`data-quotation-template=\"${template}\"`));
      assert.ok(html.indexOf("data-document-header") < html.indexOf("data-document-certification"));
      assert.ok(renders[template]!.pdfByteLength > 1_000, `${template} PDF renderer must produce a real document`);
      assert.ok(renders[template]!.hiddenPdfByteLength > 1_000, `${template} hidden PDF renderer must produce a real document`);
      for (const value of ["Seller Fixture", "QO-PARITY-001", "Customer Fixture", "Suite Fixture", "Fixture issuer"]) {
        assert.ok(renders[template]!.pdfTreeText.includes(value), `${template} PDF tree must include ${value}`);
      }
      assert.doesNotMatch(renders[template]!.hiddenHtml, /Fixture reference|Fixture public note|>night</);
      assert.doesNotMatch(renders[template]!.hiddenPdfTreeText, /Fixture reference|Fixture public note|night/);
    }
  });
  it("keeps every HTML template on the shared public-document contract", () => {
    const templates = [
      source("../components/admin/quotations/templates/quotation-document-current.tsx"),
      source("../components/admin/quotations/templates/quotation-document-hospitality.tsx"),
      source("../components/admin/quotations/templates/quotation-document-corporate.tsx"),
    ];

    for (const template of templates) {
      for (const marker of [
        "data-document-header",
        "data-document-metadata",
        "data-document-customer",
        "data-document-items",
        "data-document-summary",
        "data-document-payment-methods",
        "data-document-notes",
        "data-document-certification",
        "payload.seller",
        "model.documentNumber",
        "payload.seller.name",
        "payload.seller.address",
        "payload.seller.taxId",
        "model.issueDate",
        "model.validUntil",
        "payload.customer.name",
        "payload.customer.address",
        "calculation.lines.map",
        "calculation.grandTotal",
        "model.paymentMethods.map",
        "payload.publicNotes",
        "model.certification",
      ]) {
        assert.match(template, new RegExp(marker));
      }
      assert.doesNotMatch(template, /internalNotes/);
      assert.doesNotMatch(template, /calculateQuotation|document_template_default|accountTemplateDefault/);
    }
  });

  it("uses the draft only for Preview and the saved snapshot for Print", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(
      editor,
      /<QuotationDocument[\s\S]*calculation=\{calculation\}[\s\S]*payload=\{payload\}[\s\S]*publicQrDataUrl=\{draftPublicQrDataUrl\}/,
    );
    assert.match(
      editor,
      /createPortal\([\s\S]*<QuotationDocument[\s\S]*calculation=\{savedCalculation\}[\s\S]*payload=\{lastSavedPayload\}[\s\S]*publicQrDataUrl=\{savedPublicQrDataUrl\}/,
    );
  });

  it("renders Corporate as a distinct procurement-focused document", () => {
    const corporate = source("../components/admin/quotations/templates/quotation-document-corporate.tsx");
    const dispatcher = source("../components/admin/quotations/quotation-document.tsx");

    for (const marker of [
      'data-quotation-template="corporate"',
      "#142d4c",
      "#f2f5f8",
      "data-corporate-company-metadata",
      "data-corporate-recipient",
      "data-corporate-settlement",
      "data-document-items",
      "data-document-payment-methods",
      "data-document-notes",
      "data-document-certification",
      "payload.seller.contactName",
      "payload.seller.contactPhone",
      "payload.seller.contactEmail",
    ]) {
      assert.match(corporate, new RegExp(marker));
    }
    assert.doesNotMatch(corporate, /CurrentQuotationDocument/);
    assert.match(dispatcher, /quotation-document-corporate/);
  });

  it("lets long Corporate payment content flow before its settlement panel", () => {
    const corporate = source("../components/admin/quotations/templates/quotation-document-corporate.tsx");
    const css = source("../app/globals.css");

    assert.match(corporate, /data-corporate-summary-sequential/);
    assert.match(
      css,
      /\[data-corporate-summary-sequential\][\s\S]*break-inside: auto !important/,
    );
  });

  it("renders Hospitality as a distinct accommodation-focused document", () => {
    const hospitality = source("../components/admin/quotations/templates/quotation-document-hospitality.tsx");
    const dispatcher = source("../components/admin/quotations/quotation-document.tsx");

    for (const marker of [
      'data-quotation-template="hospitality"',
      "QUOTATION",
      "#286a5b",
      "#c79b58",
      "data-hospitality-recipient",
      "data-hospitality-settlement",
      "data-document-items",
      "data-document-payment-methods",
      "data-document-notes",
      "data-document-certification",
      "มูลค่ารวม",
      "ส่วนลด",
    ]) {
      assert.match(hospitality, new RegExp(marker));
    }
    assert.doesNotMatch(hospitality, /CurrentQuotationDocument/);
    assert.match(dispatcher, /quotation-document-hospitality/);
  });

  it("groups quotation and certification display switches in one modal", () => {
    const dialog = source("../components/admin/quotations/quotation-document-display-dialog.tsx");
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(dialog, /ข้อมูลใบเสนอราคา/);
    assert.match(dialog, /การรับรอง/);
    assert.match(dialog, /certificationQr/);
    assert.match(dialog, /certificationDate/);
    assert.match(dialog, /certificationName/);
    assert.match(editor, /QuotationDocumentDisplayDialog/);
    assert.match(editor, /payload\.documentDisplay\.reference \?/);
    assert.match(editor, /payload\.documentDisplay\.notes \?/);
    assert.match(editor, /payload\.documentDisplay\.withholdingTax \?/);
    assert.match(editor, /showUnit: payload\.documentDisplay\.unit/);
    assert.match(editor, /showDiscount: payload\.documentDisplay\.discount/);
    assert.match(editor, /showTax: payload\.documentDisplay\.tax/);
  });
  it("adapts the shared A4 document to the approved quotation reference", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");

    assert.match(document, /import \{ formatBaht, formatMoney \}/);
    assert.match(document, /data-document-header/);
    assert.match(document, /data-document-metadata/);
    assert.match(document, /data-document-customer/);
    assert.match(document, /data-document-items/);
    assert.match(document, /data-document-summary/);
    assert.match(document, /--quotation-theme-light/);
    assert.match(document, /table-fixed/);
    assert.match(document, /formatMoney\(item\.unitPrice\)/);
    assert.match(document, /formatMoney\(item\.preTaxAmount\)/);
    assert.match(document, /formatBaht\(calculation\.grandTotal\)/);
    assert.match(document, /ml-5 whitespace-pre-line text-slate-500 \[overflow-wrap:anywhere\]/);
    assert.match(document, /data-document-payment-methods/);
    assert.doesNotMatch(document, /internalNotes/);
  });

  it("preserves Current document sections while the root dispatches by template", () => {
    const currentDocument = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const dispatcher = source("../components/admin/quotations/quotation-document.tsx");

    for (const marker of [
      "data-document-header",
      "data-document-customer",
      "data-document-items",
      "data-document-summary",
      "data-document-payment-methods",
      "data-document-notes",
      "data-document-certification",
    ]) {
      assert.match(currentDocument, new RegExp(marker));
    }
    assert.match(dispatcher, /buildQuotationDocumentViewModel/);
    assert.match(dispatcher, /payload\.template/);
    assert.match(dispatcher, /CurrentQuotationDocument/);
  });

  it("styles document item descriptions as secondary text", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    assert.match(
      document,
      /<p className="ml-5 whitespace-pre-line text-slate-500 \[overflow-wrap:anywhere\]">[\s\S]*?\{item\.description\}[\s\S]*?<\/p>/,
    );
    assert.match(
      document,
      /<p className="font-medium \[overflow-wrap:anywhere\]">[\s\S]*?\{item\.name\}[\s\S]*?<\/p>/,
    );
  });

  it("contains long valid item quantities and money inside fixed table cells", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const containedNumericCell = String.raw`className="max-w-0 p-2 text-right tabular-nums \[overflow-wrap:anywhere\]"`;

    assert.match(
      document,
      new RegExp(`<td ${containedNumericCell}>\\{item\\.quantity\\}</td>`),
    );
    for (const field of ["unitPrice", "discountAmount", "preTaxAmount"]) {
      assert.match(
        document,
        new RegExp(
          `<td ${containedNumericCell}>\\s*\\{formatMoney\\(item\\.${field}\\)\\}\\s*</td>`,
        ),
      );
    }
  });

  it("protects and renders the single seller profile page", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(page, /CompanyProfileForm/);
  });

  it("switches seller settings sections through URL navigation", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(page, /searchParams: Promise<\{ section\?: string; template\?: string \}>/);
    assert.match(page, /section === "payments" \|\| section === "certification"/);
    assert.match(page, /\?section=company/);
    assert.match(page, /\?section=payments/);
    assert.match(page, /current=\{selectedSection === item\.id\}/);
    assert.match(page, /selectedSection === "company"[\s\S]*<CompanyProfileForm/);
    assert.match(page, /selectedSection === "payments"[\s\S]*<PaymentMethodsSettings/);
    assert.match(form, /export function PaymentMethodsSettings/);
    assert.doesNotMatch(form, /<PaymentMethodsSettings[\s\S]*initialMethods=\{initialPaymentMethods\}/);
  });

  it("adds certification master settings with reusable image fields", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    const form = source("../components/admin/quotations/company-profile-form.tsx");
    const fieldsPath = new URL("../components/admin/quotations/certification-fields.tsx", import.meta.url);
    const imageInputPath = new URL("../components/admin/quotations/quotation-png-image-input.tsx", import.meta.url);

    assert.ok(existsSync(fieldsPath), "certification fields component should exist");
    assert.ok(existsSync(imageInputPath), "shared quotation PNG image input should exist");
    const fields = readFileSync(fieldsPath, "utf8");
    const imageInput = readFileSync(imageInputPath, "utf8");

    assert.match(page, /\?section=certification/);
    assert.match(page, /selectedSection === "certification"/);
    assert.match(page, /ข้อมูลรับรองหลัก/);
    assert.match(page, /<CertificationSettings/);
    assert.match(form, /บันทึกข้อมูลรับรอง/);
    assert.match(fields, /ผู้ออกเอกสาร/);
    assert.match(fields, /ผู้อนุมัติ/);
    assert.match(fields, /ตราประทับบริษัท/);
    assert.match(imageInput, /ลบรูป/);
    assert.match(imageInput, /URL\.createObjectURL/);
    assert.match(imageInput, /URL\.revokeObjectURL/);
    assert.match(imageInput, /image\/png,image\/jpeg,image\/webp/);
    assert.match(imageInput, /await onChange\(normalized\)/);
    assert.ok(imageInput.indexOf("setPreviewUrl(localPreviewUrl)") < imageInput.indexOf("await onChange(normalized)"));
    assert.match(imageInput, /setPreviewUrl\(""\)/);
    assert.match(imageInput, /onRemove \? <Button/);
    assert.match(fields, /throw new Error\(message\)/);
    assert.match(fields, /onChange\(\(current\) => updateCertificationSigner/);
    assert.match(fields, /onUploadStateChange\?\.\(field, busy\)/);
    assert.match(form, /const \[uploadingFields, setUploadingFields\] = useState\(new Set<string>\(\)\)/);
    assert.match(form, /if \(uploadingFields\.size\) return/);
    assert.match(form, /const disabled = pending \|\| uploadingFields\.size > 0/);
    assert.match(form, /disabled=\{disabled\}/);
    assert.match(imageInput, /onBusyChange\?\.\(true\)/);
    assert.match(imageInput, /onBusyChange\?\.\(false\)/);
    assert.match(imageInput, /inputRef\.current\.value = ""/);
  });

  it("loads only the data needed by the selected seller settings section", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");

    assert.match(page, /const profile = selectedSection === "payments"\s*\? null\s*: await getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(page, /selectedSection === "payments"\s*\? await Promise\.all\(\[\s*listQuotationBanks\(supabase\),\s*listCompanyPaymentMethods\(supabase, user\.id\),?\s*\]\)/);
  });

  it("guards dirty quotation settings navigation", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    const guard = source("../components/admin/quotations/quotation-settings-dirty.tsx");
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(page, /QuotationSettingsDirtyProvider/);
    assert.match(page, /QuotationSettingsNavLink/);
    assert.match(guard, /beforeunload/);
    assert.match(guard, /window\.confirm/);
    assert.match(guard, /const \{ dirty, markSaved \} = useQuotationSettingsDirty\(\)/);
    assert.match(guard, /if \(dirty\) \{[\s\S]*?if \(!window\.confirm\([\s\S]*?event\.preventDefault\(\);[\s\S]*?return;[\s\S]*?markSaved\(\);/);
    assert.match(guard, /aria-current=\{current \? "page" : undefined\}/);
    assert.match(form, /onChangeCapture=\{markDirty\}/);
    assert.match(form, /markSaved\(\)/);
    assert.equal(form.match(/if \(busy\) markDirty\(\)/g)?.length, 2);
  });

  it("uses flat seller settings with semantic widths and an action footer", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(form, /<SettingsGroup id="registration"/);
    assert.match(form, /<SettingsGroup id="address"/);
    assert.match(form, /<SettingsGroup id="contact"/);
    assert.match(form, /<SettingsGroup id="logo"/);
    assert.match(form, /data-settings-action-footer/);
    assert.match(form, /sm:w-auto/);
    assert.match(form, /officeType === "branch"/);
    assert.match(form, /focusFirstSettingsError/);
    assert.match(form, /toast\.success/);
    assert.doesNotMatch(form, /<Card><CardHeader><CardTitle>/);
  });

  it("renders responsive master payment settings without a tablet five-column squeeze", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(payments, /data-master-payment-method=\{mode === "master" \? "" : undefined\}/);
    assert.match(payments, /mode === "master" \? "rounded-lg border p-4"/);
    assert.match(payments, /flex-wrap/);
    assert.match(payments, /mode === "master" \? "xl:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-5"/);
    assert.match(payments, /mode === "master" \? "xl:col-span-2" : undefined/);
  });

  it("waits for payment uploads before keeping local previews", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(payments, /const upload = async \(name:/);
    assert.match(payments, /setUploading\(true\)/);
    assert.match(payments, /throw new Error\(message\)/);
    assert.match(payments, /setUploading\(false\)/);
    assert.doesNotMatch(payments, /startUpload\(async/);
  });

  it("applies completed payment uploads by stable method id", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(payments, /useRef/);
    assert.match(payments, /const methodsRef = useRef\(methods\)/);
    assert.match(payments, /useLayoutEffect\(\(\) => \{ methodsRef\.current = methods; \}, \[methods\]\)/);
    assert.match(payments, /const emit = \(next: T\[\]\) => \{ methodsRef\.current = next; onChange\(next\); \}/);
    assert.match(payments, /const update = \(id: string, patch: Partial<T>\)/);
    assert.match(payments, /emit\(normalizePaymentPositions\(methodsRef\.current\.map\(\(method\) => method\.id === id \? \{ \.\.\.method, \.\.\.patch \} : method\)\)\)/);
    assert.match(payments, /onDragEnd=\{\(event\) => \{ if \(!event\.canceled\) emit\(/);
    assert.match(payments, /onRemove=\{\(\) => emit\(/);
    assert.match(payments, /onPatch=\{\(patch\) => update\(method\.id, patch\)\}/);
    assert.doesNotMatch(payments, /onPatch=\{\(patch\) => update\(index, patch\)\}/);
  });

  it("uses compact certification settings and independent feedback", () => {
    const fields = source("../components/admin/quotations/certification-fields.tsx");
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(fields, /data-certification-signer/);
    assert.match(fields, /md:grid-cols-2/);
    assert.match(fields, /data-certification-stamp/);
    assert.match(form, /data-settings-action-footer/);
    assert.match(form, /uploadingFields\.size > 0/);
    assert.match(form, /toast\.error/);
  });

  it("uses clear Thai seller copy and previews a selected logo before save", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    for (const copy of [
      "ข้อมูลจดทะเบียน",
      "ชื่อบริษัท / ผู้ขาย",
      "เลขประจำตัวผู้เสียภาษี",
      "สำนักงานใหญ่",
      "ที่อยู่",
      "ช่องทางติดต่อบริษัท",
      "ผู้ติดต่อฝ่ายขาย",
      "โลโก้ผู้ขาย",
      "เลือกโลโก้ใหม่",
      "บันทึกข้อมูลผู้ขาย",
      "บันทึกช่องทางชำระเงิน",
    ]) assert.match(form, new RegExp(copy));

    assert.match(form, /URL\.createObjectURL\(file\)/);
    assert.match(form, /URL\.revokeObjectURL\(logoPreviewUrl\)/);
    assert.match(form, /onChange=\{handleLogoChange\}/);
    assert.match(form, /<Input[^>]*onChange=\{handleLogoChange\}/);
    assert.match(form, /<Input[^>]*disabled=\{disabled\}[^>]*id="logo"/);
    assert.match(form, /const displayedLogoUrl = logoPreviewUrl \|\| logoUrl/);
  });

  it("renders saved payment methods once in the shared document", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const shared = source("../components/admin/quotations/templates/quotation-document-shared.tsx");
    const viewModel = source("../lib/quotation-document-view.ts");
    const globalCss = source("../app/globals.css");

    assert.match(document, /model\.paymentMethods\.length/);
    assert.match(viewModel, /\.sort\(\(left, right\) => left\.position - right\.position\)/);
    assert.match(viewModel, /renderThaiQRPaymentMatrix/);
    assert.match(shared, /method\.qrMode === "auto_promptpay"/);
    assert.match(shared, /method\.qrSource/);
    assert.match(shared, /method\.customBankLogoUrl \|\| method\.bankLogoUrl/);
    assert.match(shared, /method\.accountNumber/);
    assert.match(shared, /method\.promptPayId/);
    assert.match(shared, /method\.instructions/);
    assert.match(shared, /break-inside-avoid/);
    assert.match(shared, /\[overflow-wrap:anywhere\]/);
    assert.match(shared, /ไม่สามารถสร้าง QR ได้/);
    assert.match(viewModel, /amount <= 0/);
    assert.match(globalCss, /\[data-document-payment-methods\]\s*\{\s*break-inside:\s*auto\s*!important/);
    assert.doesNotMatch(document + shared, /internalNotes/);
  });

  it("renders one compact five-slot certification row", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const shared = source("../components/admin/quotations/templates/quotation-document-shared.tsx");
    const imagePath = new URL("../components/admin/quotations/document-image.tsx", import.meta.url);

    assert.ok(existsSync(imagePath), "document image fallback should exist");
    const image = readFileSync(imagePath, "utf8");
    const certificationMarker = document.indexOf("data-document-certification");
    const certification = document.slice(
      document.lastIndexOf("<section", certificationMarker),
      document.length,
    );
    const signer = shared.slice(
      shared.indexOf("function SignerSlot"),
      shared.indexOf("function Total"),
    );

    assert.match(certification, /grid-cols-5/);
    assert.match(
      certification,
      /model\.showCertificationQr \? "grid-cols-5" : "grid-cols-4"/,
    );
    assert.match(
      certification,
      /\{model\.showCertificationQr \? \([\s\S]*data-document-public-qr[\s\S]*\) : null\}/,
    );
    assert.doesNotMatch(
      certification,
      /<section\s*className="[^"]*\bborder-b\b/,
    );
    assert.match(certification, /data-document-public-qr/);
    assert.match(certification, /สแกนเพื่อเปิดด้วยเว็บไซต์/);
    assert.equal(certification.match(/<SignerSlot/g)?.length, 2);
    assert.match(certification, /label="ผู้ออกเอกสาร"/);
    assert.match(certification, /label="ผู้อนุมัติเอกสาร"/);
    assert.match(certification, /data-document-stamp/);
    assert.match(certification, /data-document-receiver/);
    assert.match(certification, /ผู้รับเอกสาร \(ลูกค้า\)/);
    assert.match(certification, /model\.payload\.customer\.name/);
    assert.match(
      certification,
      /data-document-public-qr[\s\S]*label="ผู้ออกเอกสาร"[\s\S]*label="ผู้อนุมัติเอกสาร"[\s\S]*data-document-stamp[\s\S]*data-document-receiver/,
    );
    assert.doesNotMatch(certification, /ตำแหน่ง/);
    assert.doesNotMatch(signer, /signer\.position/);
    assert.match(certification, /break-inside-avoid/);
    assert.match(
      document,
      /const compactCertification = !model\.showCertificationName && !model\.showCertificationDate/,
    );
    assert.equal(
      certification.match(/compactCertification \? "h-12" : "h-20"/g)?.length,
      3,
    );
    assert.equal(
      certification.match(/compact=\{compactCertification\}/g)?.length,
      2,
    );
    assert.match(signer, /compact \? "h-12" : "h-20"/);
    assert.equal(
      certification.match(/compactCertification \? "max-h-10" : "max-h-(?:16|20)"/g)?.length,
      2,
    );
    assert.match(signer, /compact \? "max-h-10" : "max-h-16"/);
    assert.match(certification, /\[overflow-wrap:anywhere\]/);
    assert.match(certification, /<DocumentImage[\s\S]*?object-contain/);
    assert.doesNotMatch(document, /<(?:Input|input)[\s>]/);
    assert.match(image, /useState\(false\)/);
    assert.match(image, /onError=\{\(\) => setUnavailable\(true\)\}/);
    assert.match(image, /if \(unavailable\) return null/);
  });

  it("uses the compact reference hierarchy for preview and print", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const shared = source("../components/admin/quotations/templates/quotation-document-shared.tsx");

    assert.match(document, /data-document-seller-details/);
    assert.match(document, /data-document-seller-contact/);
    assert.match(document, /data-document-number[^>]*whitespace-nowrap/);
    assert.match(
      document,
      /<dl[\s\S]*?data-document-metadata[\s\S]*?data-document-subject[\s\S]*?<\/dl>/,
    );
    assert.doesNotMatch(
      document,
      /<\/dl>\s*\{payload\.subject \? \(\s*<p/,
    );
    assert.match(document, /data-document-notes/);
    assert.match(document, /data-document-summary-heading/);
    assert.match(document, /data-document-summary-breakdown/);
    assert.match(document, /data-document-summary-settlement/);
    assert.match(document, /data-document-summary-grand-total/);
    assert.match(document, /data-document-payment-list/);
    assert.match(document, /data-document-payment-heading/);
    assert.match(
      shared,
      /data-document-payment-entry[\s\S]*?data-document-payment-logo[\s\S]*?data-document-payment-details/,
    );
    assert.match(
      shared,
      /data-document-payment-details[\s\S]*?\{title\}[\s\S]*?accountNumberLine[\s\S]*?method\.accountName/,
    );
    assert.match(shared, /data-document-payment-logo[\s\S]*?className="h-9 w-9/);
    assert.doesNotMatch(document, /grid-cols-2 gap-x-6 gap-y-4/);
    assert.doesNotMatch(document, /border-y/);
    assert.doesNotMatch(document, /formatBaht\(calculation\.grossTotal\)/);
    assert.doesNotMatch(document, /formatBaht\(calculation\.discountTotal\)/);
    assert.ok(document.indexOf("data-document-summary") < document.indexOf("data-document-payment-methods"));
    assert.ok(document.indexOf("data-document-payment-methods") < document.indexOf("data-document-notes"));
    assert.match(
      document,
      /data-document-notes[\s\S]*?<h2[^>]*>[\s\S]*?หมายเหตุ[\s\S]*?<\/h2>/,
    );
    assert.doesNotMatch(document, /เงื่อนไข \/ หมายเหตุ/);
  });

  it("uses accessible icons for seller contact labels", () => {
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");

    assert.match(document, /<Phone aria-hidden="true"/);
    assert.match(document, /<Mail aria-hidden="true"/);
    assert.match(document, /<Globe2 aria-hidden="true"/);
    for (const label of ["โทร", "อีเมล", "เว็บไซต์"]) {
      assert.match(
        document,
        new RegExp(`<span className="sr-only">${label}</span>`),
      );
    }
  });

  it("composes seller settings with sortable payment method masters", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    const form = source("../components/admin/quotations/company-profile-form.tsx");
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(page, /Promise\.all\(/);
    assert.match(page, /getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(page, /listQuotationBanks\(supabase\)/);
    assert.match(page, /listCompanyPaymentMethods\(supabase, user\.id\)/);
    assert.match(form, /PaymentMethodList/);
    assert.match(form, /saveCompanyPaymentMethodsAction/);

    assert.match(payments, /mode: "master" \| "quotation"/);
    assert.match(payments, /bank_transfer[\s\S]*promptpay[\s\S]*qr_payment[\s\S]*cash[\s\S]*other/);
    assert.match(payments, /isDefault/);
    assert.match(payments, /DragDropProvider/);
    assert.match(payments, /useSortable/);
    assert.match(payments, /move\(methodsRef\.current, event\)/);
    assert.match(payments, /PaymentImageInput/);
    assert.match(payments, /result\.formError/);
    assert.match(payments, /OTHER/);
    assert.match(payments, /customBankName/);
    assert.match(payments, /customBankLogoUrl/);
    assert.match(payments, /qrMode/);
    assert.match(payments, /qrImageUrl/);
    assert.match(payments, /mode === "master"/);
    assert.match(payments, /<Plus/);
    assert.match(payments, /Trash2/);
    assert.doesNotMatch(payments, /ArrowUp|ArrowDown/);
  });

  it("resets automatic PromptPay QR when its payment type changes", () => {
    const updated = updatePaymentMethodType({
      accountName: "PromptPay account",
      accountNumber: "",
      accountType: "",
      bankCode: "",
      bankId: null,
      bankLogoUrl: "",
      bankName: "",
      customBankLogoUrl: "",
      customBankName: "",
      id: crypto.randomUUID(),
      instructions: "",
      position: 1,
      promptPayId: "0812345678",
      providerName: "",
      qrImageUrl: "",
      qrMode: "auto_promptpay",
      type: "promptpay",
    }, "cash");

    assert.equal(updated.type, "cash");
    assert.equal(updated.qrMode, "none");
  });

  it("defaults a new QR payment to uploaded QR", () => {
    const updated = updatePaymentMethodType(emptyPaymentMethod("bank_transfer"), "qr_payment");

    assert.equal(updated.type, "qr_payment");
    assert.equal(updated.qrMode, "upload");
  });

  it("defaults a new PromptPay payment to automatic QR", () => {
    const updated = updatePaymentMethodType(emptyPaymentMethod("bank_transfer"), "promptpay");

    assert.equal(updated.type, "promptpay");
    assert.equal(updated.qrMode, "auto_promptpay");
  });

  it("clears a bank account type after changing payment type", () => {
    const updated = updatePaymentMethodType({ ...emptyPaymentMethod(), accountType: "current" }, "cash");

    assert.equal(updated.accountType, "");
  });

  it("derives QR upload render state after changing a bank payment type", () => {
    const qrPayment = updatePaymentMethodType(emptyPaymentMethod("bank_transfer"), "qr_payment");
    const promptPay = updatePaymentMethodType(emptyPaymentMethod("bank_transfer"), "promptpay");

    assert.equal(paymentMethodEditorState(qrPayment).showQrUpload, true);
    assert.equal(promptPay.qrMode, "auto_promptpay");
    assert.equal(paymentMethodEditorState(promptPay).showQrUpload, false);
  });

  it("derives bank and QR controls from the payment method state", () => {
    const otherBank = paymentMethodEditorState({ bankCode: "OTHER", bankId: null, qrMode: "none", type: "bank_transfer" });
    const builtInBank = paymentMethodEditorState({ bankCode: "004", bankId: "bank-id", qrMode: "upload", type: "bank_transfer" });

    assert.deepEqual(otherBank, { bankSelectValue: "OTHER", hasCustomBankFields: true, showQrUpload: false });
    assert.deepEqual(builtInBank, { bankSelectValue: "bank-id", hasCustomBankFields: false, showQrUpload: true });
    assert.deepEqual(
      paymentMethodEditorState({ bankCode: "", bankId: null, qrMode: "none", type: "qr_payment" }),
      { bankSelectValue: "OTHER", hasCustomBankFields: false, showQrUpload: false },
    );
    assert.deepEqual(
      paymentMethodEditorState({ bankCode: "", bankId: null, qrMode: "upload", type: "qr_payment" }),
      { bankSelectValue: "OTHER", hasCustomBankFields: false, showQrUpload: true },
    );
  });

  it("shows optional bank account types only for bank transfers and prints them with the snapshot account number", () => {
    const paymentEditor = source("../components/admin/quotations/payment-method-list.tsx");
    const bankEditorScope = paymentEditor.slice(
      paymentEditor.indexOf('{method.type === "bank_transfer"'),
      paymentEditor.indexOf('{method.type === "promptpay"'),
    );
    const promptPayEditorScope = paymentEditor.slice(
      paymentEditor.indexOf('{method.type === "promptpay"'),
      paymentEditor.indexOf('{method.type === "qr_payment"'),
    );
    const documentSource = source("../components/admin/quotations/templates/quotation-document-shared.tsx");

    assert.match(bankEditorScope, /lg:grid-cols-5/);
    assert.match(bankEditorScope, /label="ธนาคาร"[\s\S]*label="ประเภทบัญชี"[\s\S]*label="ชื่อบัญชี"[\s\S]*label="เลขที่บัญชี"[\s\S]*label="QR โอนเงิน"/);
    assert.match(bankEditorScope, /label="ประเภทบัญชี"/);
    assert.match(bankEditorScope, /update\("accountType"/);
    assert.match(bankEditorScope, /<option value="">ไม่ระบุ<\/option>/);
    assert.match(bankEditorScope, /<option value="savings">ออมทรัพย์<\/option>/);
    assert.match(bankEditorScope, /<option value="current">กระแสรายวัน<\/option>/);
    assert.match(bankEditorScope, /<option value="fixed">ฝากประจำ<\/option>/);
    assert.doesNotMatch(promptPayEditorScope, /ประเภทบัญชี/);
    assert.match(documentSource, /PAYMENT_ACCOUNT_TYPE_LABELS\[method\.accountType\]/);
    assert.match(documentSource, /accountTypeLabel[\s\S]*method\.accountNumber/);
    assert.match(documentSource, /\[accountTypeLabel, method\.accountNumber\]\.filter\(Boolean\)\.join\(" "\)/);
  });

  it("keeps the native bank selection, image labels, and file input within the payment grid", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");
    const imageInput = source("../components/admin/quotations/quotation-png-image-input.tsx");

    assert.match(payments, /<option value="OTHER">อื่น ๆ<\/option>/);
    assert.match(payments, /label="โลโก้ธนาคารอื่น"/);
    assert.match(payments, /label="รูป QR"/);
    assert.match(imageInput, /label: string/);
    assert.match(imageInput, /<Label htmlFor=\{inputId\}>\{label\}<\/Label>/);
    assert.match(imageInput, /className="grid min-w-0 gap-2 text-sm"/);
    assert.match(imageInput, /className="w-full min-w-0 max-w-full"/);
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
    assert.match(form, /import \{ RadioGroup, RadioGroupItem \} from "\.\.\/\.\.\/ui\/radio-group"/);
    assert.match(form, /name="officeType"/);
    assert.match(form, /<RadioGroup[\s\S]*className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2"/);
    assert.match(form, /<RadioGroupItem/);
    assert.match(form, /"unspecified"/);
    assert.match(form, /disabled=\{officeType !== "branch"\}[\s\S]*name="branchNumber"/);
    assert.doesNotMatch(form, /name="branchNumber" type="hidden"/);
    assert.match(form, /digitsOnly[\s\S]*name="taxId"/);
    assert.match(form, /error=\{fieldErrors\.branchNumber\}/);
    assert.match(form, /aria-invalid=\{Boolean\(error\)\}/);
  });

  it("connects every seller profile field error to its control", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(form, /const errorId = `\$\{name\}-error`/);
    assert.match(form, /aria-describedby=\{error \? errorId : undefined\}/);
    assert.match(form, /id=\{errorId\}/);
    assert.match(form, /aria-describedby=\{fieldErrors\.officeType \? "officeType-error" : undefined\}/);
    assert.match(form, /id="officeType-error"/);
    assert.match(form, /aria-describedby=\{fieldErrors\.address \? "address-error" : undefined\}/);
    assert.match(form, /id="address-error"/);
    assert.match(form, /const serverLogoError = fieldErrors\.logo \|\| fieldErrors\.logoUrl/);
    assert.match(form, /aria-describedby=\{logoError \? "logo-error" : undefined\}/);
    assert.match(form, /id="logo-error"/);
  });

  it("associates local and server logo errors with the logo input", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");

    assert.match(form, /const \[localLogoError, setLocalLogoError\] = useState\(""\)/);
    assert.match(form, /const serverLogoError = fieldErrors\.logo \|\| fieldErrors\.logoUrl/);
    assert.match(form, /const logoError = localLogoError \|\| serverLogoError/);
    assert.match(form, /setLocalLogoError\("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB"\)/);
    assert.match(form, /setLocalLogoError\("รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP"\)/);
    assert.match(form, /catch \{[\s\S]*setLocalLogoError\("ไม่สามารถเตรียมโลโก้ได้"\)/);
    assert.doesNotMatch(form, /setLocalLogoError\(cause instanceof Error \? cause\.message/);
    assert.match(form, /aria-describedby=\{logoError \? "logo-error" : undefined\}/);
    assert.match(form, /aria-invalid=\{Boolean\(logoError\)\}/);
  });

  it("uses Thai for payment permission, upload, storage, and save errors", () => {
    const actions = source("../app/admin/quotations/actions.ts");
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(actions, /รูปช่องทางชำระเงินต้องมาจากพื้นที่จัดเก็บของระบบ/);
    assert.match(actions, /กรุณาเลือกรูปช่องทางชำระเงิน/);
    assert.match(actions, /ไม่มีสิทธิ์จัดการใบเสนอราคา/);
    assert.match(actions, /ไม่สามารถอัปโหลดรูปช่องทางชำระเงินได้/);
    assert.match(actions, /ไม่สามารถบันทึกช่องทางชำระเงินได้/);
    assert.match(actions, /error\.message\.includes\("2 MB"\) \? error\.message/);
    assert.match(payments, /ไม่สามารถอัปโหลดรูปช่องทางชำระเงินได้/);
  });

  it("keeps the old asset after a successful profile replacement", () => {
    const actions = source("../app/admin/quotations/actions.ts");
    assert.match(actions, /saveCompanyProfileAction/);
    assert.match(actions, /getQuotationCompanyProfile\(supabase, user\.id\)/);
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

  it("shows complete quotation list loading, empty, and error feedback", () => {
    const page = source("../app/admin/quotations/page.tsx");

    assert.match(page, /import \{ Suspense \} from "react"/);
    assert.match(page, /import \{ Input \} from "\.\.\/\.\.\/\.\.\/components\/ui\/input"/);
    assert.match(page, /function QuotationListSkeleton/);
    assert.match(page, /<Suspense fallback=\{<QuotationListSkeleton \/>\}>/);
    assert.match(page, /<EmptyDescription>/);
    assert.match(page, /สร้างใบเสนอราคาแรก/);
    assert.match(page, /ไม่สามารถโหลดรายการใบเสนอราคาได้/);
    assert.match(page, />ลองใหม่</);
    assert.match(page, /pageSize: 20/);
    assert.doesNotMatch(page, /subject:/);
  });

  it("uses responsive clickable quotation rows, a compact action menu, and delete toasts", () => {
    const list = source("../components/admin/quotations/quotation-list.tsx");

    assert.match(list, /import \{ toast \} from "sonner"/);
    assert.match(list, /function QuotationActionsMenu/);
    assert.match(list, /<DropdownMenu modal=\{false\}>/);
    assert.match(list, /aria-label=\{`เปิดเมนูจัดการ \$\{quotation\.documentNumber\}`\}/);
    assert.match(list, /onClick=\{\(\) => openQuotation\(quotation\)\}/);
    assert.match(list, /aria-label=\{`เปิด \$\{quotation\.documentNumber\}`\}/);
    assert.match(list, /function selectForDelete\(quotation: QuotationListItem\)[\s\S]*?setFormError\(""\)[\s\S]*?setSelected\(quotation\)/);
    assert.match(list, /function closeDeleteDialog\(\)[\s\S]*?setFormError\(""\)[\s\S]*?setSelected\(null\)/);
    assert.match(list, /onOpenChange=\{\(open\) => !open && closeDeleteDialog\(\)\}/);
    assert.match(list, /table-fixed/);
    assert.match(list, /toast\.success/);
    assert.match(list, /toast\.error/);
    assert.match(list, /กำลังลบ…/);
    assert.doesNotMatch(list, /<Button asChild size="sm" variant="outline"><Link/);
    assert.doesNotMatch(list, /<TableHead>อัปเดต<\/TableHead>/);
  });

  it("uses grouped money presentation and grouped money inputs", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const list = source("../components/admin/quotations/quotation-list.tsx");
    const price = editor.slice(
      editor.indexOf("function ItemPriceControls"),
      editor.indexOf("function ItemDiscountControls"),
    );
    const discount = editor.slice(
      editor.indexOf("function ItemDiscountControls"),
      editor.indexOf("function ItemVatControls"),
    );
    const vat = editor.slice(
      editor.indexOf("function ItemVatControls"),
      editor.indexOf("export function QuotationEditor"),
    );

    assert.match(
      editor,
      /import\s*\{\s*formatBaht,\s*formatMoney,\s*normalizeMoneyInput,\s*\}\s*from\s*"\.\.\/\.\.\/\.\.\/lib\/quotation-money"/,
    );
    assert.match(editor, /grouped\?: boolean/);
    assert.match(editor, /onBlur=\{handleBlur\}/);
    assert.match(price, /<Numeric[\s\S]*?grouped[\s\S]*?field=\{`items\.\$\{index\}\.unitPrice`\}/);
    assert.match(discount, /<Numeric[\s\S]*?grouped[\s\S]*?field=\{`items\.\$\{index\}\.discountAmount`\}/);
    assert.doesNotMatch(vat, /\bgrouped\b/);
    assert.match(list, /formatBaht\(quotation\.grandTotal\)/);
    assert.doesNotMatch(list, /Intl\.NumberFormat|Number\(value\)/);
  });

  it("loads create and edit routes through server repositories", () => {
    const createPage = source("../app/admin/quotations/new/page.tsx");
    const editPage = source("../app/admin/quotations/[id]/page.tsx");
    assert.match(createPage, /getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(createPage, /emptyQuotationPayload/);
    assert.match(editPage, /getQuotationById\(supabase, id\)/);
    assert.match(editPage, /notFound\(\)/);
    assert.match(createPage, /canUseQuotation\(adminUser\)/);
    assert.match(editPage, /canUseQuotation\(adminUser\)/);
    assert.match(createPage, /const publicOrigin = getQuotationPublicOrigin\(\)/);
    assert.match(editPage, /const publicOrigin = getQuotationPublicOrigin\(\)/);
    assert.match(createPage, /publicOrigin=\{publicOrigin\}/);
    assert.match(editPage, /publicOrigin=\{publicOrigin\}/);
  });

  it("loads the database item catalogue and uses it as the item-name select", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const createPage = source("../app/admin/quotations/new/page.tsx");
    const editPage = source("../app/admin/quotations/[id]/page.tsx");
    const itemDetails = editor.slice(
      editor.indexOf("function ItemDetailsControls"),
      editor.indexOf("function ItemQuantityControl"),
    );

    assert.match(createPage, /listQuotationItemNames\(supabase\)/);
    assert.match(editPage, /listQuotationItemNames\(supabase\)/);
    assert.match(createPage, /itemNames=\{itemNames\}/);
    assert.match(editPage, /itemNames=\{itemNames\}/);
    assert.match(editor, /itemNames: string\[\]/);
    assert.match(itemDetails, /<select[\s\S]*aria-label="ชื่อรายการ"[\s\S]*itemNames\.map/);
    assert.match(itemDetails, /onUpdate\("name", name\)[\s\S]*onUpdate\("description", name\)/);
    assert.match(itemDetails, /disabled[\s\S]*ค่าเดิม[\s\S]*กรุณาเลือกใหม่/);
    assert.doesNotMatch(itemDetails, /<Input/);
  });

  it("documents the fixed quotation item catalogue for admins", () => {
    const manual = source("../docs/manuals/quotation/README.md");
    assert.match(manual, /ชื่อรายการ.*เลือก/);
    assert.match(manual, /ค่าที่พัก \(ลูกค้าชำระเงินครั้งที่ 1\/2\)/);
    assert.match(manual, /ประกันความเสียหาย/);
    assert.doesNotMatch(manual, /ชื่อและรายละเอียดรายการยังกรอกได้อิสระ/);
  });

  it("copies only default account payment masters into new quotation snapshots", () => {
    const page = source("../app/admin/quotations/new/page.tsx");

    assert.match(page, /Promise\.all\(/);
    assert.match(page, /listQuotationBanks\(supabase\)/);
    assert.match(page, /listCompanyPaymentMethods\(supabase, user\.id\)/);
    assert.match(page, /paymentMethods\.filter\(\(method\) => method\.isDefault\)/);
    assert.match(page, /Reflect\.deleteProperty\(snapshot, "isDefault"\)/);
    assert.match(page, /id: crypto\.randomUUID\(\)/);
    assert.match(page, /position: index \+ 1/);
    assert.match(page, /<QuotationEditor banks=\{banks\}/);
  });

  it("copies the account certification master only when creating a quotation", () => {
    const newPage = source("../app/admin/quotations/new/page.tsx");
    const editPage = source("../app/admin/quotations/[id]/page.tsx");

    assert.match(newPage, /companyProfileToCertification\(profile\)/);
    assert.doesNotMatch(editPage, /companyProfileToCertification/);
    assert.match(editPage, /getQuotationCompanyProfile\(supabase, user\.id\)/);
  });

  it("edits saved payment snapshots without merging current masters", () => {
    const page = source("../app/admin/quotations/[id]/page.tsx");

    assert.match(page, /getQuotationById\(supabase, id\)/);
    assert.match(page, /getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(page, /hydratePaymentMethodBanks\(quotation\.payload\.paymentMethods, banks\)/);
    assert.match(page, /initialPayload=\{initialPayload\}/);
    assert.match(page, /initialTemplateDefault=\{companyProfileToTemplate\(profile\)\}/);
    assert.match(page, /<QuotationEditor banks=\{banks\}/);
    assert.doesNotMatch(page, /listCompanyPaymentMethods/);
  });

  it("edits quotation-only payment snapshots in the workbench", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(editor, /banks: BankOption\[\]/);
    assert.match(editor, /data-payment-methods/);
    assert.ok(editor.indexOf("data-sortable-items") < editor.indexOf("data-payment-methods"));
    assert.match(editor, /<PaymentMethodList[\s\S]*banks=\{banks\}[\s\S]*methods=\{payload\.paymentMethods\}[\s\S]*mode="quotation"[\s\S]*onChange=\{\(paymentMethods\) =>[\s\S]*updateRoot\("paymentMethods", paymentMethods\)[\s\S]*\}/);
    assert.doesNotMatch(editor, /04 ช่องทางชำระเงิน/);
    assert.match(editor, /<Button[\s\S]*disabled=\{!paymentListState\.canAdd\}[\s\S]*เพิ่มช่องทางชำระเงิน[\s\S]*<PaymentMethodList/);
    assert.match(editor, /showAddButton=\{false\}/);
    assert.doesNotMatch(payments, /saveCompanyPaymentMethodsAction/);
    assert.match(payments, /emit\(normalizePaymentPositions\(move\(methodsRef\.current, event\) as T\[\]\)\)/);
    assert.match(payments, /aria-live="polite"[\s\S]*rootError/);
  });

  it("hides bank notes only in the per-quotation payment editor", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");

    assert.match(
      payments,
      /mode !== "quotation" \|\| method\.type !== "bank_transfer"[\s\S]*label="หมายเหตุ"/,
    );
    assert.match(payments, /update\("instructions", event\.target\.value/);
    assert.doesNotMatch(payments, /instructions:\s*""/);
  });

  it("previews the current draft and prints only the latest successful save", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const canUseSavedDocument = Boolean\([\s\S]*documentNumber &&[\s\S]*lastSavedPayload &&[\s\S]*publicToken &&[\s\S]*!isDirty &&[\s\S]*!isPending,[\s\S]*\)/);
    assert.match(editor, /setLastSavedPayload\(result\.payload\)/);
    assert.match(editor, /disabled=\{!calculation\}[\s\S]*onClick=\{\(\) => setPreviewOpen\(true\)\}/);
    assert.match(editor, /<Dialog[\s\S]*calculation=\{calculation\}[\s\S]*payload=\{payload\}[\s\S]*<Dialog/);
    assert.match(editor, /createPortal\([\s\S]*calculation=\{savedCalculation\}[\s\S]*payload=\{lastSavedPayload\}[\s\S]*document\.body/);
    assert.match(editor, /title=\{documentNumber && isDirty \? "บันทึกการเปลี่ยนแปลงก่อน" : undefined\}/);
  });

  it("downloads only the saved clean quotation and blocks repeated activation", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const \[isDownloading, setIsDownloading\] = useState\(false\)/);
    assert.match(editor, /if \(!canUseSavedDocument \|\| !lastSavedPayload \|\| !savedCalculation \|\| !documentNumber \|\| isDownloading\) return/);
    assert.match(editor, /payload: lastSavedPayload/);
    assert.match(editor, /calculation: savedCalculation/);
    assert.match(editor, /disabled=\{!canUseSavedDocument \|\| isDownloading\}/);
    assert.match(editor, /onClick=\{downloadSaved\}/);
    assert.match(editor, /isDownloading \? "กำลังสร้าง PDF…" : "ดาวน์โหลด"/);
    assert.match(editor, /toast\.error\("ไม่สามารถสร้าง PDF ได้ กรุณาลองอีกครั้ง"\)/);
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
    assert.match(editor, /field="subject"[\s\S]*label="เรื่อง \/ ชื่องาน \(ถ้ามี\)"/);
    assert.ok(editor.indexOf("data-document-section") < editor.indexOf('field="reference"'));
    assert.match(editor, /data-field="issueDate"/);
    assert.match(editor, /data-field=\{`items\./);
    assert.match(editor, /discountAmount/);
    assert.match(editor, /publicNotes/);
    assert.match(editor, /internalNotes/);
  });

  it("keeps long editor amounts inside narrow item and summary containers", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const totals = editor.slice(
      editor.indexOf("function Totals"),
      editor.indexOf("function positions"),
    );
    const item = editor.slice(
      editor.indexOf("function SortableQuotationItem"),
      editor.indexOf("function ItemDetailsControls"),
    );
    const withholding = editor.slice(
      editor.indexOf('data-quotation-totals'),
      editor.indexOf("<Dialog onOpenChange"),
    );

    assert.match(totals, /flex flex-wrap items-start justify-between gap-x-3 gap-y-1/);
    assert.match(totals, /<span className="shrink-0">\{label\}<\/span>/);
    assert.match(
      totals,
      /<output className="ml-auto max-w-full text-right tabular-nums \[overflow-wrap:anywhere\]">/,
    );
    assert.match(
      item,
      /max-w-full[^"]*tabular-nums[^"]*\[overflow-wrap:anywhere\]/,
    );
    assert.match(withholding, /flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2/);
    assert.match(withholding, /inputClassName="w-28"/);
    assert.match(
      withholding,
      /<output className="ml-auto max-w-full text-right tabular-nums \[overflow-wrap:anywhere\]">/,
    );
    assert.doesNotMatch(totals, /flex justify-between/);
  });

  it("keeps quotation-specific customer and item fields focused on villa services", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
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

  it("disables save while a save or certification upload is pending", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.equal(editor.match(/const saveDisabled = isPending \|\| uploadingFields\.size > 0/g)?.length, 1);
    assert.ok((editor.match(/disabled=\{saveDisabled\}/g)?.length ?? 0) >= 2);
  });

  it("uses horizontal seller office radios and the shared VAT select geometry", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /minmax\(36px,1fr\)/);
    assert.match(editor, /data-document-fields[^>]*className="grid gap-3 sm:grid-cols-2"/);
    assert.match(editor, /const selectClassName =[\s\S]*?"h-8 rounded-lg/);
    assert.match(editor, /import \{ RadioGroup, RadioGroupItem \} from "\.\.\/\.\.\/ui\/radio-group"/);
    assert.match(editor, /function OfficeTypeControls[\s\S]*<RadioGroup[\s\S]*className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2"[\s\S]*<RadioGroupItem/);
    assert.match(editor, /\["unspecified",/);
    assert.match(editor, /<OfficeTypeControls[\s\S]*field="seller\.officeType"/);
  });

  it("marks every editable native error control as invalid", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const customerPicker = source("../components/admin/quotations/customers/customer-picker-dialog.tsx");
    for (const [field, binding] of [
      ["seller\\.address", 'fieldErrors\\["seller\\.address"\\]'],
      ["issueDate", "fieldErrors\\.issueDate"],
      ["validUntil", "fieldErrors\\.validUntil"],
      ["publicNotes", "fieldErrors\\.publicNotes"],
      ["internalNotes", "fieldErrors\\.internalNotes"],
    ]) {
      assert.match(editor, new RegExp(`<(?:Input|Textarea|select)[^>]*aria-invalid=\\{Boolean\\(${binding}\\)\\}[^>]*data-field="${field}"`));
    }
    assert.match(editor, /function OfficeTypeControls[\s\S]*<RadioGroup[\s\S]*aria-invalid=\{Boolean\(error\)\}[\s\S]*<RadioGroupItem[\s\S]*data-field=\{field\}/);
    assert.match(editor, /<select[^>]*aria-invalid=\{Boolean\(vatError\)\}[^>]*data-field=\{field\}/);
    assert.match(customerPicker, /aria-invalid=\{Boolean\(error\)\}[\s\S]*data-field="customer\.name"/);
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
    assert.ok(editor.indexOf("data-quotation-totals") < editor.indexOf("data-completion-tabs"));
    assert.doesNotMatch(editor, /data-internal-notes[^>]*rounded-xl/);
  });

  it("uses accessible payment-default completion tabs for per-quotation certification", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /role="tablist"/);
    assert.match(editor, /role="tab"/);
    assert.match(editor, /ช่องทางชำระเงิน/);
    assert.match(editor, /การรับรอง/);
    assert.match(editor, /activeCompletionTab/);
    assert.match(editor, /useState<[\s\S]*"certification" \| "payments"[\s\S]*>\("payments"\)/);
    assert.match(editor, /aria-selected=\{activeCompletionTab === "payments"\}/);
    assert.match(editor, /aria-controls="quotation-completion-panel"/);
    assert.match(editor, /<CertificationFields/);
    assert.match(editor, /data-completion-tabs/);
    assert.match(editor, /data-payment-methods/);
    assert.match(editor, /data-certification-fields/);
    assert.match(editor, /lg:col-start-1 lg:row-start-1/);
    assert.match(editor, /lg:col-start-2 lg:row-span-2 lg:row-start-1/);
    assert.match(editor, /lg:col-start-1 lg:row-start-2/);
    assert.match(editor, /const \[completionExpanded, setCompletionExpanded\] = useState\(false\)/);
    assert.match(editor, /const pendingFocusField = useRef<string \| null>\(null\)/);
    assert.match(editor, /aria-controls="quotation-completion-content"/);
    assert.match(editor, /aria-expanded=\{completionExpanded\}/);
    assert.match(editor, /aria-label=\{`\$\{completionExpanded \? "ซ่อน" : "แสดง"\}ข้อมูลท้ายใบเสนอราคา`\}/);
    assert.match(editor, /\{completionExpanded \? "ซ่อน" : "แสดง"\}/);
    assert.match(editor, /hidden=\{!completionExpanded\}[\s\S]*id="quotation-completion-content"/);
    assert.match(editor, /const completionField = errorFields\.find[\s\S]*field === "certification"[\s\S]*field\.startsWith\("certification\."\)[\s\S]*field\.startsWith\("paymentMethods"\)/);
    assert.match(editor, /if \(completionField\)[\s\S]*setCompletionExpanded\(true\)[\s\S]*setActiveCompletionTab\([\s\S]*\? "payments"[\s\S]*: "certification"/);
    assert.match(editor, /useEffect\(\(\) => \{[\s\S]*const field = pendingFocusField\.current;[\s\S]*if \(!field \|\| isPending\) return;[\s\S]*pendingFocusField\.current = null;[\s\S]*focusField\(field\);[\s\S]*\}, \[activeCompletionTab, completionExpanded, fieldErrors, isPending\]\)/);
    assert.match(editor, /if \(!result\.ok\) \{[\s\S]*const errorFields = Object\.keys\(result\.fieldErrors\);[\s\S]*const firstField = errorFields\[0\];[\s\S]*pendingFocusField\.current = firstField\.startsWith\("customer\."\)[\s\S]*\? "customer\.name"[\s\S]*: firstField;[\s\S]*setFieldErrors\(result\.fieldErrors\)/);
  });

  it("blocks quotation saves while certification assets upload", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const \[uploadingFields, setUploadingFields\] = useState\(new Set<string>\(\)\)/);
    assert.match(editor, /setUploadingFields\(\(current\) => \{/);
    assert.match(editor, /if \(uploadingFields\.size\) return/);
    assert.match(editor, /const saveDisabled = isPending \|\| uploadingFields\.size > 0/);
    assert.match(editor, /disabled=\{saveDisabled\}/);
    assert.match(editor, /onUploadStateChange=\{updateUploadState\}/);
    assert.match(editor, /onChange=\{updateCertification\}/);
    assert.match(editor, /data-payment-methods[\s\S]*hidden=\{activeCompletionTab !== "payments"\}/);
    assert.match(editor, /data-certification-fields[\s\S]*hidden=\{activeCompletionTab !== "certification"\}/);
  });

  it("always exposes item discount and fixed VAT choices", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /DropdownMenuCheckboxItem|ตั้งค่าเอกสาร|showItemDiscount|showItemVat/);
    assert.match(editor, /<ItemDiscountControls/);
    assert.match(editor, /<ItemVatControls/);
    assert.match(editor, /<option value="7">7%<\/option>/);
    assert.match(editor, /<option value="0">0%<\/option>/);
    assert.match(editor, /<option value="none">ไม่มี<\/option>/);
    assert.doesNotMatch(editor, /field=\{`items\.\$\{index\}\.vatRate`\}/);
    assert.match(editor, /useState<QuotationPayload>\(\(\) =>[\s\S]*normalizeQuotationVatChoices\(initialPayload\)[\s\S]*\)/);
    assert.match(editor, /initialDocumentNumber \? initialPayload : null/);
  });

  it("keeps validity days disabled in the document fields", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /<TextInput\s+disabled\s+error=\{fieldErrors\.validityDays\}\s+field="validityDays"[\s\S]*?label="จำนวนวัน"/);
  });

  it("uses fixed item discounts and pre-tax item values", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    assert.match(editor, /field=\{`items\.\$\{index\}\.discountAmount`\}/);
    assert.match(editor, /calculation\?\.lines\[index\]\?\.preTaxAmount/);
    const item = editor.slice(editor.indexOf("function SortableQuotationItem"), editor.indexOf("function ItemDetailsControls"));
    const header = editor.slice(editor.indexOf("itemGrid()"), editor.indexOf("<DragDropProvider"));
    assert.match(item, /<span className="xl:sr-only">มูลค่าก่อนภาษี <\/span>/);
    assert.match(header, /<span className="text-right xl:col-start-8">มูลค่าก่อนภาษี<\/span>/);
    assert.doesNotMatch(item + header, />รวม<|>รวม <|รวม<\/span>/);
    assert.match(document, /มูลค่าก่อนภาษี/);
    assert.doesNotMatch(editor + document, /documentDiscount|discountType|discountValue/);
    assert.doesNotMatch(editor, /<option value="percent">%<\/option>/);
  });

  it("clears seller branch numbers when head office is selected", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function updateSellerOfficeType/);
    assert.match(editor, /branchNumber:[\s\S]*?officeType === "branch" \? current\.seller\.branchNumber : ""/);
    assert.match(editor, /disabled=\{payload\.seller\.officeType !== "branch"\}/);
  });

  it("does not add out-of-scope quotation workflow", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.doesNotMatch(editor, /accepted|rejected|approval|qrCode/i);
  });

  it("uses the approved workbench action hierarchy on desktop and mobile", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const commandBar = editor.slice(editor.indexOf("data-workbench-command-bar"), editor.indexOf("data-seller-strip"));
    const sellerStrip = editor.slice(editor.indexOf("data-seller-strip"), editor.indexOf("data-seller-edit"));
    assert.match(commandBar, /\{documentNumber \?\? "ใบเสนอราคาใหม่"\}/);
    assert.match(commandBar, /className="hidden[^\"]*md:flex"[\s\S]*?data-desktop-command-actions/);
    assert.match(commandBar, /onClick=\{closeEditor\}[\s\S]*?>[\s\S]*?กลับ/);
    assert.match(commandBar, /onClick=\{\(\) => setPreviewOpen\(true\)\}[\s\S]*?>[\s\S]*?ดูตัวอย่าง/);
    assert.match(commandBar, /disabled=\{saveDisabled\}[\s\S]*?onClick=\{\(\) => save\(\)\}/);
    assert.match(sellerStrip, /data-document-actions[\s\S]*<Share2[\s\S]*<Printer[\s\S]*<Download[\s\S]*ลบใบเสนอราคา/);
    assert.match(sellerStrip, /\{payload\.id \? \([\s\S]*onClick=\{openDeleteDialog\}[\s\S]*variant="outline"/);
    assert.doesNotMatch(editor, /function DocumentMore/);
    assert.doesNotMatch(editor, /เพิ่มเติม/);
    assert.match(sellerStrip, /<Button[\s\S]*?disabled[\s\S]*?size="sm"[\s\S]*?title=/);
    assert.doesNotMatch(sellerStrip, /<Button disabled title=.*<Share2/);
    assert.match(editor, /data-mobile-command-bar/);
    assert.match(editor, /fixed inset-x-0 bottom-0[\s\S]*?md:hidden/);
    assert.match(editor, /env\(safe-area-inset-bottom\)/);
    assert.match(editor, /pb-24 md:pb-0/);
    assert.match(editor, /const saveDisabled = isPending \|\| uploadingFields\.size > 0/);
  });

  it("links editor errors to controls and reports save results", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function fieldErrorId\(field: string\)/);
    assert.match(editor, /aria-describedby=\{error \? fieldErrorId\(field\) : undefined\}/);
    assert.match(editor, /id=\{fieldErrorId\(field\)\}/);
    assert.match(editor, /scrollIntoView\(\{ block: "center" \}\)/);
    assert.match(editor, /focus\(\{ preventScroll: true \}\)/);
    assert.match(editor, /if \(result\.formError\) toast\.error\(result\.formError\)/);
    assert.match(editor, /toast\.success\("บันทึกใบเสนอราคาแล้ว"\)/);
    assert.match(editor, /if \(firstField\)[\s\S]*pendingFocusField\.current = firstField/);
  });

  it("keeps quotation field errors inline and emits one validation toast", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const errorFields = Object\.keys\(result\.fieldErrors\)[\s\S]*const firstErrorMessage = firstField[\s\S]*result\.fieldErrors\[firstField\][\s\S]*else if \(firstErrorMessage\)[\s\S]*toast\.error\(firstErrorMessage\)/);
    assert.match(editor, /const firstField = errorFields\[0\][\s\S]*pendingFocusField\.current = firstField/);
    assert.doesNotMatch(editor, /focusableFieldErrors/);
    assert.doesNotMatch(editor, /<AlertDescription>\{formError\}<\/AlertDescription>/);
    assert.match(editor, /<AlertDescription>\{calculationError\}<\/AlertDescription>/);
  });

  it("keeps quotation delete failures scoped to the delete dialog", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const \[deleteError, setDeleteError\] = useState\(""\)/);
    assert.match(editor, /if \(!result\.ok\) \{[\s\S]*setDeleteError\(result\.formError\)[\s\S]*toast\.error\(result\.formError\)/);
    assert.match(editor, /<AlertDescription>\{deleteError\}<\/AlertDescription>/);
    assert.doesNotMatch(editor, /const \[formError, setFormError\]/);
  });

  it("keeps invalid dates editable and exposes office and field-error controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function recalculateValidUntil/);
    assert.match(editor, /field="seller\.officeType"/);
    assert.match(editor, /field="seller\.branchNumber"/);
    assert.match(editor, /fieldErrors\["customer\.officeType"\]/);
    assert.match(editor, /fieldErrors\["customer\.branchNumber"\]/);
    assert.match(editor, /<QuotationCustomerPicker/);
    assert.match(editor, /aria-invalid/);
    assert.match(editor, /<FieldError error=\{error\} field=\{field\} \/>/);
  });

  it("focuses the visible copy of responsive item controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /querySelectorAll<HTMLElement>/);
    assert.match(editor, /offsetParent !== null/);
  });

  it("connects payment validation errors to stable accessible controls", () => {
    const payments = source("../components/admin/quotations/payment-method-list.tsx");
    assert.match(payments, /"data-field": field/);
    assert.match(payments, /"aria-invalid": Boolean\(error\)/);
    assert.match(payments, /"aria-describedby": error \? errorId : undefined/);
    assert.match(payments, /id=\{errorId\}/);
    const imageInput = source("../components/admin/quotations/quotation-png-image-input.tsx");
    assert.match(imageInput, /data-field=\{field\}/);
    assert.match(imageInput, /aria-describedby=\{message \? errorId : undefined\}/);
    assert.match(payments, /error=\{error\("type"\)\} field=\{`paymentMethods\.\$\{index\}\.type`\}/);
    assert.match(payments, /error=\{error\("qrMode"\)\} field=\{`paymentMethods\.\$\{index\}\.qrMode`\}/);
    assert.match(payments, /error=\{error\("instructions"\)\} field=\{`paymentMethods\.\$\{index\}\.instructions`\}/);
  });

  it("shows server field errors beside all editable quotation controls in paper order", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const field of [
      "seller.email", "seller.website", "customer.taxId",
    ]) assert.ok(editor.includes(`fieldErrors[\"${field}\"]`) || editor.includes(`fieldErrors.${field}`));
    assert.match(editor, /const error = \(field: string\) => errors\[`items\.\$\{index\}\.\$\{field\}`\]/);
    assert.ok(editor.indexOf('field="seller.officeType"') < editor.indexOf("data-customer-section"));
    assert.ok(editor.indexOf('field="customer.officeType"') < editor.indexOf("data-sortable-items"));
  });

  it("keeps each item control in the one responsive sortable item", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    for (const control of ["ItemQuantityControl", "ItemUnitControl", "ItemPriceControls", "ItemDiscountControls", "ItemVatControls"]) {
      assert.match(editor, new RegExp(`<${control}`));
    }
    assert.match(editor, /function SortableQuotationItem/);
    assert.doesNotMatch(editor, /<td className="p-2"><Item/);
  });

  it("shows one visible label per desktop item column", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const header = editor.slice(editor.indexOf("itemGrid()"), editor.indexOf("<DragDropProvider"));

    assert.ok(editor.includes("xl:[&_label>span:first-child]:sr-only"));
    assert.match(header, /documentDisplay\.unit \? <span className="xl:col-start-4">หน่วย<\/span> : null/);
  });

  it("surfaces optional item unit validation errors", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function ItemUnitControl\([\s\S]*?errors\[`items\.\$\{index\}\.unit`\]/);
    assert.match(editor, /field=\{`items\.\$\{index\}\.unit`\}[\s\S]*?onUpdate\("unit", value\)[\s\S]*?value=\{item\.unit\}/);
  });

  it("shows desktop select errors beside VAT controls", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const vatError = error\("vatTreatment"\) \?\? error\("vatRate"\)/);
    assert.match(editor, /const treatmentControl = labelled \?[\s\S]*?error=\{vatError\}[\s\S]*?<FieldError[\s\S]*?error=\{vatError\}/);
  });

  it("keeps the total and delete controls last in every desktop item grid", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function itemGrid\(\)[\s\S]*return "xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /aria-label=\{`ลบรายการ[\s\S]*?className="xl:col-start-\[-2\]"/);
    assert.match(editor, /className="[^"]*xl:col-start-\[-3\][^"]*"[\s\S]*?<span className="xl:sr-only">มูลค่าก่อนภาษี/);
    assert.match(editor, /className="text-right xl:col-start-8">มูลค่าก่อนภาษี/);
  });

  it("keeps item discount and VAT controls on the first desktop ledger row", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /<div className="xl:col-start-6 xl:row-start-1">\s*<ItemDiscountControls/);
    assert.match(editor, /<div className="xl:col-start-7 xl:row-start-1">\s*<ItemVatControls/);
  });

  it("keeps the VAT choice within its grid column", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /className=\{cn\("w-full min-w-0", selectClassName\)\}/);
    assert.doesNotMatch(editor, /label=\{labelled \? "อัตรา"/);
  });

  it("prints the saved document through an isolated body-level portal", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const css = source("../app/globals.css");
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");

    assert.match(editor, /import \{ createPortal \} from "react-dom"/);
    assert.match(editor, /const \[isPrinting, setIsPrinting\] = useState\(false\)/);
    assert.match(editor, /setIsPrinting\(true\)/);
    assert.match(editor, /createPortal\([\s\S]*data-quotation-print[\s\S]*document\.body/);
    assert.match(editor, /window\.addEventListener\("afterprint", cleanup/);
    assert.match(
      editor,
      /querySelectorAll<HTMLImageElement>\(\s*"\[data-quotation-print\] img"\s*,?\s*\)/,
    );
    assert.match(editor, /await waitForQuotationPrintImages/);
    assert.match(editor, /AbortController/);
    assert.ok(editor.indexOf("await waitForQuotationPrintImages") < editor.indexOf("window.print()"));
    assert.match(editor, /setIsPrinting\(false\)/);
    assert.match(
      editor,
      /catch \{[\s\S]*if \(!controller\.signal\.aborted\)[\s\S]*toast\.error\(\s*"ไม่สามารถเตรียมเอกสารสำหรับพิมพ์ได้ กรุณาลองอีกครั้ง"[\s\S]*cleanup\(\)/,
    );
    assert.match(css, /body > :not\(\[data-quotation-print\]\)/);
    assert.match(css, /display: none !important/);
    assert.match(css, /thead \{ display: table-header-group/);
    assert.match(css, /\[data-layout-zone="body"\],[\s\S]*\[data-document-items\],[\s\S]*break-inside:\s*auto !important/);
    assert.doesNotMatch(css, /\[data-quotation-document\] section,\s*\[data-document-summary\]/);
    assert.doesNotMatch(css, /body \* \{ visibility: hidden/);
    assert.doesNotMatch(css, /height: 297mm|overflow: hidden/);
    assert.match(editor, /lastSavedPayload/);
    assert.match(editor, /setLastSavedPayload\(result\.payload\)/);
    assert.match(editor, /QuotationDocument/);
    assert.match(document, /data-quotation-document/);
    assert.doesNotMatch(document, /internalNotes/);
    assert.match(document, /payload\.subject/);
  });

  it("uses a dialog for every quotation editor confirmation", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /type PendingConfirmation = "close" \| null/);
    assert.match(editor, /setPendingConfirmation\("close"\)/);
    assert.doesNotMatch(editor, /setPendingConfirmation\("disable-(?:discount|vat)"\)/);
    assert.match(editor, /open=\{pendingConfirmation !== null\}/);
    assert.doesNotMatch(editor, /window\.confirm/);
    assert.match(editor, /beforeunload/);
    assert.match(editor, /deleteQuotationAction/);
    assert.match(editor, /router\.push\("\/admin\/quotations"\)/);
  });

  it("preserves quotation values when a confirmation dialog is cancelled", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /onOpenChange=\{\(open\) => !open && setPendingConfirmation\(null\)\}/);
    assert.match(editor, /onClick=\{\(\) => setPendingConfirmation\(null\)\}[\s\S]*ยกเลิก/);
  });

  it("loads an edit quotation with a one-time print option and isolates print CSS", () => {
    const page = source("../app/admin/quotations/[id]/page.tsx");
    const css = source("../app/globals.css");
    assert.match(page, /searchParams: Promise<\{ print\?: string \}>/);
    assert.match(page, /printOnLoad=\{print === "1"\}/);
    assert.match(css, /html\.quotation-printing \[data-quotation-print\]/);
    assert.match(css, /\[data-quotation-document\] tr/);
  });

  it("preserves quotation background colors when printing", () => {
    const css = source("../app/globals.css");

    assert.match(
      css,
      /\[data-quotation-document\]\s*\{[^}]*-webkit-print-color-adjust:\s*exact/,
    );
    assert.match(
      css,
      /\[data-quotation-document\]\s*\{[^}]*[;{\r\n]\s*print-color-adjust:\s*exact/,
    );
  });

  it("prints the last saved quotation while a newer draft is dirty", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const canPrint = Boolean\([\s\S]*documentNumber && lastSavedPayload && !isPending && !publicQrPending/);
    assert.match(editor, /if \(!canPrint\) return/);
    assert.match(editor, /calculation=\{savedCalculation\}/);
    assert.match(editor, /payload=\{lastSavedPayload\}/);
    assert.match(editor, /printStyle\.textContent = "@page \{ size: A4; margin: 16mm 10mm 10mm; \}"/);
    assert.match(editor, /printStyle\.remove\(\)/);
  });

  it("replaces the customer draft through the five-field snapshot contract", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /function replaceCustomerSnapshot\(customer: CustomerSnapshot\)/);
    assert.match(editor, /\["name", "address", "taxId", "officeType", "branchNumber"\] as const/);
    assert.match(editor, /changed\(`customer\.\$\{field\}`\)/);
    assert.doesNotMatch(editor, /customer\.(contactName|contactPhone|contactEmail)/);
  });

  it("keeps quotation customer identity read-only after customer-data selection", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const customerSection = editor.slice(
      editor.indexOf("data-customer-section"),
      editor.indexOf("data-document-section"),
    );

    assert.match(customerSection, /<QuotationCustomerPicker/);
    assert.doesNotMatch(customerSection, /onChange=/);
    assert.doesNotMatch(customerSection, /<TextInput|<Textarea|<OfficeTypeControls/);
    assert.doesNotMatch(editor, /function updateCustomerOfficeType/);
  });

  it("offers an accessible quotation template selector with account default scope", () => {
    const templateDialog = source("../components/admin/quotations/quotation-template-dialog.tsx");
    const templateThumbnail = source("../components/admin/quotations/quotation-template-thumbnail.tsx");
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(templateDialog, /Dialog/);
    assert.match(templateDialog, /RadioGroup/);
    assert.match(templateDialog, /Card/);
    assert.match(templateDialog, /กำลังใช้/);
    assert.match(templateDialog, /ค่าเริ่มต้นของบัญชี/);
    assert.match(templateDialog, /ใช้เฉพาะใบเสนอราคานี้/);
    assert.match(templateDialog, /ใช้และบันทึกเป็นค่าเริ่มต้น/);
    assert.match(templateDialog, /มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว/);
    for (const key of ["current", "hospitality", "corporate"]) {
      assert.match(templateThumbnail, new RegExp(`data-template-thumbnail=["']${key}["']`));
    }
    assert.match(editor, /saveQuotationTemplateDefaultAction/);
    assert.match(editor, /initialTemplateDefault: QuotationTemplate/);
    assert.match(editor, /useState\(initialTemplateDefault\)/);
    assert.match(editor, /changed\("template"\)/);
    assert.match(editor, /template: value/);
  });
});
