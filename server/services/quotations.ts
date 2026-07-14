import {
  calculateQuotation,
  formatThaiBahtText,
  type DiscountType,
  type PriceMode,
  type QuotationCalculation,
  type QuotationItemInput,
  type VatTreatment,
} from "../../lib/quotation-calculator.ts";
import { addQuotationCalendarDays, getBangkokCalendarDate } from "../../lib/quotation-dates.ts";
import type { CustomerSnapshot, OfficeType, QuotationPayload, SellerSnapshot } from "../../lib/quotation-types.ts";

const REQUIRED_MESSAGES = {
  customerAddress: "กรุณากรอกที่อยู่ลูกค้า", customerName: "กรุณากรอกชื่อลูกค้า", itemName: "กรุณากรอกชื่อรายการ", itemUnit: "กรุณากรอกหน่วยนับ",
  sellerAddress: "กรุณากรอกที่อยู่ผู้ขาย", sellerName: "กรุณากรอกชื่อผู้ขาย", sellerTaxId: "กรุณากรอกเลขประจำตัวผู้เสียภาษีผู้ขาย",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,12}(?:\.\d{1,2})?$/;
const QUANTITY = /^\d{1,9}(?:\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(?:\.\d{1,2})?$/;

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
    currency: "THB"; customer_snapshot: CustomerSnapshot; document_discount_type: DiscountType; document_discount_value: string; id: string | null; internal_notes: string; issue_date: string;
    items: Array<{ description: string; discount_amount: string; discount_type: DiscountType; discount_value: string; document_discount_allocation: string; gross_amount: string; id: string; line_total: string; name: string; position: number; quantity: string; sku: string; taxable_amount: string; unit: string; unit_price: string; vat_amount: string; vat_rate: string; vat_treatment: VatTreatment }>;
    price_mode: PriceMode; public_notes: string; reference: string; seller_snapshot: SellerSnapshot; subject: string;
    totals: Pick<QuotationCalculation, "documentDiscountTotal" | "grandTotal" | "itemDiscountTotal" | "subtotal" | "taxableTotal" | "vatTotal">;
    valid_until: string; validity_days: number | null;
  };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function stringValue(object: Record<string, unknown>, key: string): string { const value = object[key]; return typeof value === "string" ? value.trim() : ""; }
function optionalEmail(value: string, field: string, message: string, errors: Record<string, string>) { if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = message; }
function validDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function bounded(value: string, max: number, field: string, errors: Record<string, string>) { if (value.length > max) errors[field] = "ข้อมูลยาวเกินกำหนด"; return value; }
function enumValue<T extends string>(value: unknown, values: readonly T[], field: string, errors: Record<string, string>, fallback: T): T { if (typeof value === "string" && values.includes(value as T)) return value as T; errors[field] = "ค่าที่เลือกไม่ถูกต้อง"; return fallback; }
function discountTypeValue(value: unknown, field: string, errors: Record<string, string>): DiscountType {
  if (value === null || value === "amount" || value === "percent") return value;
  errors[field] = "ค่าที่เลือกไม่ถูกต้อง";
  return null;
}
function numeric(value: string, expression: RegExp, field: string, errors: Record<string, string>, percentage = false): string { if (!expression.test(value) || (percentage && Number(value) > 100)) errors[field] = "ตัวเลขไม่ถูกต้อง"; return value; }

export function prepareSellerSnapshot(value: unknown): SellerSnapshot {
  const source = objectValue(value, "seller");
  const errors: Record<string, string> = {};
  const seller: SellerSnapshot = {
    address: bounded(stringValue(source, "address"), 2_000, "seller.address", errors), branchNumber: bounded(stringValue(source, "branchNumber"), 200, "seller.branchNumber", errors), contactEmail: bounded(stringValue(source, "contactEmail"), 200, "seller.contactEmail", errors), contactName: bounded(stringValue(source, "contactName"), 200, "seller.contactName", errors), contactPhone: bounded(stringValue(source, "contactPhone"), 200, "seller.contactPhone", errors), email: bounded(stringValue(source, "email"), 200, "seller.email", errors), logoUrl: bounded(stringValue(source, "logoUrl"), 2_048, "seller.logoUrl", errors), name: bounded(stringValue(source, "name"), 200, "seller.name", errors), officeType: enumValue(source.officeType, ["branch", "head_office"], "seller.officeType", errors, "head_office"), phone: bounded(stringValue(source, "phone"), 200, "seller.phone", errors), taxId: bounded(stringValue(source, "taxId"), 200, "seller.taxId", errors), website: bounded(stringValue(source, "website"), 2_048, "seller.website", errors),
  };
  if (!seller.name) errors["seller.name"] = REQUIRED_MESSAGES.sellerName;
  if (!seller.address) errors["seller.address"] = REQUIRED_MESSAGES.sellerAddress;
  if (!seller.taxId) errors["seller.taxId"] = REQUIRED_MESSAGES.sellerTaxId;
  optionalEmail(seller.email, "seller.email", "รูปแบบอีเมลผู้ขายไม่ถูกต้อง", errors);
  optionalEmail(seller.contactEmail, "seller.contactEmail", "รูปแบบอีเมลผู้ติดต่อไม่ถูกต้อง", errors);
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return seller;
}

export function emptyQuotationPayload(seller: SellerSnapshot, now: Date): QuotationPayload {
  const issueDate = getBangkokCalendarDate(now);
  const validityDays = "15";
  return {
    currency: "THB", customer: { address: "", branchNumber: "", contactName: "", email: "", name: "", officeType: "head_office", phone: "", serviceLocation: "", shippingAddress: "", taxId: "" },
    documentDiscountType: null, documentDiscountValue: "0", id: null, internalNotes: "", issueDate,
    items: [{ description: "", discountType: null, discountValue: "0", id: "00000000-0000-4000-8000-000000000000", name: "", position: 1, quantity: "1", sku: "", unit: "", unitPrice: "0.00", vatRate: "7.00", vatTreatment: "taxable" }],
    priceMode: "vat_exclusive", publicNotes: "", reference: "", seller, subject: "", validUntil: addQuotationCalendarDays(issueDate, Number(validityDays)), validityDays,
  };
}

export function prepareQuotationPayload(value: unknown): PreparedQuotation {
  const source = objectValue(value, "quotation");
  const errors: Record<string, string> = {};
  let seller: SellerSnapshot;
  try { seller = prepareSellerSnapshot(source.seller); } catch (error) { if (error instanceof QuotationValidationError) Object.assign(errors, error.fieldErrors); else errors.seller = "ข้อมูลผู้ขายไม่ถูกต้อง"; seller = { address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "", officeType: "head_office", phone: "", taxId: "", website: "" }; }
  const customerSource = objectValue(source.customer, "customer");
  const customer: CustomerSnapshot = { address: bounded(stringValue(customerSource, "address"), 2_000, "customer.address", errors), branchNumber: bounded(stringValue(customerSource, "branchNumber"), 200, "customer.branchNumber", errors), contactName: bounded(stringValue(customerSource, "contactName"), 200, "customer.contactName", errors), email: bounded(stringValue(customerSource, "email"), 200, "customer.email", errors), name: bounded(stringValue(customerSource, "name"), 200, "customer.name", errors), officeType: enumValue(customerSource.officeType, ["branch", "head_office"], "customer.officeType", errors, "head_office"), phone: bounded(stringValue(customerSource, "phone"), 200, "customer.phone", errors), serviceLocation: bounded(stringValue(customerSource, "serviceLocation"), 2_000, "customer.serviceLocation", errors), shippingAddress: bounded(stringValue(customerSource, "shippingAddress"), 2_000, "customer.shippingAddress", errors), taxId: bounded(stringValue(customerSource, "taxId"), 200, "customer.taxId", errors) };
  if (!customer.name) errors["customer.name"] = REQUIRED_MESSAGES.customerName;
  if (!customer.address) errors["customer.address"] = REQUIRED_MESSAGES.customerAddress;
  optionalEmail(customer.email, "customer.email", "รูปแบบอีเมลลูกค้าไม่ถูกต้อง", errors);
  const id = source.id === null ? null : stringValue(source, "id"); if (id !== null && !UUID.test(id)) errors.id = "รหัสเอกสารไม่ถูกต้อง";
  const issueDate = stringValue(source, "issueDate"); if (!validDate(issueDate)) errors.issueDate = "วันที่ออกเอกสารไม่ถูกต้อง";
  const validityDays = stringValue(source, "validityDays"); if (validityDays && (!/^\d+$/.test(validityDays) || Number(validityDays) > 36_500)) errors.validityDays = "จำนวนวันใช้ได้ไม่ถูกต้อง";
  let validUntil = stringValue(source, "validUntil");
  if (validityDays && validDate(issueDate) && !errors.validityDays) validUntil = addQuotationCalendarDays(issueDate, Number(validityDays));
  else if (!validDate(validUntil) || (validDate(issueDate) && validUntil < issueDate)) errors.validUntil = "วันที่ใช้ได้ถึงต้องไม่น้อยกว่าวันที่ออกเอกสาร";
  const itemsValue = source.items;
  const items: QuotationItemInput[] = Array.isArray(itemsValue) ? itemsValue.map((value, index) => {
    const item = objectValue(value, `items.${index}`); const prefix = `items.${index}`; const itemId = stringValue(item, "id");
    if (!UUID.test(itemId)) errors[`${prefix}.id`] = "รหัสรายการไม่ถูกต้อง";
    const name = bounded(stringValue(item, "name"), 200, `${prefix}.name`, errors); if (!name) errors[`${prefix}.name`] = REQUIRED_MESSAGES.itemName;
    const unit = bounded(stringValue(item, "unit"), 200, `${prefix}.unit`, errors); if (!unit) errors[`${prefix}.unit`] = REQUIRED_MESSAGES.itemUnit;
    return { description: bounded(stringValue(item, "description"), 2_000, `${prefix}.description`, errors), discountType: discountTypeValue(item.discountType, `${prefix}.discountType`, errors), discountValue: numeric(stringValue(item, "discountValue"), MONEY, `${prefix}.discountValue`, errors), id: itemId, name, position: index + 1, quantity: numeric(stringValue(item, "quantity"), QUANTITY, `${prefix}.quantity`, errors), sku: bounded(stringValue(item, "sku"), 200, `${prefix}.sku`, errors), unit, unitPrice: numeric(stringValue(item, "unitPrice"), MONEY, `${prefix}.unitPrice`, errors), vatRate: numeric(stringValue(item, "vatRate"), PERCENT, `${prefix}.vatRate`, errors, true), vatTreatment: enumValue(item.vatTreatment, ["exempt", "none", "taxable"], `${prefix}.vatTreatment`, errors, "taxable") };
  }) : [];
  if (items.length < 1 || items.length > 100) errors.items = "ต้องมีรายการ 1 ถึง 100 รายการ";
  if (new Set(items.map((item) => item.id)).size !== items.length) errors.items = "รหัสรายการต้องไม่ซ้ำกัน";
  const payload: QuotationPayload = { currency: source.currency === "THB" ? "THB" : (errors.currency = "สกุลเงินไม่ถูกต้อง", "THB"), customer, documentDiscountType: discountTypeValue(source.documentDiscountType, "documentDiscountType", errors), documentDiscountValue: numeric(stringValue(source, "documentDiscountValue"), MONEY, "documentDiscountValue", errors), id, internalNotes: bounded(stringValue(source, "internalNotes"), 5_000, "internalNotes", errors), issueDate, items, priceMode: enumValue(source.priceMode, ["vat_exclusive", "vat_inclusive"], "priceMode", errors, "vat_exclusive"), publicNotes: bounded(stringValue(source, "publicNotes"), 5_000, "publicNotes", errors), reference: bounded(stringValue(source, "reference"), 200, "reference", errors), seller, subject: bounded(stringValue(source, "subject"), 200, "subject", errors), validUntil, validityDays };
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  let calculation: QuotationCalculation;
  try { calculation = calculateQuotation(payload); } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถคำนวณใบเสนอราคาได้";
    const field = message.startsWith("Document") ? "documentDiscountValue" : /Quantity|Unit price|VAT|item/.test(message) ? "items" : "_form";
    throw new QuotationValidationError({ [field]: message });
  }
  return { amountInWords: formatThaiBahtText(calculation.grandTotal), calculation, payload, rpcPayload: { currency: "THB", customer_snapshot: customer, document_discount_type: payload.documentDiscountType, document_discount_value: payload.documentDiscountValue, id, internal_notes: payload.internalNotes, issue_date: issueDate, items: calculation.lines.map((line) => ({ description: line.description, discount_amount: line.discountAmount, discount_type: line.discountType, discount_value: line.discountValue, document_discount_allocation: line.documentDiscountAllocation, gross_amount: line.grossAmount, id: line.id, line_total: line.lineTotal, name: line.name, position: line.position, quantity: line.quantity, sku: line.sku, taxable_amount: line.taxableAmount, unit: line.unit, unit_price: line.unitPrice, vat_amount: line.vatAmount, vat_rate: line.vatRate, vat_treatment: line.vatTreatment })), price_mode: payload.priceMode, public_notes: payload.publicNotes, reference: payload.reference, seller_snapshot: seller, subject: payload.subject, totals: { documentDiscountTotal: calculation.documentDiscountTotal, grandTotal: calculation.grandTotal, itemDiscountTotal: calculation.itemDiscountTotal, subtotal: calculation.subtotal, taxableTotal: calculation.taxableTotal, vatTotal: calculation.vatTotal }, valid_until: validUntil, validity_days: validityDays ? Number(validityDays) : null } };
}
