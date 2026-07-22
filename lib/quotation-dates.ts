export function getBangkokCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addQuotationCalendarDays(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isInteger(days) || days < 0) {
    throw new Error("Invalid quotation date or validity days");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid quotation date or validity days");
  }
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error("Invalid quotation date or validity days");
  return result;
}
