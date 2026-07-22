import "server-only";

import type {
  DbdCustomerDefaults,
  QuotationCustomerInput,
  QuotationCustomerType,
} from "../../lib/quotation-customer-types.ts";
import type { OfficeType } from "../../lib/quotation-types.ts";
import { QuotationValidationError } from "./quotations.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_ID = /^[0-9]{13}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuotationValidationError({ _form: "ข้อมูลลูกค้าไม่ถูกต้อง" });
  }
  return value as Record<string, unknown>;
}

function textValue(source: Record<string, unknown>, key: string): string {
  return typeof source[key] === "string" ? source[key].trim() : "";
}

function bounded(
  value: string,
  max: number,
  field: string,
  errors: Record<string, string>,
): string {
  if (value.length > max) errors[field] = "ข้อมูลยาวเกินกำหนด";
  return value;
}

export function prepareQuotationCustomerInput(value: unknown): QuotationCustomerInput {
  const source = objectValue(value);
  const errors: Record<string, string> = {};
  const customerType = source.customerType === "juristic" || source.customerType === "individual"
    ? source.customerType as QuotationCustomerType
    : (errors.customerType = "ประเภทลูกค้าไม่ถูกต้อง", "juristic" as const);
  const officeType = source.officeType === "branch"
    || source.officeType === "head_office"
    || source.officeType === "unspecified"
    ? source.officeType as OfficeType
    : (errors.officeType = "ประเภทสำนักงานไม่ถูกต้อง", "unspecified" as const);
  const id = source.id === null
    ? null
    : typeof source.id === "string" && UUID.test(source.id)
      ? source.id
      : (errors.id = "รหัสลูกค้าไม่ถูกต้อง", null);
  const saveUnverified = source.saveUnverified === true;
  const result: QuotationCustomerInput = {
    address: bounded(textValue(source, "address"), 2_000, "address", errors),
    branchNumber: officeType === "branch"
      ? bounded(textValue(source, "branchNumber"), 200, "branchNumber", errors)
      : "",
    contactEmail: bounded(textValue(source, "contactEmail"), 200, "contactEmail", errors),
    contactName: bounded(textValue(source, "contactName"), 200, "contactName", errors),
    contactPhone: bounded(textValue(source, "contactPhone"), 200, "contactPhone", errors),
    customerType,
    id,
    name: bounded(textValue(source, "name"), 200, "name", errors),
    officeType,
    saveUnverified: customerType === "juristic" && saveUnverified,
    taxId: textValue(source, "taxId"),
  };

  if (!result.name) errors.name = "กรุณากรอกชื่อลูกค้า";
  if (!result.address) errors.address = "กรุณากรอกที่อยู่ลูกค้า";
  if (!TAX_ID.test(result.taxId)) errors.taxId = "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก";
  if (result.contactEmail && !EMAIL.test(result.contactEmail)) {
    errors.contactEmail = "รูปแบบอีเมลผู้ติดต่อไม่ถูกต้อง";
  }
  if (result.officeType === "branch" && !result.branchNumber) {
    errors.branchNumber = "กรุณากรอกเลขสาขา";
  }
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return result;
}

export function resetQuotationCustomerFromDbd(
  customer: QuotationCustomerInput,
  defaults: DbdCustomerDefaults,
): QuotationCustomerInput {
  if (customer.customerType !== "juristic" || customer.taxId !== defaults.taxId) {
    throw new QuotationValidationError({ taxId: "ข้อมูล DBD ไม่ตรงกับลูกค้า" });
  }
  return {
    ...customer,
    address: defaults.address,
    branchNumber: "",
    name: defaults.name,
    officeType: "head_office",
  };
}
