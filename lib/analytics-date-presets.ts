import type { AnalyticsDateRange } from "./website-analytics.ts";

export interface AnalyticsDatePreset {
  id: string;
  label: string;
  range: AnalyticsDateRange | undefined;
}

const DAY = 86400000;
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);

export function trailingDateRange(today: string, days: number, untilYesterday = false): AnalyticsDateRange | undefined {
  if (!Number.isSafeInteger(days) || days < 1) return undefined;
  const end = Date.parse(today) - (untilYesterday ? DAY : 0);
  const start = end - (days - 1) * DAY;
  if (!Number.isFinite(start) || start < Date.parse("1900-01-01")) return undefined;
  return { from: dateKey(start), to: dateKey(end) };
}

// `today` is a date-only value from the server's Asia/Bangkok clock.
// UTC date arithmetic keeps browser timezone and DST out of these calculations.
export function analyticsDatePresets(today: string, availableFrom?: string): AnalyticsDatePreset[] {
  const now = new Date(today);
  const weekStart = now.getTime() - now.getUTCDay() * DAY;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return [
    { id: "today", label: "วันนี้", range: trailingDateRange(today, 1) },
    { id: "yesterday", label: "เมื่อวานนี้", range: trailingDateRange(today, 1, true) },
    { id: "thisWeek", label: "สัปดาห์นี้ (อาทิตย์ – วันนี้)", range: { from: dateKey(weekStart), to: today } },
    { id: "last7", label: "7 วันล่าสุด", range: trailingDateRange(today, 7) },
    { id: "lastWeek", label: "สัปดาห์ที่แล้ว (อาทิตย์ – เสาร์)", range: { from: dateKey(weekStart - 7 * DAY), to: dateKey(weekStart - DAY) } },
    { id: "last14", label: "14 วันล่าสุด", range: trailingDateRange(today, 14) },
    { id: "thisMonth", label: "เดือนนี้", range: { from: dateKey(monthStart), to: today } },
    { id: "last30", label: "30 วันล่าสุด", range: trailingDateRange(today, 30) },
    { id: "lastMonth", label: "เดือนที่แล้ว", range: { from: dateKey(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: dateKey(monthStart - DAY) } },
    { id: "all", label: "ตั้งแต่ต้น", range: availableFrom && availableFrom <= today ? { from: availableFrom, to: today } : undefined },
  ];
}
