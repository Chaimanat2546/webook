export interface BookingHouseInformation {
  extra_person: number | null;
  insurance: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
}

export interface BookingCustomer {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
}
export interface BookingAgency {
  id: string;
  name: string;
}
export interface BookingUpdate {
  id: string;
  updated_at: string;
  check_in: string;
  check_out: string;
  customer_id: string | null;
  status: string;
  quantity: number;
  price_sell: number;
  price_max: number | null;
  extra_charge: number;
  note: string | null;
  extra_person: number | null;
  insurance: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  agent_id?: string | null;
}
export interface Booking extends BookingUpdate {
  booking_code: string;
  listing_id: string;
  houseid: string;
  agent_id: string | null;
  booking_type: string | null;
  deposit_amount: number;
  details: string | null;
  customer: BookingCustomer | null;
}
export type BookingResult<T> = { ok: true; data: T } | { ok: false; message: string };
export const BOOKING_STATUSES = [
  { value: "confirmed", label: "โอนแล้ว" },
  { value: "waiting", label: "รอโอน" },
  { value: "repair", label: "ปิดซ่อม/ปรับปรุง" },
  { value: "cancelled", label: "ยกเลิก" },
] as const;

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ข้อมูลไม่ถูกต้อง");
  return value as Record<string, unknown>;
}
export function bookingId(value: unknown): string {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > BigInt("9223372036854775807")) throw new Error("รหัสข้อมูลไม่ถูกต้อง");
  return id;
}
export function bookingDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("วันที่ไม่ถูกต้อง");
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error("วันที่ไม่ถูกต้อง");
  return value;
}
export function nightsBetween(start: string, end: string): number {
  return (Date.parse(`${bookingDate(end)}T00:00:00Z`) - Date.parse(`${bookingDate(start)}T00:00:00Z`)) / 86_400_000;
}
export function parseBookingRange(start: unknown, end: unknown) {
  const range = { start: bookingDate(start), end: bookingDate(end) };
  const days = nightsBetween(range.start, range.end);
  if (days <= 0 || days > 62) throw new Error("ช่วงปฏิทินไม่ถูกต้อง");
  return range;
}
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) throw new Error("ยอดเงินต้องเป็นจำนวนบวกหรือศูนย์ และมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  return value;
}
function nullableAmount(value: unknown): number | null {
  return value === null ? null : amount(value);
}
function nullableTime(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error("เวลาเช็คอินและเช็คเอาท์ไม่ถูกต้อง");
  return value.length === 5 ? `${value}:00` : value;
}
function rejectLegacyHouseInformation(raw: Record<string, unknown>) {
  if ("extra_beds" in raw || "insurance_fee" in raw) throw new Error("ไม่รองรับชื่อข้อมูลที่พักเดิม");
}
export function parseBookingUpdate(value: unknown): BookingUpdate {
  const raw = record(value);
  rejectLegacyHouseInformation(raw);
  const v = raw.status === "repair" ? { ...raw, customer_id: null, price_max: 0, price_sell: 0, extra_charge: 0 } : raw;
  const check_in = bookingDate(v.check_in), check_out = bookingDate(v.check_out);
  const quantity = nightsBetween(check_in, check_out);
  if (quantity <= 0) throw new Error("วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน");
  if (typeof v.status !== "string" || !BOOKING_STATUSES.some(s => s.value === v.status)) throw new Error("สถานะไม่ถูกต้อง");
  if (typeof v.updated_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(v.updated_at) || !Number.isFinite(Date.parse(v.updated_at))) throw new Error("ไม่พบรุ่นข้อมูล กรุณาโหลดการจองใหม่");
  if (v.note !== null && (typeof v.note !== "string" || v.note.length > 10000)) throw new Error("หมายเหตุยาวเกินไป");
  return { id: bookingId(v.id), updated_at: v.updated_at, check_in, check_out, status: v.status, customer_id: v.customer_id === null ? null : bookingId(v.customer_id), quantity, price_sell: amount(v.price_sell), price_max: v.price_max === null ? null : amount(v.price_max), extra_charge: amount(v.extra_charge), note: v.note as string | null, extra_person: nullableAmount(v.extra_person), insurance: nullableAmount(v.insurance), checkin_time: nullableTime(v.checkin_time), checkout_time: nullableTime(v.checkout_time), ...(v.agent_id === undefined ? {} : { agent_id: v.agent_id === null ? null : bookingId(v.agent_id) }) };
}
export function bookingCustomerName(customer: BookingCustomer | null): string {
  return customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || `ลูกค้า #${customer.id}` : "ยังไม่ได้ผูกลูกค้า";
}
export function bookingEvent(booking: Booking) {
  const status = BOOKING_STATUSES.find(s => s.value === booking.status);
  return { id: booking.id, title: booking.status === "repair" ? "ปิดซ่อม/ปรับปรุง" : `${booking.booking_code} · ${bookingCustomerName(booking.customer)} · ${status?.label ?? booking.status}`, start: booking.check_in, end: booking.check_out, allDay: true, className: `booking-${status?.value ?? "unknown"}` };
}

export interface BookingCreate extends Omit<BookingUpdate, "id" | "updated_at" | "customer_id" | "price_max"> {
  request_id: string;
  customer_id: string | null;
  price_max: number;
}
export function parseBookingCreate(value: unknown): BookingCreate {
  const v = record(value);
  if (typeof v.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.request_id)) throw new Error("รหัสคำขอไม่ถูกต้อง กรุณาเปิดฟอร์มใหม่");
  const customer_id = v.status === "repair" ? null : bookingId(v.customer_id);
  const price_max = v.status === "repair" ? 0 : amount(v.price_max);
  const parsed = parseBookingUpdate({ ...v, id: "1", updated_at: "2000-01-01T00:00:00Z" });
  if (parsed.status !== "waiting" && parsed.status !== "confirmed" && parsed.status !== "repair") throw new Error("สถานะการจองใหม่ไม่ถูกต้อง");
  return { request_id: v.request_id, customer_id, price_max, check_in: parsed.check_in, check_out: parsed.check_out, quantity: parsed.quantity, status: parsed.status, price_sell: parsed.price_sell, extra_charge: parsed.extra_charge, note: parsed.note, extra_person: parsed.extra_person, insurance: parsed.insurance, checkin_time: parsed.checkin_time, checkout_time: parsed.checkout_time, agent_id: parsed.agent_id ?? null };
}
