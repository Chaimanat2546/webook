import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyPaymentMethod, paymentMethodEditorState, updatePaymentMethodType } from "../lib/quotation-payment-methods.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("quotation UI", () => {
  it("adapts the shared A4 document to the approved quotation reference", () => {
    const document = source("../components/admin/quotations/quotation-document.tsx");

    assert.match(document, /import \{ formatBaht, formatMoney \}/);
    assert.match(document, /data-document-header/);
    assert.match(document, /data-document-metadata/);
    assert.match(document, /data-document-customer/);
    assert.match(document, /data-document-items/);
    assert.match(document, /data-document-summary/);
    assert.match(document, /bg-indigo-50/);
    assert.match(document, /table-fixed/);
    assert.match(document, /formatMoney\(item\.unitPrice\)/);
    assert.match(document, /formatMoney\(item\.preTaxAmount\)/);
    assert.match(document, /formatBaht\(calculation\.grandTotal\)/);
    assert.match(document, /ml-5 whitespace-pre-line text-slate-500 \[overflow-wrap:anywhere\]/);
    assert.match(document, /data-document-payment-methods/);
    assert.doesNotMatch(document, /internalNotes/);
  });

  it("styles document item descriptions as secondary text", () => {
    const document = source("../components/admin/quotations/quotation-document.tsx");
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
    const document = source("../components/admin/quotations/quotation-document.tsx");
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

    assert.match(page, /searchParams: Promise<\{ section\?: string \}>/);
    assert.match(page, /section === "payments" \|\| section === "certification"/);
    assert.match(page, /\?section=company/);
    assert.match(page, /\?section=payments/);
    assert.match(page, /aria-current=\{selectedSection === item\.id \? "page" : undefined\}/);
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
    assert.ok(imageInput.indexOf("await onChange(normalized)") < imageInput.indexOf("setPreviewUrl(URL.createObjectURL(normalized))"));
    assert.match(imageInput, /onRemove \? <Button/);
    assert.match(fields, /throw new Error\(message\)/);
    assert.match(fields, /onChange\(\(current\) => updateCertificationSigner/);
    assert.match(fields, /onUploadStateChange\?\.\(field, busy\)/);
    assert.match(form, /const \[uploadingFields, setUploadingFields\] = useState\(new Set<string>\(\)\)/);
    assert.match(form, /if \(uploadingFields\.size\) return/);
    assert.match(form, /disabled=\{pending \|\| uploadingFields\.size > 0\}/);
    assert.match(imageInput, /onBusyChange\?\.\(true\)/);
    assert.match(imageInput, /onBusyChange\?\.\(false\)/);
    assert.match(imageInput, /inputRef\.current\.value = ""/);
  });

  it("loads only the data needed by the selected seller settings section", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");

    assert.match(page, /const profile = selectedSection === "payments"\s*\? null\s*: await getQuotationCompanyProfile\(supabase, user\.id\)/);
    assert.match(page, /selectedSection === "payments"\s*\? await Promise\.all\(\[\s*listQuotationBanks\(supabase\),\s*listCompanyPaymentMethods\(supabase, user\.id\),?\s*\]\)/);
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
    assert.match(form, /<Input[^>]*onChange=\{handleLogoChange\}[^>]*disabled=\{disabled\}/);
    assert.match(form, /const displayedLogoUrl = logoPreviewUrl \|\| logoUrl/);
  });

  it("renders saved payment methods once in the shared document", () => {
    const document = source("../components/admin/quotations/quotation-document.tsx");
    const viewModel = source("../lib/quotation-document-view.ts");
    const globalCss = source("../app/globals.css");

    assert.match(document, /model\.paymentMethods\.length/);
    assert.match(viewModel, /\.sort\(\(left, right\) => left\.position - right\.position\)/);
    assert.match(viewModel, /renderThaiQRPaymentMatrix/);
    assert.match(document, /method\.qrMode === "auto_promptpay"/);
    assert.match(document, /method\.qrSource/);
    assert.match(document, /method\.customBankLogoUrl \|\| method\.bankLogoUrl/);
    assert.match(document, /method\.accountNumber/);
    assert.match(document, /method\.promptPayId/);
    assert.match(document, /method\.instructions/);
    assert.match(document, /break-inside-avoid/);
    assert.match(document, /\[overflow-wrap:anywhere\]/);
    assert.match(document, /ไม่สามารถสร้าง QR ได้/);
    assert.match(viewModel, /amount <= 0/);
    assert.match(globalCss, /\[data-document-payment-methods\]\s*\{\s*break-inside:\s*auto\s*!important/);
    assert.doesNotMatch(document, /internalNotes/);
  });

  it("renders the optional Public QR and read-only certification document", () => {
    const document = source("../components/admin/quotations/quotation-document.tsx");
    const imagePath = new URL("../components/admin/quotations/document-image.tsx", import.meta.url);

    assert.ok(existsSync(imagePath), "document image fallback should exist");
    const image = readFileSync(imagePath, "utf8");
    assert.match(document, /data-document-public-qr/);
    assert.match(document, /สแกนเพื่อดูเอกสารออนไลน์/);
    assert.match(document, /data-document-certification/);
    assert.equal(document.match(/<SignerSlot/g)?.length, 2);
    assert.equal(document.match(/data-document-signer/g)?.length, 1);
    assert.equal(document.match(/data-document-receiver/g)?.length, 1);
    assert.match(document, /model\.issueDate/);
    assert.match(document, /break-inside-avoid/);
    assert.match(document, /grid-cols-1[\s\S]*sm:grid-cols-3[\s\S]*print:grid-cols-3/);
    assert.match(document, /<DocumentImage[\s\S]*?object-contain/);
    assert.doesNotMatch(document, /<(?:Input|input)[\s>]/);
    assert.match(image, /useState\(false\)/);
    assert.match(image, /onError=\{\(\) => setUnavailable\(true\)\}/);
    assert.match(image, /if \(unavailable\) return null/);
  });

  it("uses the compact reference hierarchy for preview and print", () => {
    const document = source("../components/admin/quotations/quotation-document.tsx");

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
      document,
      /data-document-payment-entry[\s\S]*?data-document-payment-logo[\s\S]*?data-document-payment-details/,
    );
    assert.match(
      document,
      /data-document-payment-details[\s\S]*?\{title\}[\s\S]*?accountNumberLine[\s\S]*?method\.accountName/,
    );
    assert.match(document, /data-document-payment-logo[\s\S]*?className="h-9 w-9/);
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
    const document = source("../components/admin/quotations/quotation-document.tsx");

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
    assert.match(payments, /move\(methods, event\)/);
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
    const documentSource = source("../components/admin/quotations/quotation-document.tsx");

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
    assert.match(form, /officeType === "branch"[\s\S]*name="branchNumber"[\s\S]*required/);
    assert.match(form, /name="branchNumber" type="hidden" value=""/);
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
    assert.doesNotMatch(editPage, /companyProfileToCertification|getQuotationCompanyProfile/);
  });

  it("edits saved payment snapshots without merging current masters", () => {
    const page = source("../app/admin/quotations/[id]/page.tsx");

    assert.match(page, /Promise\.all\(\[getQuotationById\(supabase, id\), listQuotationBanks\(supabase\)\]\)/);
    assert.match(page, /hydratePaymentMethodBanks\(quotation\.payload\.paymentMethods, banks\)/);
    assert.match(page, /initialPayload=\{initialPayload\}/);
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
    assert.match(payments, /onChange\(normalizePaymentPositions\(move\(methods, event\) as T\[\]\)\)/);
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
    assert.match(editor, /previewEnabled=\{Boolean\(calculation\)\}/);
    assert.match(editor, /<Dialog[\s\S]*calculation=\{calculation\}[\s\S]*payload=\{payload\}[\s\S]*<Dialog/);
    assert.match(editor, /createPortal\([\s\S]*calculation=\{savedCalculation\}[\s\S]*payload=\{lastSavedPayload\}[\s\S]*document\.body/);
    assert.match(editor, /title=\{documentNumber && isDirty \? "บันทึกการเปลี่ยนแปลงก่อน" : undefined\}/);
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

  it("disables save while a save or certification upload is pending", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /<DropdownMenuItem disabled=\{saveDisabled\} onSelect=\{onSave\}/);
    assert.equal(editor.match(/saveDisabled=\{isPending \|\| uploadingFields\.size > 0\}/g)?.length, 1);
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
    assert.match(editor, /if \(firstField\?\.startsWith\("certification\."\)\) setActiveCompletionTab\("certification"\)/);
    assert.match(editor, /if \(firstField\?\.startsWith\("paymentMethods"\)\) setActiveCompletionTab\("payments"\)/);
  });

  it("blocks quotation saves while certification assets upload", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");

    assert.match(editor, /const \[uploadingFields, setUploadingFields\] = useState\(new Set<string>\(\)\)/);
    assert.match(editor, /setUploadingFields\(\(current\) => \{/);
    assert.match(editor, /if \(uploadingFields\.size\) return/);
    assert.match(editor, /disabled=\{isPending \|\| uploadingFields\.size > 0\}/);
    assert.match(editor, /onUploadStateChange=\{updateUploadState\}/);
    assert.match(editor, /onChange=\{updateCertification\}/);
    assert.match(editor, /data-payment-methods[\s\S]*hidden=\{activeCompletionTab !== "payments"\}/);
    assert.match(editor, /data-certification-fields[\s\S]*hidden=\{activeCompletionTab !== "certification"\}/);
  });

  it("offers transient item discount and VAT document settings", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /ตั้งค่าเอกสาร/);
    assert.match(editor, /DropdownMenuCheckboxItem/);
    assert.match(editor, /ส่วนลดเฉพาะรายการ/);
    assert.match(editor, /VAT เฉพาะรายการ/);
    assert.match(editor, /initialPayload\.items\.some\(\(item\) => Number\(item\.discountAmount\) > 0\)/);
    assert.match(editor, /initialPayload\.items\.some\(\(item\) => item\.vatTreatment !== "none"\)/);
    assert.match(editor, /!enabled\s*&&\s*payload\.items\.some\(\(item\) => Number\(item\.vatRate\) > 0\)[\s\S]*?!window\.confirm/);
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
    assert.match(editor, /<DropdownMenuItem disabled=\{!previewEnabled\} onSelect=\{onPreview\}/);
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
    assert.match(editor, /if\s*\(\s*showItemDiscount && showItemVat\s*\)\s*return\s*"xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /if\s*\(\s*showItemDiscount\s*\)\s*return\s*"xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /if\s*\(\s*showItemVat\s*\)\s*return\s*"xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_9rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /return\s*"xl:grid-cols-\[2\.5rem_minmax\(16rem,1fr\)_5rem_5rem_7\.5rem_8\.5rem_2\.5rem\]"/);
    assert.match(editor, /aria-label=\{`ลบรายการ[\s\S]*?className="xl:col-start-\[-2\]"/);
    assert.match(editor, /className="[^"]*xl:col-start-\[-3\][^"]*"[\s\S]*?<span className="xl:sr-only">มูลค่าก่อนภาษี/);
    assert.doesNotMatch(editor, /xl:col-start-8/);
  });

  it("keeps optional item controls on the first desktop ledger row", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /props\.showItemDiscount\s*\?\s*\(\s*<div className="xl:col-start-6 xl:row-start-1">\s*<ItemDiscountControls/);
    assert.match(editor, /props\.showItemVat\s*\?\s*\(\s*<div\s*className=\{cn\(\s*"xl:row-start-1",\s*props\.showItemDiscount\s*\?\s*"xl:col-start-7"\s*:\s*"xl:col-start-6",\s*\)\}\s*>\s*<ItemVatControls/);
  });

  it("keeps two-up item controls within their grid columns", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /className=\{cn\("w-full min-w-0", selectClassName\)\}/);
    assert.match(editor, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  });

  it("prints the saved document through an isolated body-level portal", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const css = source("../app/globals.css");
    const document = source("../components/admin/quotations/quotation-document.tsx");

    assert.match(editor, /import \{ createPortal \} from "react-dom"/);
    assert.match(editor, /const \[isPrinting, setIsPrinting\] = useState\(false\)/);
    assert.match(editor, /setIsPrinting\(true\)/);
    assert.match(editor, /createPortal\([\s\S]*data-quotation-print[\s\S]*document\.body/);
    assert.match(editor, /window\.addEventListener\("afterprint", cleanup/);
    assert.match(editor, /querySelectorAll<HTMLImageElement>\("\[data-quotation-print\] img"\)/);
    assert.match(editor, /await waitForQuotationPrintImages/);
    assert.match(editor, /AbortController/);
    assert.ok(editor.indexOf("await waitForQuotationPrintImages") < editor.indexOf("window.print()"));
    assert.match(editor, /setIsPrinting\(false\)/);
    assert.match(css, /body > :not\(\[data-quotation-print\]\)/);
    assert.match(css, /display: none !important/);
    assert.match(css, /thead \{ display: table-header-group/);
    assert.doesNotMatch(css, /body \* \{ visibility: hidden/);
    assert.doesNotMatch(css, /height: 297mm|overflow: hidden/);
    assert.match(editor, /lastSavedPayload/);
    assert.match(editor, /setLastSavedPayload\(result\.payload\)/);
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
    assert.match(editor, /const canPrint = Boolean\([\s\S]*documentNumber && lastSavedPayload && !isPending && !publicQrPending/);
    assert.match(editor, /if \(!canPrint\) return/);
    assert.match(editor, /calculation=\{savedCalculation\}/);
    assert.match(editor, /payload=\{lastSavedPayload\}/);
    assert.match(editor, /printStyle\.textContent = "@page \{ size: A4; margin: 0; \}"/);
    assert.match(editor, /printStyle\.remove\(\)/);
  });
});
