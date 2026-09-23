import { record, type BookingCustomer } from "./house-bookings.ts";
import { bookingToday } from "./booking-availability.ts";

export const CUSTOMER_FIELDS = [
  { key: "title", label: "คำนำหน้า", max: 20, group: "general" },
  { key: "nationality", label: "สัญชาติ", max: 50, group: "general" },
  { key: "date_of_birth", label: "วันเกิด", max: 10, group: "general", type: "date" },
  { key: "email", label: "อีเมล", max: 150, group: "contact", type: "email" },
  { key: "secondary_phone", label: "เบอร์สำรอง", max: 20, group: "contact", type: "tel" },
  { key: "line_id", label: "LINE ID", max: 50, group: "contact" },
  { key: "preferred_language", label: "ภาษาที่ใช้", max: 10, group: "contact" },
  { key: "id_card_no", label: "เลขบัตรประชาชน", max: 20, group: "general" },
  { key: "passport_no", label: "เลขพาสปอร์ต", max: 50, group: "general" },
  { key: "address", label: "ที่อยู่", max: 10000, group: "address", type: "textarea" },
  { key: "sub_district", label: "ตำบล/แขวง", max: 100, group: "address" },
  { key: "district", label: "อำเภอ/เขต", max: 100, group: "address" },
  { key: "province", label: "จังหวัด", max: 100, group: "address" },
  { key: "postal_code", label: "รหัสไปรษณีย์", max: 10, group: "address" },
  { key: "country", label: "ประเทศ", max: 100, group: "address" },
  { key: "tax_id", label: "เลขประจำตัวผู้เสียภาษี", max: 20, group: "tax" },
  { key: "tax_company_name", label: "ชื่อบริษัท", max: 255, group: "tax" },
  { key: "tax_branch_code", label: "รหัสสาขา", max: 10, group: "tax" },
  { key: "tax_address", label: "ที่อยู่ออกใบกำกับภาษี", max: 10000, group: "tax", type: "textarea" },
  { key: "special_requests", label: "ความต้องการพิเศษ", max: 10000, group: "extra", type: "textarea" },
  { key: "notes", label: "หมายเหตุลูกค้า", max: 10000, group: "extra", type: "textarea" },
] as const;
export type CustomerTextField = typeof CUSTOMER_FIELDS[number]["key"];

export interface BookingCustomerInput extends Partial<Record<CustomerTextField, string | null>> {
  first_name: string;
  last_name: string | null;
  phone: string;
  customer_type?: string | null;
  vip_status?: boolean | null;
  tax_head_office?: boolean | null;
}
export interface BookingCustomerDetail extends BookingCustomerInput { id: string; updated_at: string | null; dv_id: string | null }
export type BookingCustomerCreation =
  | { kind: "created"; customer: BookingCustomer }
  | { kind: "existing"; customers: BookingCustomer[] };

export function normalizeBookingPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^\+?66\d{8,9}$/.test(compact)) return `0${compact.replace(/^\+?66/, "")}`;
  return compact;
}

export function parseBookingCustomer(raw: unknown): BookingCustomerInput {
  const data = record(raw);
  const first_name = typeof data.first_name === "string" ? data.first_name.trim() : "";
  const last_name = typeof data.last_name === "string" ? data.last_name.trim() : "";
  if (first_name.length > 100) throw new Error("กรุณากรอกชื่อไม่เกิน 100 ตัวอักษร");
  if (last_name.length > 100) throw new Error("นามสกุลต้องไม่เกิน 100 ตัวอักษร");
  const rawPhone = typeof data.phone === "string" ? data.phone.trim() : "";
  const phone = normalizeBookingPhone(rawPhone);
  if (rawPhone.length > 40 || (rawPhone && !/^\+?\d{8,15}$/.test(phone))) throw new Error("กรุณากรอกเบอร์โทร 8–15 หลัก");
  const result: BookingCustomerInput = { first_name, last_name: last_name || null, phone };
  for (const field of CUSTOMER_FIELDS) {
    if (!(field.key in data)) continue;
    const value = data[field.key];
    if (value !== null && typeof value !== "string") throw new Error(`${field.label}ไม่ถูกต้อง`);
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length > field.max) throw new Error(`${field.label}ยาวเกินกำหนด`);
    result[field.key] = text || null;
  }
  for (const field of ["vip_status", "tax_head_office"] as const) {
    if (!(field in data)) continue;
    if (data[field] !== null && typeof data[field] !== "boolean") throw new Error("รูปแบบสถานะลูกค้าไม่ถูกต้อง");
    result[field] = data[field] as boolean | null;
  }
  if ("customer_type" in data) {
    if (data.customer_type !== null && !["individual", "juristic"].includes(String(data.customer_type))) throw new Error("ประเภทลูกค้าไม่ถูกต้อง");
    result.customer_type = data.customer_type as string | null;
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
  if (result.secondary_phone) {
    result.secondary_phone = normalizeBookingPhone(result.secondary_phone);
    if (!/^\+?\d{8,15}$/.test(result.secondary_phone)) throw new Error("เบอร์สำรองต้องเป็นตัวเลข 8–15 หลัก");
  }
  if (result.tax_id && !/^\d{13}$/.test(result.tax_id)) throw new Error("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  if (result.id_card_no && !/^\d{13}$/.test(result.id_card_no)) throw new Error("เลขบัตรประชาชนต้องมี 13 หลัก");
  if (result.date_of_birth) {
    const date = new Date(`${result.date_of_birth}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date_of_birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result.date_of_birth || result.date_of_birth > bookingToday()) throw new Error("วันเกิดไม่ถูกต้องหรือเป็นวันในอนาคต");
  }
  return result;
}
