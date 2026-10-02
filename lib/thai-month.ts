export const THAI_MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const MIN_GREGORIAN_YEAR = 1900;
const MAX_GREGORIAN_YEAR = 2199;
const BUDDHIST_ERA_OFFSET = 543;

export interface ThaiMonth {
  month: number;
  year: number;
}

export function parseThaiMonth(value: string): ThaiMonth {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new Error("เดือนไม่ถูกต้อง");

  const year = Number(match[1]);
  if (year < MIN_GREGORIAN_YEAR || year > MAX_GREGORIAN_YEAR) throw new Error("ปีไม่ถูกต้อง");

  return { month: Number(match[2]), year: year + BUDDHIST_ERA_OFFSET };
}

export function thaiMonthValue(value: ThaiMonth): string {
  const year = value.year - BUDDHIST_ERA_OFFSET;
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12 || !Number.isInteger(value.year) || year < MIN_GREGORIAN_YEAR || year > MAX_GREGORIAN_YEAR) {
    throw new Error("เดือนไม่ถูกต้อง");
  }

  return `${year}-${String(value.month).padStart(2, "0")}`;
}

export { MAX_GREGORIAN_YEAR, MIN_GREGORIAN_YEAR };
