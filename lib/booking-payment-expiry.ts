const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function validDate(value: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("วันเวลาหมดอายุไม่ถูกต้อง");
  return date;
}

export function defaultPaymentExpiry(now: Date): string {
  return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
}

export function paymentExpiryFromBangkokLocal(value: string): string {
  if (!LOCAL_DATETIME.test(value)) throw new Error("วันเวลาหมดอายุไม่ถูกต้อง");
  const date = validDate(`${value}:00+07:00`);
  if (paymentExpiryToBangkokLocal(date.toISOString()) !== value) throw new Error("วันเวลาหมดอายุไม่ถูกต้อง");
  return date.toISOString();
}

export function paymentExpiryToBangkokLocal(value: string | null): string {
  if (value === null) return "";
  return new Date(validDate(value).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

export function parsePaymentExpiry(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error("วันเวลาหมดอายุไม่ถูกต้อง");
  return validDate(value).toISOString();
}
