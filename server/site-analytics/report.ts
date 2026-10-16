import "server-only";
import { addMetrics, emptyMetrics, METRIC_KEYS, type AnalyticsMetrics, type AnalyticsPeriod, type AnalyticsSite, type SourceReport } from "../../lib/website-analytics.ts";

import { atOrAfterAnalyticsTimestamp, dailyWindowBounds, hourlyBounds } from "../../lib/website-analytics-time.ts";
function invalid(): never { throw new Error("invalid_report"); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
}
function metrics(value: unknown): AnalyticsMetrics {
  const row = object(value);
  const result = { page_views: count(row.page_views), phone_clicks: count(row.phone_clicks), chat_clicks: count(row.chat_clicks), line_clicks: count(row.line_clicks), gallery_opens: count(row.gallery_opens), contact_clicks: 0 };
  result.contact_clicks = count(result.phone_clicks + result.chat_clicks + result.line_clicks);
  return result;
}
function equal(a: AnalyticsMetrics, b: AnalyticsMetrics) {
  if (METRIC_KEYS.some(key => a[key] !== b[key])) invalid();
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value) || !Number.isFinite(Date.parse(value))) return invalid();
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) return invalid();
  return value;
}
export function parseSourceReport(value: unknown, site: AnalyticsSite, period: AnalyticsPeriod): SourceReport {
  const row = object(value), query = object(row.query), coverage = object(row.coverage);
  if (row.contract_version !== period.contract_version || row.site_id !== site.siteId || query.contract_version !== period.contract_version || query.from_date !== period.from_date || query.to_date !== period.to_date || query.timezone !== period.timezone || query.villa_id !== null || query.as_of !== period.as_of) invalid();
  const bounds = period.contract_version === "1.1" ? hourlyBounds(period.from_date, { timeFrom: period.from_time, timeTo: period.to_time }, period.as_of) : undefined;
  if (period.contract_version === "1.1" && (query.granularity !== "hour" || query.from_time !== period.from_time || query.to_time !== period.to_time || period.from_date !== period.to_date)) invalid();
  if (period.contract_version === "1.2" && (query.granularity !== "day" || query.from_time !== period.from_time || query.to_time !== period.to_time)) invalid();
  timestamp(row.generated_at);
  const available = timestamp(coverage.data_available_from);
  const selectedStart = period.contract_version === "1.2" ? dailyWindowBounds(period.from_date, { timeFrom: period.from_time, timeTo: period.to_time }).start : bounds?.start ?? `${period.from_date}T00:00:00+07:00`;
  const rangeComplete = atOrAfterAnalyticsTimestamp(selectedStart, available);
  if (typeof coverage.range_complete !== "boolean" || typeof coverage.rows_complete !== "boolean" || coverage.range_complete !== rangeComplete) invalid();
  if (!Array.isArray(row.daily) || !Array.isArray(row.villas)) invalid();
  const totals = metrics(row.totals), unattributed = metrics(row.unattributed);
  const days = new Set<string>();
  const daily = row.daily.map(value => {
    const day = object(value);
    if (typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.date < period.from_date || day.date > period.to_date || days.has(day.date) || new Date(`${day.date}T00:00:00Z`).toISOString().slice(0, 10) !== day.date) invalid();
    days.add(day.date);
    const values = metrics(day);
    if (period.contract_version === "1.2" && Date.parse(dailyWindowBounds(day.date, { timeFrom: period.from_time, timeTo: period.to_time }).start) >= Date.parse(period.as_of) && METRIC_KEYS.some(key => values[key] !== 0)) invalid();
    return { ...values, date: day.date };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const expectedDays = (Date.parse(period.to_date) - Date.parse(period.from_date)) / 86400000 + 1;
  if (days.size !== expectedDays) invalid();
  const ids = new Set<string>();
  const villas = row.villas.map(value => {
    const villa = object(value);
    if (typeof villa.villa_id !== "string" || !/^[1-9]\d{0,17}$/.test(villa.villa_id) || ids.has(villa.villa_id)) invalid();
    ids.add(villa.villa_id);
    return { ...metrics(villa), villa_id: villa.villa_id };
  });
  equal(totals, daily.reduce(addMetrics, emptyMetrics()));
  equal(totals, villas.reduce(addMetrics, unattributed));
  let hourly;
  if (bounds) {
    if (!Array.isArray(row.hourly) || row.hourly.length !== bounds.buckets.length) invalid();
    hourly = row.hourly.map((value, index) => {
      const hour = object(value), expected = bounds.buckets[index];
      for (const value of [hour.start, hour.end]) if (typeof value !== "string" || !/T\d{2}:00:00(?:\.0{1,6})?(?:Z|\+00:00)$/.test(value)) invalid();
      const start = new Date(timestamp(hour.start)).toISOString(), end = new Date(timestamp(hour.end)).toISOString();
      if (start !== expected.start || end !== expected.end) invalid();
      return { ...metrics(hour), start, end };
    });
    equal(totals, hourly.reduce(addMetrics, emptyMetrics()));
  } else if (row.hourly !== undefined) invalid();
  return { totals, unattributed, daily, ...(hourly ? { hourly } : {}), villas, coverage: { data_available_from: available, range_complete: rangeComplete, rows_complete: coverage.rows_complete } };
}
