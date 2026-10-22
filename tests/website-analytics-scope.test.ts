import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardAnalyticsFilterParams, parseWebsiteScope, scopeSearchParams } from "../lib/website-analytics-scope.ts";
import { parseWebsiteComparisonQuery, websitePeriodHref, websitePeriodRows, websiteMultiPeriodPoints } from "../lib/website-analytics-comparison.ts";
import { emptyMetrics, parseWebsiteAnalyticsQuery, type WebsiteSummary } from "../lib/website-analytics.ts";

const now = new Date("2026-10-15T03:00:00Z"), keys = ["a", "b", "c"];
const selection = { sites: ["a"], comparison: { from: "2026-09-01", to: "2026-09-03", sites: ["b", "c"] } };

test("applying analytics drafts commits primary dates, hours and comparison together without changing business filters", () => {
  const existing = new URLSearchParams("month=2026-10&dateFrom=2026-10-01&dateTo=2026-10-31&timeFrom=08%3A00&timeTo=17%3A00&analyticsCompare=previous&analyticsTimeFrom=00%3A00&analyticsTimeTo=24%3A00");
  const next = dashboardAnalyticsFilterParams(existing, "2026-10", { from: "2026-09-25", to: "2026-10-05", timeFrom: "09:00", timeTo: "18:00" }, selection);
  assert.equal(next.get("analyticsFrom"), "2026-09-25");
  assert.equal(next.get("analyticsTo"), "2026-10-05");
  assert.equal(next.get("analyticsTimeFrom"), "09:00");
  assert.equal(next.get("analyticsTimeTo"), "18:00");
  assert.equal(next.get("dateFrom"), "2026-10-01");
  assert.equal(next.get("dateTo"), "2026-10-31");
  assert.equal(next.get("timeFrom"), "08:00");
  assert.equal(next.get("analyticsCompare"), null);
  assert.deepEqual(JSON.parse(next.get("analyticsScope")!), selection);
  assert.equal(existing.get("analyticsFrom"), null);
  assert.equal(existing.get("analyticsCompare"), "previous");
  const cleared = dashboardAnalyticsFilterParams(next, "2026-10", { from: "2026-10-01", to: "2026-10-02" }, { sites: ["a"] });
  assert.equal(cleared.get("analyticsTimeFrom"), null);
  assert.equal(cleared.get("analyticsTimeTo"), null);
  assert.deepEqual(JSON.parse(cleared.get("analyticsScope")!), { sites: ["a"] });
});
test("normal website selection never creates a comparison dataset", () => {
  assert.equal(parseWebsiteScope(undefined, keys, now), undefined);
  assert.deepEqual(parseWebsiteScope(JSON.stringify({ sites: ["b"] }), keys, now), { sites: ["b"] });
});
test("dataset dates and website selections are independent and validated against the registry", () => {
  assert.deepEqual(parseWebsiteScope(JSON.stringify(selection), keys, now), selection);
  for (const raw of ["null", "[]", "{", JSON.stringify({ sites: [] }), JSON.stringify({ sites: ["evil"] }), JSON.stringify({ sites: ["a", "a"] }),
    JSON.stringify({ sites: ["a"], comparison: { ...selection.comparison, to: "2026-09-00" } }),
    JSON.stringify({ sites: ["a"], comparison: { ...selection.comparison, to: "2026-10-16" } }),
    JSON.stringify({ sites: ["a"], comparison: { ...selection.comparison, sites: [] } }),
    JSON.stringify({ sites: ["a"], endpoint: "https://evil.test" }), [JSON.stringify(selection)]]) {
    assert.throws(() => parseWebsiteScope(raw, keys, now), /invalid_query/);
  }
});
test("removing comparison retains the primary range, sites and unrelated page filters", () => {
  const params = new URLSearchParams("month=2026-10&analyticsFrom=2026-10-08&analyticsTo=2026-10-14&analyticsCompare=previous&dateFrom=2026-10-01");
  const result = scopeSearchParams(params, { sites: ["a"] });
  assert.equal(result.get("analyticsCompare"), null);
  assert.equal(result.get("analyticsFrom"), "2026-10-08");
  assert.equal(result.get("analyticsTo"), "2026-10-14");
  assert.equal(result.get("dateFrom"), "2026-10-01");
  assert.deepEqual(JSON.parse(result.get("analyticsScope")!), { sites: ["a"] });
});
test("page navigation retains custom scopes without expanding the analytics API", () => {
  const parsed = parseWebsiteComparisonQuery({ month: "2026-10", site: "a", analyticsScope: JSON.stringify(selection) }, keys, now);
  assert.equal(parsed.compare, true);
  assert.deepEqual(parsed.scope, selection);
  const href = websitePeriodHref(parsed.query, { page: 2 }, true, parsed.scope);
  const params = new URL(href, "https://app.test").searchParams;
  assert.deepEqual(JSON.parse(params.get("analyticsScope")!), selection);
  assert.equal(params.get("site"), "a");
  assert.throws(() => parseWebsiteAnalyticsQuery({ analyticsScope: JSON.stringify(selection) }, keys, now), /invalid_query/);
});
test("selecting a new primary website reveals it in the shared selection without changing dates", () => {
  const query = { month: "2026-10", site: "a", page: 1 };
  const normal = new URL(websitePeriodHref(query, { site: "b" }, false, { sites: ["a"] }), "https://app.test").searchParams;
  assert.deepEqual(JSON.parse(normal.get("analyticsScope")!), { sites: ["a", "b"] });
  const comparison = new URL(websitePeriodHref(query, { site: "b" }, true, selection), "https://app.test").searchParams;
  assert.deepEqual(JSON.parse(comparison.get("analyticsScope")!), { sites: ["a", "b"], comparison: { from: "2026-09-01", to: "2026-09-03", sites: ["a", "b"] } });
});
test("different website sets retain every selected line, with unselected distinguished from failed", () => {
  const site = (key: string, from: string, values: number[]): WebsiteSummary => ({ key, displayName: key, origin: "https://a.test", status: "complete",
    totals: { ...emptyMetrics(), page_views: values.reduce((a, b) => a + b, 0) }, coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true },
    daily: values.map((page_views, i) => ({ ...emptyMetrics(), page_views, date: new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10) })) });
  const rows = websitePeriodRows([site("a", "2026-10-08", [10, 20])], { from: "2026-10-08", to: "2026-10-09" },
    { granularity: "day", range: { from: "2026-09-01", to: "2026-09-03" }, sites: [site("b", "2026-09-01", [0, 5, 7])] }, now.toISOString(), "page_views", "day");
  assert.deepEqual(rows.map(row => [row.key, row.currentSelected, row.previousSelected]), [["a", true, false], ["b", false, true]]);
  const points = websiteMultiPeriodPoints(rows);
  assert.equal(points.length, 3, "the longer comparison must not be truncated");
  assert.deepEqual(points[2], { date: "", previousDate: "2026-09-03", values: { a: { current: null, previous: null }, b: { current: null, previous: 7 } } });
  assert.equal(points[0].values.b.previous, 0);
});
