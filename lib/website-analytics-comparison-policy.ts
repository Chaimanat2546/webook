import type { AnalyticsDateRange } from "./website-analytics.ts";
import type { WebsitePeriodSeries } from "./website-analytics-comparison.ts";
import { parseAnalyticsTimeRange } from "./website-analytics-time.ts";

export type ComparisonGranularity = "hour" | "day";
export interface ComparisonPeriodDescriptor {
  range: AnalyticsDateRange;
  granularity: ComparisonGranularity;
  dayCount: number;
  timeFrom: string;
  timeTo: string;
  requestedHours: number;
}
export type ComparisonConditionReason = "granularity_mismatch" | "day_count_mismatch" | "time_window_mismatch";
export type ComparisonReason = ComparisonConditionReason | "site_not_shared" | "load_failed" | "coverage_incomplete" | "not_started" | "ongoing";
interface ComparisonConditions { layout: "overlay" | "separate"; reasons: ComparisonConditionReason[] }
export interface ComparisonAssessment { layout: "overlay" | "separate"; canCompare: boolean; reasons: ComparisonReason[] }

/** Input dates have already passed the analytics boundary validator. */
export function describeComparisonPeriod(range: AnalyticsDateRange, granularity: ComparisonGranularity): ComparisonPeriodDescriptor {
  const time = parseAnalyticsTimeRange(range.timeFrom, range.timeTo, range) ?? { timeFrom: "00:00", timeTo: "24:00" };
  const dayCount = (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1;
  return { range, granularity, dayCount, ...time, requestedHours: dayCount * (Number(time.timeTo.slice(0, 2)) - Number(time.timeFrom.slice(0, 2))) };
}

export function comparePeriodConditions(current: ComparisonPeriodDescriptor, previous: ComparisonPeriodDescriptor): ComparisonConditions {
  const reasons: ComparisonConditionReason[] = [];
  if (current.granularity !== previous.granularity) reasons.push("granularity_mismatch");
  if (current.dayCount !== previous.dayCount) reasons.push("day_count_mismatch");
  const clocksDiffer = current.timeFrom !== previous.timeFrom || current.timeTo !== previous.timeTo;
  if (clocksDiffer) reasons.push("time_window_mismatch");
  return { layout: current.granularity !== previous.granularity || current.granularity === "hour" && clocksDiffer ? "separate" : "overlay", reasons };
}

export function assessPeriodComparison(current: WebsitePeriodSeries, previous: WebsitePeriodSeries, selection = { currentSelected: true, previousSelected: true }): ComparisonAssessment {
  const conditions = comparePeriodConditions(describeComparisonPeriod(current.range, current.granularity ?? "day"), describeComparisonPeriod(previous.range, previous.granularity ?? "day"));
  const reasons: ComparisonReason[] = [];
  if (!selection.currentSelected || !selection.previousSelected) reasons.push("site_not_shared");
  reasons.push(...conditions.reasons);
  const selected = [selection.currentSelected ? current : undefined, selection.previousSelected ? previous : undefined].filter((series): series is WebsitePeriodSeries => Boolean(series));
  if (selected.some(series => series.total === null || series.status === "unavailable")) reasons.push("load_failed");
  if (selected.some(series => series.total !== null && series.status !== "unavailable" && (!series.coverageComplete || series.status === "partial"))) reasons.push("coverage_incomplete");
  const notStarted = (series: WebsitePeriodSeries) => Boolean(series.asOf && Date.parse(series.asOf) <= Date.parse(`${series.range.from}T${series.range.timeFrom ?? "00:00"}:00+07:00`));
  if (selected.some(notStarted)) reasons.push("not_started");
  if (selected.some(series => series.status === "ongoing" && !notStarted(series))) reasons.push("ongoing");
  return { layout: conditions.layout, canCompare: reasons.length === 0, reasons };
}

export function matchComparisonConditions(primary: AnalyticsDateRange, comparison: AnalyticsDateRange): AnalyticsDateRange | undefined {
  const descriptor = describeComparisonPeriod(primary, "day");
  const from = new Date(Date.parse(comparison.to) - (descriptor.dayCount - 1) * 86400000).toISOString().slice(0, 10);
  if (from < "1900-01-01") return undefined;
  return { from, to: comparison.to, timeFrom: descriptor.timeFrom, timeTo: descriptor.timeTo };
}
