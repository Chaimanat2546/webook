import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteChartData, websiteComparisonData } from "../lib/website-analytics-chart.ts";
import { emptyMetrics, type WebsiteSummary } from "../lib/website-analytics.ts";

const sites: WebsiteSummary[] = [
  { key: "a", displayName: "A", origin: "https://a.test", status: "complete", coverage: null, totals: emptyMetrics(), daily: [
    { ...emptyMetrics(), date: "2026-10-01", page_views: 12, contact_clicks: 3, gallery_opens: 7 },
    { ...emptyMetrics(), date: "2026-10-02" },
  ] },
  { key: "b", displayName: "B", origin: "https://b.test", status: "partial", totals: emptyMetrics(), coverage: { data_available_from: "2026-10-01T17:00:00Z", range_complete: false, rows_complete: true }, daily: [
    { ...emptyMetrics(), date: "2026-10-01" },
    { ...emptyMetrics(), date: "2026-10-02", page_views: 5, contact_clicks: 2, gallery_opens: 9 },
    { ...emptyMetrics(), date: "2026-09-30", page_views: 20 },
  ] },
  { key: "c", displayName: "C", origin: "https://c.test", status: "unavailable", totals: null, coverage: null },
];
test("website comparison uses selected-month totals for three simultaneous metrics, not daily history", () => {
  const input = [
    { ...sites[0], totals: { ...emptyMetrics(), page_views: 1200, contact_clicks: 30, gallery_opens: 70 } },
    { ...sites[1], totals: emptyMetrics() },
    sites[2],
  ];
  assert.deepEqual(websiteComparisonData(input), [
    { key: "a", displayName: "A", page_views: 1200, contact_clicks: 30, gallery_opens: 70 },
    { key: "b", displayName: "B", page_views: 0, contact_clicks: 0, gallery_opens: 0 },
    { key: "c", displayName: "C", page_views: null, contact_clicks: null, gallery_opens: null },
  ]);
});
test("daily trend aligns dates, preserves zero and gaps, filters month and Bangkok retention", () => {
  assert.deepEqual(websiteChartData(sites, "2026-10", "page_views"), [
    { date: "2026-10-01", values: { a: 12, b: null, c: null } },
    { date: "2026-10-02", values: { a: 0, b: 5, c: null } },
  ]);
  assert.deepEqual(websiteChartData(sites, "2026-10", "contact_clicks").map(day => day.values.a), [3, 0]);
  assert.deepEqual(websiteChartData(sites, "2026-10", "gallery_opens").map(day => day.values.b), [null, 9]);
});
test("totals alone cannot manufacture daily points", () => {
  assert.deepEqual(websiteChartData([{ ...sites[0], daily: undefined }], "2026-10", "page_views"), []);
  assert.deepEqual(websiteChartData(sites, "2026-11", "page_views"), []);
});

test("monthly chart reads per-site history even when the selected month's source failed", () => {
  const historical = [{ ...sites[2], monthly: [{ date: "2026-09", page_views: 8, contact_clicks: 2, gallery_opens: 4, status: "complete" as const }, { date: "2026-10", page_views: null, contact_clicks: null, gallery_opens: null, status: "unavailable" as const }] }];
  assert.deepEqual(websiteChartData(historical, "2026-10", "gallery_opens", "month"), [
    { date: "2026-09", values: { c: 4 } }, { date: "2026-10", values: { c: null } },
  ]);
});
