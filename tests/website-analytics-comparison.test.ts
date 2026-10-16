import assert from "node:assert/strict";

test("different hourly clock windows cannot produce growth percentages", () => {
  const base = { range: { from: "2026-10-14", to: "2026-10-14", timeFrom: "09:00", timeTo: "12:00" }, total: 20, availableDays: 3, expectedDays: 3, coverageComplete: true, status: "complete" as const, daily: [], granularity: "hour" as const, durationMinutes: 180 };
  assert.deepEqual(websitePeriodChange(base, { ...base, total: 10, range: { ...base.range, from: "2026-10-13", to: "2026-10-13", timeFrom: "18:00", timeTo: "21:00" } }), { kind: "unavailable" });
});
import { test } from "node:test";
import { emptyMetrics, type AnalyticsDateRange, type WebsiteSummary } from "../lib/website-analytics.ts";
import { previousAnalyticsRange, websitePeriodSeries, websitePeriodChange, pairWebsitePeriods, parseAnalyticsComparison, websitePeriodRows, websiteMultiPeriodPoints, websitePeriodHref, parseWebsiteComparisonQuery } from "../lib/website-analytics-comparison.ts";

const range = { from: "2026-10-08", to: "2026-10-09" };
const asOf = "2026-10-10T03:00:00.000Z";
function site(values: number[] = [12, 18], selected: AnalyticsDateRange = range): WebsiteSummary {
  return { key: "a", displayName: "A", origin: "https://a.test", status: "complete",
    coverage: { data_available_from: "2026-01-01T17:00:00Z", range_complete: true, rows_complete: true },
    totals: { ...emptyMetrics(), page_views: values.reduce((a, b) => a + b, 0) },
    daily: values.map((page_views, i) => ({ ...emptyMetrics(), page_views, date: new Date(Date.parse(selected.from) + i * 86400000).toISOString().slice(0, 10) })) };
}
const series = (input = site(), selected = range, snapshot = asOf) => websitePeriodSeries(input, selected, snapshot, "page_views", "day");

test("previous period is inclusive, adjacent and handles leap days and year boundaries", () => {
  for (const [current, expected] of [
    [{ from: "2026-10-08", to: "2026-10-14" }, { from: "2026-10-01", to: "2026-10-07" }],
    [{ from: "2024-03-01", to: "2024-03-01" }, { from: "2024-02-29", to: "2024-02-29" }],
    [{ from: "2026-01-01", to: "2026-01-03" }, { from: "2025-12-29", to: "2025-12-31" }],
  ]) assert.deepEqual(previousAnalyticsRange(current), expected);
  assert.equal(previousAnalyticsRange({ from: "1900-01-01", to: "1900-01-01" }), undefined);
});

test("comparison URL flag rejects arrays and unknown modes", () => {
  assert.equal(parseAnalyticsComparison(undefined), false);
  assert.equal(parseAnalyticsComparison("previous"), true);
  for (const invalid of ["true", "", ["previous"], ["previous", "previous"]]) assert.throws(() => parseAnalyticsComparison(invalid), /invalid_query/);
});

test("complete periods use source totals and produce signed changes", () => {
  const current = series();
  assert.deepEqual({ status: current.status, total: current.total, days: current.availableDays, expected: current.expectedDays }, { status: "complete", total: 30, days: 2, expected: 2 });
  assert.deepEqual(websitePeriodChange(current, series(site([10, 10]))), { kind: "percentage", difference: 10, percentage: 50 });
  assert.deepEqual(websitePeriodChange(series(site([7, 8])), current), { kind: "percentage", difference: -15, percentage: -50 });
  const totalsOnly = { ...site(), totals: { ...emptyMetrics(), page_views: 70 }, daily: undefined };
  assert.equal(series(totalsOnly).total, 70);
  assert.equal(series(totalsOnly).status, "partial");
});

test("reported zero is distinct from missing and retention does not fabricate points", () => {
  const input = site([0]);
  const partial = series(input);
  assert.equal(partial.status, "partial");
  assert.equal(partial.availableDays, 1);
  assert.deepEqual(partial.daily, [{ date: "2026-10-08", value: 0 }, { date: "2026-10-09", value: null }]);
  const retained = series({ ...site(), status: "partial", coverage: { data_available_from: "2026-10-08T17:00:00Z", range_complete: false, rows_complete: true } });
  assert.deepEqual(retained.daily.map(day => day.value), [null, 18]);
  assert.equal(retained.total, 30);
  assert.equal(websitePeriodChange(series(), retained).kind, "unavailable");
});

test("source partial flags and unknown coverage suppress changes even when dates are present", () => {
  for (const input of [
    { ...site(), status: "partial" as const },
    { ...site(), coverage: null },
    { ...site(), coverage: { ...site().coverage!, rows_complete: false } },
    { ...site(), coverage: { ...site().coverage!, range_complete: false } },
  ]) {
    assert.equal(series(input).status, "partial");
    assert.equal(series(input).availableDays, 2);
    assert.equal(websitePeriodChange(series(input), series()).kind, "unavailable");
    assert.equal(websitePeriodChange(series(), series(input)).kind, "unavailable");
  }
});

test("either-side failure stays null without erasing a usable report", () => {
  const failed = series({ ...site(), status: "timeout", totals: null, coverage: null });
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.total, null);
  assert.deepEqual(failed.daily.map(day => day.value), [null, null]);
  assert.equal(websitePeriodChange(series(), failed).kind, "unavailable");
  assert.equal(websitePeriodChange(failed, series()).kind, "unavailable");
});

test("zero baseline never becomes infinity and confirmed zero-to-zero is unchanged", () => {
  assert.deepEqual(websitePeriodChange(series(), series(site([0, 0]))), { kind: "zero_baseline", difference: 30 });
  assert.deepEqual(websitePeriodChange(series(site([0, 0])), series(site([0, 0]))), { kind: "unchanged", difference: 0 });
  assert.deepEqual(websitePeriodChange(series(site([0, 0])), series()), { kind: "percentage", difference: -30, percentage: -100 });
});

test("Bangkok calendar day remains ongoing until local midnight", () => {
  const before = series(site(), range, "2026-10-09T16:59:59.000Z");
  const after = series(site(), range, "2026-10-09T17:00:00.000Z");
  assert.equal(before.status, "ongoing");
  assert.equal(after.status, "complete");
  assert.equal(websitePeriodChange(before, after).kind, "unavailable");
});

test("an ongoing range retains independent incomplete coverage even with every daily date", () => {
  const input = { ...site(), status: "partial" as const, coverage: { ...site().coverage!, rows_complete: false } };
  const result = series(input, range, "2026-10-09T03:00:00.000Z");
  assert.equal(result.status, "ongoing");
  assert.equal(result.availableDays, 2);
  assert.equal(result.coverageComplete, false);
  assert.equal(series(site(), range, "2026-10-09T03:00:00.000Z").coverageComplete, true);
});

test("daily points pair by date offset and retain actual dates and gaps", () => {
  const previous = { from: "2026-10-06", to: "2026-10-07" };
  assert.deepEqual(pairWebsitePeriods(series(), series(site([0], previous), previous)), [
    { date: "2026-10-08", previousDate: "2026-10-06", current: 12, previous: 0 },
    { date: "2026-10-09", previousDate: "2026-10-07", current: 18, previous: null },
  ]);
});

test("overview aligns every website without copying failed values or confusing zero with a gap", () => {
  const previousRange = { from: "2026-10-06", to: "2026-10-07" };
  const current = [site(), { ...site([0]), key: "b", displayName: "B" }];
  const previous = { granularity: "day" as const, range: previousRange, sites: [site([10, 10], previousRange), { ...site(), key: "b", totals: null, status: "timeout" as const }] };
  const rows = websitePeriodRows(current, range, previous, asOf, "page_views", "day");
  assert.deepEqual(rows.map(row => row.key), ["a", "b"]);
  assert.deepEqual(websiteMultiPeriodPoints(rows), [
    { date: "2026-10-08", previousDate: "2026-10-06", values: { a: { current: 12, previous: 10 }, b: { current: 0, previous: null } } },
    { date: "2026-10-09", previousDate: "2026-10-07", values: { a: { current: 18, previous: 10 }, b: { current: null, previous: null } } },
  ]);
});

test("website comparison is a page-only flag with validated site filters and preserved navigation", () => {
  const now = new Date(asOf);
  const parsed = parseWebsiteComparisonQuery({ month: "2026-10", site: "a", from: range.from, to: range.to, analyticsCompare: "previous" }, ["a", "b"], now);
  assert.equal(parsed.compare, true);
  assert.equal(parsed.query.site, "a");
  assert.equal("analyticsCompare" in parsed.query, false);
  assert.equal(websitePeriodHref(parsed.query, { site: "b" }, true), "/admin/dashboard/websites?month=2026-10&site=b&from=2026-10-08&to=2026-10-09&analyticsCompare=previous");
  assert.equal(websitePeriodHref(parsed.query, {}, false), "/admin/dashboard/websites?month=2026-10&site=a&from=2026-10-08&to=2026-10-09");
  assert.throws(() => parseWebsiteComparisonQuery({ analyticsCompare: ["previous", "previous"] }, ["a"], now), /invalid_query/);
  assert.throws(() => parseWebsiteComparisonQuery({ site: "arbitrary-site", analyticsCompare: "previous" }, ["a"], now), /invalid_query/);
});
