import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSourceReport } from "../server/site-analytics/report.ts";
import { fetchSiteReport } from "../server/site-analytics/client.ts";
import { readSiteRange } from "../server/site-analytics/range.ts";
import { emptyMetrics, type AnalyticsHourlyPeriod } from "../lib/website-analytics.ts";
import { sites } from "./fixtures/website-analytics.ts";
import { websiteChartData } from "../lib/website-analytics-chart.ts";
import { websitePeriodSeries, websitePeriodChange } from "../lib/website-analytics-comparison.ts";
import { loadWebsiteSummaryPeriods } from "../server/services/website-analytics-comparison.ts";

export const hourlyPeriod: AnalyticsHourlyPeriod = { contract_version: "1.1", granularity: "hour", from_date: "2026-10-15", to_date: "2026-10-15", from_time: "09:00", to_time: "11:00", timezone: "Asia/Bangkok", as_of: "2026-10-16T04:00:00.000Z", villa_id: null };
const metrics = (views: number) => ({ ...emptyMetrics(), page_views: views });
test("implicit current month stays daily even on its first day", async () => {
  const seen: string[] = [];
  const summary = await loadWebsiteSummaryPeriods({ month: "2026-10", site: "all", page: 1 }, false, {
    now: () => new Date("2026-10-01T04:00:00Z"), sites: () => [sites[0]],
    read: async (_site, period) => { seen.push(period.contract_version); return { ok: false, reason: "unavailable" }; },
  });
  assert.equal(summary.period.contract_version, "1.0");
  assert.deepEqual(seen, ["1.0"]);
});
export function hourlySource() {
  return { contract_version: "1.1", site_id: sites[0].siteId, query: hourlyPeriod, generated_at: hourlyPeriod.as_of,
    coverage: { data_available_from: "2026-09-01T00:00:00Z", range_complete: true, rows_complete: true },
    totals: metrics(5), unattributed: metrics(0), daily: [{ ...metrics(5), date: "2026-10-15" }], villas: [{ ...metrics(5), villa_id: "9" }],
    hourly: [{ ...metrics(2), start: "2026-10-15T02:00:00+00:00", end: "2026-10-15T03:00:00Z" }, { ...metrics(3), start: "2026-10-15T03:00:00Z", end: "2026-10-15T04:00:00Z" }] };
}
test("hourly source is checked, normalized and forwarded without daily fallback", async () => {
  const report = parseSourceReport(hourlySource(), sites[0], hourlyPeriod);
  assert.equal(report.hourly?.[0].start, "2026-10-15T02:00:00.000Z");
  let calls = 0;
  const result = await readSiteRange(sites[0], hourlyPeriod, async () => { calls++; return { ok: true, report }; });
  assert.equal(calls, 1);
  assert.equal(result.ok && result.report.hourly?.length, 2);
  const failed = await fetchSiteReport(sites[0], hourlyPeriod, { token: async () => "fixture", fetch: async () => new Response("{}", { status: 422 }) });
  assert.deepEqual(failed, { ok: false, reason: "hourly_unavailable" });
});
test("forged hourly rows cannot turn partial or daily data into trusted hourly data", () => {
  for (const change of [
    { contract_version: "1.0" }, { hourly: hourlySource().hourly.slice(1) },
    { hourly: [hourlySource().hourly[0], hourlySource().hourly[0]] },
    { query: { ...hourlyPeriod, from_time: "08:00" } },
    { hourly: [{ ...hourlySource().hourly[0], page_views: 99 }, hourlySource().hourly[1]] },
    { hourly: [{ ...hourlySource().hourly[0], end: "2026-10-15T03:30:00Z" }, hourlySource().hourly[1]] },
  ]) assert.throws(() => parseSourceReport({ ...hourlySource(), ...change }, sites[0], hourlyPeriod));
});
test("hourly buckets reject calendar rollover and nonzero sub-millisecond offsets", () => {
  const fine = hourlySource();
  fine.hourly[0].start = "2026-10-15T02:00:00.000001Z";
  assert.throws(() => parseSourceReport(fine, sites[0], hourlyPeriod));
  const rollover = JSON.parse(JSON.stringify(hourlySource()).replaceAll("2026-10-15", "2026-03-02")) as ReturnType<typeof hourlySource>;
  rollover.hourly[0].start = "2026-02-30T02:00:00Z";
  rollover.hourly[0].end = "2026-02-30T03:00:00Z";
  assert.throws(() => parseSourceReport(rollover, sites[0], { ...hourlyPeriod, from_date: "2026-03-02", to_date: "2026-03-02" }));
});
test("hourly chart keeps observed zero distinct from future or pre-retention gaps", () => {
  const site = { ...sites[0], status: "complete" as const, coverage: { data_available_from: "2026-10-15T02:30:00Z", range_complete: false, rows_complete: true }, totals: metrics(2),
    hourly: [{ ...metrics(2), start: "2026-10-15T02:00:00.000Z", end: "2026-10-15T03:00:00.000Z" }, { ...metrics(0), start: "2026-10-15T03:00:00.000Z", end: "2026-10-15T04:00:00.000Z" }] };
  const data = websiteChartData([site], "2026-10", "page_views", "hour", { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "12:00" });
  assert.deepEqual(data.map(row => row.values[site.key]), [null, 0, null]);
});
test("retention watermark preserves PostgreSQL microseconds at an exact hour", () => {
  const input = hourlySource();
  input.coverage = { data_available_from: "2026-10-15T02:00:00.000001Z", range_complete: false, rows_complete: true };
  const report = parseSourceReport(input, sites[0], hourlyPeriod);
  const series = websiteChartData([{ ...sites[0], totals: report.totals, hourly: report.hourly, coverage: report.coverage, status: "partial" }], "2026-10", "page_views", "hour", { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "11:00" });
  assert.deepEqual(series.map(row => row.values[sites[0].key]), [null, 3]);
});
test("completed hours today can compare but ongoing or unequal durations cannot", () => {
  const site = { ...sites[0], status: "complete" as const, coverage: hourlySource().coverage, totals: metrics(5), hourly: parseSourceReport(hourlySource(), sites[0], hourlyPeriod).hourly };
  const range = { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "11:00" };
  const complete = websitePeriodSeries(site, range, "2026-10-15T05:00:00.000Z", "page_views");
  assert.equal(complete.status, "complete");
  assert.deepEqual(websitePeriodChange(complete, complete), { kind: "percentage", difference: 0, percentage: 0 });
  assert.equal(websitePeriodChange(complete, websitePeriodSeries(site, { ...range, timeTo: "12:00" }, hourlyPeriod.as_of, "page_views")).kind, "unavailable");
});
