export interface AnalyticsTimeRange { timeFrom: string; timeTo: string }
export interface AnalyticsHourBounds { start: string; end: string }
/** PostgreSQL timestamps may carry microseconds that Date.parse truncates. */
export function atOrAfterAnalyticsTimestamp(start: string, cutoff: string): boolean {
  const difference = Date.parse(start) - Date.parse(cutoff);
  if (difference !== 0) return difference >= 0;
  const fraction = (value: string) => (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0");
  return fraction(start) >= fraction(cutoff);
}
const hourMs = 3600000;
export function parseAnalyticsTimeRange(timeFrom: unknown, timeTo: unknown, range?: { from: string; to: string }): AnalyticsTimeRange | undefined {
  if (timeFrom === undefined && timeTo === undefined) return range?.from === range?.to && range ? { timeFrom: "00:00", timeTo: "24:00" } : undefined;
  if (!range || range.from > range.to || typeof timeFrom !== "string" || typeof timeTo !== "string"
    || !/^(?:[01]\d|2[0-3]):00$/.test(timeFrom) || !/^(?:0[1-9]|1\d|2[0-4]):00$/.test(timeTo) || timeFrom >= timeTo) throw new RangeError("invalid_time_range");
  return { timeFrom, timeTo };
}
export function dailyWindowBounds(date: string, time: AnalyticsTimeRange): AnalyticsHourBounds {
  parseAnalyticsTimeRange(time.timeFrom, time.timeTo, { from: date, to: date });
  const day = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) throw new RangeError("invalid_time_range");
  return { start: new Date(day - 7 * hourMs + Number(time.timeFrom.slice(0, 2)) * hourMs).toISOString(), end: new Date(day - 7 * hourMs + Number(time.timeTo.slice(0, 2)) * hourMs).toISOString() };
}
export function hourlyBounds(date: string, time: AnalyticsTimeRange, asOf: string): { start: string; end: string; effectiveEnd: string; buckets: AnalyticsHourBounds[] } {
  parseAnalyticsTimeRange(time.timeFrom, time.timeTo, { from: date, to: date });
  const day = Date.parse(`${date}T00:00:00+07:00`);
  if (!Number.isFinite(day) || !Number.isFinite(Date.parse(asOf))) throw new RangeError("invalid_time_range");
  const start = day + Number(time.timeFrom.slice(0, 2)) * hourMs;
  const end = day + Number(time.timeTo.slice(0, 2)) * hourMs;
  const effectiveEnd = Math.min(end, Date.parse(asOf));
  const buckets: AnalyticsHourBounds[] = [];
  for (let stamp = start; stamp < effectiveEnd; stamp += hourMs) buckets.push({ start: new Date(stamp).toISOString(), end: new Date(stamp + hourMs).toISOString() });
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), effectiveEnd: new Date(effectiveEnd).toISOString(), buckets };
}
export function hourLabel(instant: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
}
export function hourlyRangeLabel(start: string, end: string): string {
  return `${hourLabel(start)}–${hourLabel(end) === "00:00" ? "24:00" : hourLabel(end)}`;
}
export function analyticsTimeRangeLabel(range?: { from: string; to: string; timeFrom?: string; timeTo?: string }): string {
  const timeFrom = range?.timeFrom ?? "00:00";
  const timeTo = range?.timeTo ?? "24:00";
  if (timeFrom === "00:00" && timeTo === "24:00") return "เต็มวัน 24 ชั่วโมง (00:00–24:00)";
  return `${range?.from === range?.to ? "" : "ทุกวัน "}${timeFrom}–${timeTo}`;
}
export function isFutureAnalyticsRange(range: { from: string; to: string; timeFrom?: string; timeTo?: string } | undefined, asOf: string | undefined): boolean {
  return Boolean(range?.timeFrom && range.timeTo && asOf && Date.parse(asOf) <= Date.parse(`${range.from}T${range.timeFrom}:00+07:00`));
}
