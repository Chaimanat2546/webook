import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateWebsitePeriod } from "../lib/website-analytics-aggregate.ts";
import { pairWebsitePeriods } from "../lib/website-analytics-comparison.ts";
import { emptyMetrics, type AnalyticsDateRange, type WebsiteSummary } from "../lib/website-analytics.ts";

const range: AnalyticsDateRange = { from: "2026-10-12", to: "2026-10-14" };
const asOf = "2026-10-17T00:00:00Z";
function site(key: string, values: number[]): WebsiteSummary {
  return { key, displayName: key, origin: `https://${key}.test`, status: "complete", totals: { ...emptyMetrics(), page_views: values.reduce((sum, value) => sum + value, 0) }, coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true }, daily: values.map((value, index) => ({ date: `2026-10-${12 + index}`, ...emptyMetrics(), page_views: value })) };
}

test("aggregate sums each day across all supplied sites, retaining confirmed zero", () => {
  const result = aggregateWebsitePeriod([site("a", [3, 0, 4]), site("b", [7, 0, 6])], range, asOf, "page_views", "day");
  assert.deepEqual(result.daily.map(point => point.value), [10, 0, 10]);
  assert.deepEqual(Object.values(result.pointSiteCounts), [2, 2, 2]);
  assert.equal(result.selectedSites, 2);
  assert.equal(result.availableSites, 2);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.status, "complete");
});

test("failed and missing buckets expose partial sums and counts instead of invented zeroes", () => {
  const a = site("a", [3, 0]), b = site("b", [7]);
  const failed: WebsiteSummary = { ...site("failed", []), status: "timeout", totals: null, coverage: null };
  const result = aggregateWebsitePeriod([a, b, failed], range, asOf, "page_views", "day");
  assert.deepEqual(result.daily.map(point => point.value), [10, 0, null]);
  assert.deepEqual(Object.values(result.pointSiteCounts), [2, 1, 0]);
  assert.equal(result.availableSites, 2);
  assert.equal(result.selectedSites, 3);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.status, "partial");
  assert.deepEqual(aggregateWebsitePeriod([failed], range, asOf, "page_views", "day").daily.map(point => point.value), [null, null, null]);
  assert.equal(aggregateWebsitePeriod([], range, asOf, "page_views", "day").total, null);
});

test("retention and metric selection apply before daily aggregation", () => {
  const a = site("a", [3, 4, 5]);
  a.coverage!.data_available_from = "2026-10-13T00:00:00+07:00";
  const b = site("b", [7, 8, 9]);
  const result = aggregateWebsitePeriod([a, b], range, asOf, "page_views", "day");
  assert.deepEqual(result.daily.map(point => point.value), [7, 12, 14]);
  assert.equal(result.pointSiteCounts[range.from], 1);
  assert.equal(result.coverageComplete, false);
  assert.deepEqual(aggregateWebsitePeriod([a, b], range, asOf, "contact_clicks", "day").daily.map(point => point.value), [0, 0, 0]);
});

test("hourly aggregates retain clock alignment between independent windows", () => {
  const hours = (date: string, start: number, value: number): WebsiteSummary => ({ ...site("a", []), totals: { ...emptyMetrics(), page_views: value }, hourly: Array.from({ length: 3 }, (_, index) => ({ start: new Date(`${date}T${start + index}:00:00+07:00`).toISOString(), end: new Date(`${date}T${start + index + 1}:00:00+07:00`).toISOString(), ...emptyMetrics(), page_views: index ? 0 : value })) });
  const currentRange = { from: "2026-10-15", to: "2026-10-15", timeFrom: "10:00", timeTo: "13:00" };
  const previousRange = { from: "2026-10-14", to: "2026-10-14", timeFrom: "18:00", timeTo: "21:00" };
  const a = hours("2026-10-15", 10, 4);
  const current = aggregateWebsitePeriod([a, { ...a, key: "b" }], currentRange, asOf, "page_views", "hour");
  const previous = aggregateWebsitePeriod([hours("2026-10-14", 18, 7)], previousRange, asOf, "page_views", "hour");
  const paired = pairWebsitePeriods(current, previous);
  assert.equal(paired[0].hour, "10:00"); assert.equal(paired[0].current, 8); assert.equal(paired[0].previous, null);
  assert.equal(paired[8].hour, "18:00"); assert.equal(paired[8].previous, 7); assert.equal(paired[8].current, null);
  assert.equal(current.pointSiteCounts[current.daily[0].date], 2);
});

test("future hours remain absent and ongoing aggregates retain source status", () => {
  const selection = { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "12:00" };
  const a: WebsiteSummary = { ...site("a", []), hourly: [{ start: "2026-10-15T02:00:00.000Z", end: "2026-10-15T03:00:00.000Z", ...emptyMetrics() }] };
  const result = aggregateWebsitePeriod([a], selection, "2026-10-15T02:30:00Z", "page_views", "hour");
  assert.equal(result.status, "ongoing");
  assert.deepEqual(result.daily.map(point => point.value), [0, null, null]);
  assert.deepEqual(Object.values(result.pointSiteCounts), [1, 0, 0]);
});
