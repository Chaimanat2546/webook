import "server-only";

import {
  calculateQuotation,
  formatThaiBahtText,
  type QuotationCalculation,
  type QuotationItemInput,
  type VatTreatment,
} from "../../lib/quotation-calculator.ts";
import {
  certificationSnapshotToJson,
  emptyCertificationSnapshot,
  type CertificationSigner,
  type CertificationSnapshot,
} from "../../lib/quotation-certification.ts";
import { addQuotationCalendarDays, getBangkokCalendarDate } from "../../lib/quotation-dates.ts";
import type { QuotationPaymentMethod } from "../../lib/quotation-payment-methods.ts";
import {
  applyQuotationDocumentDisplay,
  isQuotationDocumentDisplay,
  QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
  type QuotationDocumentDisplay,
} from "../../lib/quotation-document-display.ts";
import {
  DEFAULT_QUOTATION_TEMPLATE,
  isQuotationTemplate,
  type QuotationTemplate,
} from "../../lib/quotation-template.ts";
import {
  canonicalQuotationLayoutSnapshot,
  isQuotationLayoutConfig,
  QUOTATION_LAYOUT_SCHEMA_VERSION,
  type QuotationLayoutSnapshot,
} from "../../lib/quotation-layout.ts";
import type { CustomerSnapshot, QuotationPayload, SellerSnapshot } from "../../lib/quotation-types.ts";
import { preparePaymentMethods } from "./quotation-payment-methods.ts";

const REQUIRED_MESSAGES = {
  customerAddress: "กรุณากรอกที่อยู่ลูกค้า", customerName: "กรุณากรอกชื่อลูกค้า", itemName: "กรุณากรอกชื่อรายการ", itemUnit: "กรุณากรอกหน่วยนับ",
  sellerAddress: "กรุณากรอกที่อยู่ผู้ขาย", sellerName: "กรุณากรอกชื่อผู้ขาย", sellerTaxId: "กรุณากรอกเลขประจำตัวผู้เสียภาษีผู้ขาย",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,12}(?:\.\d{1,2})?$/;
const QUANTITY = /^\d{1,9}(?:\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(?:\.\d{1,2})?$/;
const TAX_ID = /^\d{13}$/;

export class QuotationValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("Quotation validation failed");
    this.name = "QuotationValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export interface PreparedQuotation {
  amountInWords: string;
  calculation: QuotationCalculation;
  payload: QuotationPayload;
  rpcPayload: {
    customer_snapshot: CustomerSnapshot; id: string | null; internal_notes: string; issue_date: string;
    certification_snapshot: ReturnType<typeof certificationSnapshotToJson>;
    document_layout_schema_version_snapshot: number;
    document_layout_snapshot: QuotationLayoutSnapshot["config"];
    document_template_revision_snapshot: number;
    document_template_source_id: string;
    document_template_snapshot: QuotationTemplate;
    document_display_snapshot: QuotationDocumentDisplay;
    items: Array<{ description: string; discount_amount: string; name: string; position: number; quantity: string; unit: string | null; unit_price: string; vat_rate: string; vat_treatment: VatTreatment }>;
    payment_methods: Array<{ account_name: string; account_number: string; account_type: string; bank_code: string; bank_id: string | null; bank_logo_url: string; bank_name: string; custom_bank_logo_url: string; custom_bank_name: string; id: string; instructions: string; position: number; promptpay_id: string; provider_name: string; qr_image_url: string; qr_mode: string; type: string }>;
    public_notes: string; reference: string; seller_snapshot: SellerSnapshot; subject: string; withholding_tax_rate: string | null;
    totals: Pick<QuotationCalculation, "amountDue" | "discountTotal" | "grandTotal" | "grossTotal" | "preTaxTotal" | "vatTotal" | "withholdingTaxTotal">;
    valid_until: string; validity_days: number | null;
  };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function stringValue(object: Record<string, unknown>, key: string): string { const value = object[key]; return typeof value === "string" ? value.trim() : ""; }
function trimValue(value: unknown): unknown { return typeof value === "string" ? value.trim() : value; }
function optionalEmail(value: string, field: string, message: string, errors: Record<string, string>) { if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = message; }
function validDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function bounded(value: string, max: number, field: string, errors: Record<string, string>) { if (value.length > max) errors[field] = "ข้อมูลยาวเกินกำหนด"; return value; }
function enumValue<T extends string>(value: unknown, values: readonly T[], field: string, errors: Record<string, string>, fallback: T): T { if (typeof value === "string" && values.includes(value as T)) return value as T; errors[field] = "ค่าที่เลือกไม่ถูกต้อง"; return fallback; }
function branchNumber(source: Record<string, unknown>, officeType: "branch" | "head_office" | "unspecified", field: string, errors: Record<string, string>): string {
  if (officeType !== "branch") return "";
  const value = bounded(stringValue(source, "branchNumber"), 200, field, errors);
  if (!value) errors[field] = "กรุณากรอกเลขสาขา";
  return value;
}
function numeric(value: string, expression: RegExp, field: string, errors: Record<string, string>, percentage = false): string { if (!expression.test(value) || (percentage && Number(value) > 100)) errors[field] = "ตัวเลขไม่ถูกต้อง"; return value; }

export function prepareCertificationSnapshot(value: unknown): CertificationSnapshot {
  const errors: Record<string, string> = {};
  let source: Record<string, unknown>;
  try { source = objectValue(value ?? {}, "certification"); }
  catch { errors.certification = "ข้อมูลรับรองไม่ถูกต้อง"; source = {}; }

  const signer = (key: "approver" | "issuer"): CertificationSigner => {
    let row: Record<string, unknown>;
    try { row = objectValue(source[key] ?? {}, `certification.${key}`); }
    catch { errors[`certification.${key}`] = "ข้อมูลผู้ลงนามไม่ถูกต้อง"; row = {}; }
    return {
      name: bounded(stringValue(row, "name"), 200, `certification.${key}.name`, errors),
      position: bounded(stringValue(row, "position"), 200, `certification.${key}.position`, errors),
      signatureUrl: bounded(stringValue(row, "signatureUrl"), 2_048, `certification.${key}.signatureUrl`, errors),
    };
  };

  const certification = {
    approver: signer("approver"),
    companyStampUrl: bounded(stringValue(source, "companyStampUrl"), 2_048, "certification.companyStampUrl", errors),
    issuer: signer("issuer"),
  };
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return certification;
}

export function prepareSellerSnapshot(value: unknown): SellerSnapshot {
  let source: Record<string, unknown>;
  try { source = objectValue(value, "seller"); }
  catch { throw new QuotationValidationError({ seller: "Invalid seller" }); }
  source.officeType = trimValue(source.officeType);
  const errors: Record<string, string> = {};
  const office = enumValue(source.officeType, ["branch", "head_office", "unspecified"], "seller.officeType", errors, "head_office");
  const seller: SellerSnapshot = {
    address: bounded(stringValue(source, "address"), 2_000, "seller.address", errors), branchNumber: branchNumber(source, office, "seller.branchNumber", errors), contactEmail: bounded(stringValue(source, "contactEmail"), 200, "seller.contactEmail", errors), contactName: bounded(stringValue(source, "contactName"), 200, "seller.contactName", errors), contactPhone: bounded(stringValue(source, "contactPhone"), 200, "seller.contactPhone", errors), email: bounded(stringValue(source, "email"), 200, "seller.email", errors), logoUrl: bounded(stringValue(source, "logoUrl"), 2_048, "seller.logoUrl", errors), name: bounded(stringValue(source, "name"), 200, "seller.name", errors), officeType: office, phone: bounded(stringValue(source, "phone"), 200, "seller.phone", errors), taxId: bounded(stringValue(source, "taxId"), 200, "seller.taxId", errors), website: bounded(stringValue(source, "website"), 2_048, "seller.website", errors),
  };
  if (!seller.name) errors["seller.name"] = REQUIRED_MESSAGES.sellerName;
  if (!seller.address) errors["seller.address"] = REQUIRED_MESSAGES.sellerAddress;
  if (!TAX_ID.test(seller.taxId)) errors["seller.taxId"] = "เลขผู้เสียภาษีผู้ขายต้องเป็นตัวเลข 13 หลัก";
  optionalEmail(seller.email, "seller.email", "รูปแบบอีเมลผู้ขายไม่ถูกต้อง", errors);
  optionalEmail(seller.contactEmail, "seller.contactEmail", "รูปแบบอีเมลผู้ติดต่อไม่ถูกต้อง", errors);
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return seller;
}

export function emptyQuotationPayload(
  seller: SellerSnapshot,
  now: Date,
  certification = emptyCertificationSnapshot(),
  documentDisplay = QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
  template: QuotationTemplate = DEFAULT_QUOTATION_TEMPLATE,
  layout: QuotationLayoutSnapshot = canonicalQuotationLayoutSnapshot(template),
): QuotationPayload {
  const issueDate = getBangkokCalendarDate(now);
  const validityDays = "7";
  return {
    certification,
    documentDisplay: { ...documentDisplay },
    customer: { address: "", branchNumber: "", name: "", officeType: "head_office", taxId: "" },
    id: null, internalNotes: "", issueDate,
    items: [{ description: "", discountAmount: "0", id: crypto.randomUUID(), name: "", position: 1, quantity: "1", unit: "", unitPrice: "0.00", vatRate: "0", vatTreatment: "none" }],
    paymentMethods: [],
    publicNotes: "", reference: "", layout, seller, subject: "", validUntil: addQuotationCalendarDays(issueDate, Number(validityDays)), validityDays, withholdingTaxRate: null,
    template,
  };
}

export function prepareQuotationPayload(
  value: unknown,
  itemNames: readonly string[],
): PreparedQuotation {
  let source: Record<string, unknown>;
  try { source = objectValue(value, "quotation"); }
  catch { throw new QuotationValidationError({ _form: "Invalid quotation" }); }
  const errors: Record<string, string> = {};
  if (typeof source.validityDays === "string" && source.validityDays.trim().length > 5) {
    throw new QuotationValidationError({ validityDays: "Invalid validity days" });
  }
  let seller: SellerSnapshot;
  try { seller = prepareSellerSnapshot(source.seller); } catch (error) { if (error instanceof QuotationValidationError) Object.assign(errors, error.fieldErrors); else errors.seller = "ข้อมูลผู้ขายไม่ถูกต้อง"; seller = { address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "", officeType: "head_office", phone: "", taxId: "", website: "" }; }
  let certification: CertificationSnapshot;
  try { certification = prepareCertificationSnapshot(source.certification); } catch (error) { if (error instanceof QuotationValidationError) Object.assign(errors, error.fieldErrors); else errors.certification = "ข้อมูลรับรองไม่ถูกต้อง"; certification = emptyCertificationSnapshot(); }
  const documentDisplay = isQuotationDocumentDisplay(source.documentDisplay)
    ? { ...source.documentDisplay }
    : { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS };
  if (!isQuotationDocumentDisplay(source.documentDisplay)) {
    errors.documentDisplay = "รูปแบบเอกสารไม่ถูกต้อง";
  }
  const template = isQuotationTemplate(source.template)
    ? source.template
    : DEFAULT_QUOTATION_TEMPLATE;
  if (!isQuotationTemplate(source.template)) {
    errors.template = "เทมเพลตใบเสนอราคาไม่ถูกต้อง";
  }
  let layoutSource: Record<string, unknown>;
  try { layoutSource = objectValue(source.layout, "layout"); }
  catch { layoutSource = {}; errors.layout = "เลเอาท์เอกสารไม่ถูกต้อง"; }
  const layoutConfig = isQuotationLayoutConfig(layoutSource.config, template)
    ? structuredClone(layoutSource.config)
    : canonicalQuotationLayoutSnapshot(template).config;
  const layout: QuotationLayoutSnapshot = {
    config: layoutConfig,
    revisionNumber: typeof layoutSource.revisionNumber === "number" ? layoutSource.revisionNumber : 0,
    schemaVersion: typeof layoutSource.schemaVersion === "number" ? layoutSource.schemaVersion : 0,
    sourceId: stringValue(layoutSource, "sourceId"),
  };
  if (!isQuotationLayoutConfig(layoutSource.config, template)
    || !UUID.test(layout.sourceId)
    || !Number.isSafeInteger(layout.revisionNumber) || layout.revisionNumber < 1
    || layout.schemaVersion !== QUOTATION_LAYOUT_SCHEMA_VERSION) {
    errors.layout = "เลเอาท์เอกสารไม่ถูกต้อง";
  }
  let customerSource: Record<string, unknown>;
  try { customerSource = objectValue(source.customer, "customer"); } catch { errors.customer = "Invalid customer"; customerSource = {}; }
  customerSource.officeType = trimValue(customerSource.officeType);
  const customerOffice = enumValue(customerSource.officeType, ["branch", "head_office", "unspecified"], "customer.officeType", errors, "head_office");
  const customer: CustomerSnapshot = { address: bounded(stringValue(customerSource, "address"), 2_000, "customer.address", errors), branchNumber: branchNumber(customerSource, customerOffice, "customer.branchNumber", errors), name: bounded(stringValue(customerSource, "name"), 200, "customer.name", errors), officeType: customerOffice, taxId: bounded(stringValue(customerSource, "taxId"), 200, "customer.taxId", errors) };
  if (!customer.name) errors["customer.name"] = REQUIRED_MESSAGES.customerName;
  if (!customer.address) errors["customer.address"] = REQUIRED_MESSAGES.customerAddress;
  if (!TAX_ID.test(customer.taxId)) errors["customer.taxId"] = "เลขผู้เสียภาษีลูกค้าต้องเป็นตัวเลข 13 หลัก";
  const id = source.id === null ? null : stringValue(source, "id"); if (id !== null && !UUID.test(id)) errors.id = "รหัสเอกสารไม่ถูกต้อง";
  const issueDate = stringValue(source, "issueDate"); if (!validDate(issueDate)) errors.issueDate = "วันที่ออกเอกสารไม่ถูกต้อง";
  const validityDays = stringValue(source, "validityDays"); if (validityDays && (!/^\d+$/.test(validityDays) || Number(validityDays) > 36_500)) errors.validityDays = "จำนวนวันใช้ได้ไม่ถูกต้อง";
  let validUntil = stringValue(source, "validUntil");
  if (validityDays && validDate(issueDate) && !errors.validityDays) {
    try { validUntil = addQuotationCalendarDays(issueDate, Number(validityDays)); } catch { errors.validUntil = "Invalid valid-until date"; }
  }
  else if (!validDate(validUntil) || (validDate(issueDate) && validUntil < issueDate)) errors.validUntil = "วันที่ใช้ได้ถึงต้องไม่น้อยกว่าวันที่ออกเอกสาร";
  const itemsValue = source.items;
  const withholdingTaxRate = source.withholdingTaxRate == null ? null : numeric(stringValue(source, "withholdingTaxRate"), PERCENT, "withholdingTaxRate", errors, true);
  if (!Array.isArray(itemsValue) || itemsValue.length < 1 || itemsValue.length > 100) errors.items = "Invalid item count";
  const items: QuotationItemInput[] = Array.isArray(itemsValue) && itemsValue.length >= 1 && itemsValue.length <= 100 ? itemsValue.map((value, index) => {
    const prefix = `items.${index}`;
    let item: Record<string, unknown>;
    try { item = objectValue(value, prefix); } catch { errors[prefix] = "Invalid item"; item = {}; }
    item.vatTreatment = trimValue(item.vatTreatment);
    const itemId = stringValue(item, "id");
    const discountAmount = numeric(stringValue(item, "discountAmount") || "0", MONEY, `${prefix}.discountAmount`, errors);
    const vatTreatment = enumValue(item.vatTreatment, ["none", "taxable"], `${prefix}.vatTreatment`, errors, "none");
    const vatRate = numeric(stringValue(item, "vatRate") || "0", PERCENT, `${prefix}.vatRate`, errors, true);
    if (
      (vatTreatment === "none" && Number(vatRate) !== 0)
      || (vatTreatment === "taxable" && ![0, 7].includes(Number(vatRate)))
    ) {
      errors[`${prefix}.vatRate`] = "ภาษีต้องเป็น 7%, 0% หรือไม่มี";
    }
    if (!UUID.test(itemId)) errors[`${prefix}.id`] = "รหัสรายการไม่ถูกต้อง";
    const name = bounded(stringValue(item, "name"), 200, `${prefix}.name`, errors);
    if (!name) errors[`${prefix}.name`] = REQUIRED_MESSAGES.itemName;
    else if (!itemNames.includes(name)) errors[`${prefix}.name`] = "กรุณาเลือกชื่อรายการจากรายการที่กำหนด";
    const unit = bounded(stringValue(item, "unit"), 200, `${prefix}.unit`, errors);
    return { description: bounded(stringValue(item, "description"), 2_000, `${prefix}.description`, errors), discountAmount, id: itemId, name, position: index + 1, quantity: numeric(stringValue(item, "quantity"), QUANTITY, `${prefix}.quantity`, errors), unit, unitPrice: numeric(stringValue(item, "unitPrice"), MONEY, `${prefix}.unitPrice`, errors), vatRate, vatTreatment };
  }) : [];
  if (items.length < 1 || items.length > 100) errors.items = "ต้องมีรายการ 1 ถึง 100 รายการ";
  if (new Set(items.map((item) => item.id)).size !== items.length) errors.items = "รหัสรายการต้องไม่ซ้ำกัน";
  let paymentMethods: QuotationPaymentMethod[];
  try { paymentMethods = preparePaymentMethods(source.paymentMethods); }
  catch (error) { if (error instanceof QuotationValidationError) Object.assign(errors, error.fieldErrors); else errors.paymentMethods = "Invalid payment methods"; paymentMethods = []; }
  let payload: QuotationPayload = { certification, customer, documentDisplay, id, internalNotes: bounded(stringValue(source, "internalNotes"), 5_000, "internalNotes", errors), issueDate, items, layout, paymentMethods, publicNotes: bounded(stringValue(source, "publicNotes"), 5_000, "publicNotes", errors), reference: bounded(stringValue(source, "reference"), 200, "reference", errors), seller, subject: bounded(stringValue(source, "subject"), 200, "subject", errors), template, validUntil, validityDays, withholdingTaxRate };
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  payload = applyQuotationDocumentDisplay(payload, documentDisplay);
  let calculation: QuotationCalculation;
  try { calculation = calculateQuotation(payload); } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถคำนวณใบเสนอราคาได้";
    const discountItem = /Discount cannot exceed item gross for item (\d+)/.exec(message);
    const field = discountItem
      ? `items.${Number(discountItem[1]) - 1}.discountAmount`
      : /Quantity|Unit price|VAT|item/.test(message)
        ? "items"
        : "_form";
    throw new QuotationValidationError({ [field]: message });
  }
  const automaticPromptPayIndex = paymentMethods.findIndex(
    (method) => method.qrMode === "auto_promptpay",
  );
  if (automaticPromptPayIndex >= 0) {
    const amountDue = Number(calculation.amountDue);
    if (amountDue <= 0 || amountDue > 9_999_999_999.99) {
      throw new QuotationValidationError({
        [`paymentMethods.${automaticPromptPayIndex}.qrMode`]: amountDue <= 0
          ? "ยอดชำระต้องมากกว่า 0 สำหรับ QR พร้อมเพย์อัตโนมัติ"
          : "ยอดชำระเกินวงเงินสูงสุดสำหรับ QR พร้อมเพย์",
      });
    }
  }
  return { amountInWords: formatThaiBahtText(calculation.amountDue), calculation, payload, rpcPayload: { certification_snapshot: certificationSnapshotToJson(certification), customer_snapshot: customer, document_layout_schema_version_snapshot: layout.schemaVersion, document_layout_snapshot: layout.config, document_template_revision_snapshot: layout.revisionNumber, document_template_snapshot: template, document_template_source_id: layout.sourceId, document_display_snapshot: documentDisplay, id, internal_notes: payload.internalNotes, issue_date: issueDate, items: calculation.lines.map((line) => ({ description: line.description, discount_amount: line.discountAmount, name: line.name, position: line.position, quantity: line.quantity, unit: line.unit || null, unit_price: line.unitPrice, vat_rate: line.vatRate, vat_treatment: line.vatTreatment })), payment_methods: paymentMethods.map((method) => ({ account_name: method.accountName, account_number: method.accountNumber, account_type: method.accountType, bank_code: method.bankCode, bank_id: method.bankId, bank_logo_url: method.bankLogoUrl, bank_name: method.bankName, custom_bank_logo_url: method.customBankLogoUrl, custom_bank_name: method.customBankName, id: method.id, instructions: method.instructions, position: method.position, promptpay_id: method.promptPayId, provider_name: method.providerName, qr_image_url: method.qrImageUrl, qr_mode: method.qrMode, type: method.type })), public_notes: payload.publicNotes, reference: payload.reference, seller_snapshot: seller, subject: payload.subject, totals: { amountDue: calculation.amountDue, discountTotal: calculation.discountTotal, grandTotal: calculation.grandTotal, grossTotal: calculation.grossTotal, preTaxTotal: calculation.preTaxTotal, vatTotal: calculation.vatTotal, withholdingTaxTotal: calculation.withholdingTaxTotal }, valid_until: validUntil, validity_days: validityDays ? Number(validityDays) : null, withholding_tax_rate: payload.withholdingTaxRate } };
}
