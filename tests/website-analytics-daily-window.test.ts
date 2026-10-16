import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsPeriod, analyticsDateRange, emptyMetrics, parseWebsiteAnalyticsQuery, websiteAnalyticsHref, type AnalyticsPeriod } from "../lib/website-analytics.ts";
import { parseWebsiteScope } from "../lib/website-analytics-scope.ts";
import { parseSourceReport } from "../server/site-analytics/report.ts";
import { readSiteRange } from "../server/site-analytics/range.ts";
import { websiteChartData } from "../lib/website-analytics-chart.ts";
import { websitePeriodSeries, websitePeriodChange, websitePeriodRows, websiteMultiPeriodPoints } from "../lib/website-analytics-comparison.ts";
import { fetchSiteReport } from "../server/site-analytics/client.ts";
import { sites } from "./fixtures/website-analytics.ts";
import { dailyWindowBounds } from "../lib/website-analytics-time.ts";

const now = new Date("2026-10-17T00:00:00.000Z");
const range = { from: "2026-10-14", to: "2026-10-16", timeFrom: "09:00", timeTo: "18:00" };
const period = { contract_version: "1.2" as const, granularity: "day" as const, from_date: range.from, to_date: range.to, from_time: "09:00", to_time: "18:00", timezone: "Asia/Bangkok" as const, as_of: now.toISOString(), villa_id: null };
function raw(query: AnalyticsPeriod = period, value = 2) {
  const daily = [];
  for (let date = Date.parse(query.from_date); date <= Date.parse(query.to_date); date += 86400000) daily.push({ ...emptyMetrics(), page_views: value, date: new Date(date).toISOString().slice(0, 10) });
  const metrics = { ...emptyMetrics(), page_views: value * daily.length };
  return { contract_version: query.contract_version, site_id: sites[0].siteId, query, generated_at: query.as_of, totals: metrics, unattributed: metrics, villas: [], daily, coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true } };
}

test("recurring range uses1.2 and persists hours through scope and links", () => {
  const query = parseWebsiteAnalyticsQuery(range, ["a"], now);
  assert.deepEqual(analyticsPeriod(query, now), period);
  assert.deepEqual(analyticsDateRange(period), range);
  for (const changes of [{ from: "2026-10-13", to: "2026-10-16" }, { page: 2 }, { site: "a", sort: "contacts" as const, search: "บ้าน" }]) assert.equal(new URL(websiteAnalyticsHref(query, changes), "http://local").searchParams.get("timeFrom"), "09:00");
  const scoped = parseWebsiteScope(JSON.stringify({ sites: ["a"], comparison: { ...range, sites: ["a"] } }), ["a"], now);
  assert.equal(scoped?.comparison?.timeFrom, "09:00");
  assert.throws(() => parseWebsiteAnalyticsQuery({ ...range, granularity: "hour" }, ["a"], now));
});
test("1.2 parser checks echoes, counts and absence of hourly; future windows must be zero", () => {
  assert.equal(parseSourceReport(raw(), sites[0], period).totals.page_views, 6);
  for (const change of [{ query: { ...period, from_time: "10:00" } }, { hourly: [] }, { contract_version: "1.0" }, { totals: { ...emptyMetrics(), page_views: 9 } }, { daily: raw().daily.slice(1) }]) assert.throws(() => parseSourceReport({ ...raw(), ...change }, sites[0], period));
  const morning = { ...period, as_of: "2026-10-16T01:30:00.000Z" };
  assert.throws(() => parseSourceReport(raw(morning), sites[0], morning), "future metrics cannot leak into totals");
  const zeroFuture = raw(morning); zeroFuture.daily[2].page_views = 0; zeroFuture.totals.page_views = zeroFuture.unattributed.page_views = 4;
  assert.equal(parseSourceReport(zeroFuture, sites[0], morning).totals.page_views, 4);
});
test("1.2 chunks preserve clocks and daily mode including the final single day", async () => {
  for (const days of [90, 91, 180]) {
    const calls: AnalyticsPeriod[] = [];
    const selected = { ...period, from_date: "2026-01-01", to_date: new Date(Date.parse("2026-01-01") + (days - 1) * 86400000).toISOString().slice(0, 10) };
    const result = await readSiteRange(sites[0], selected, async (_site, chunk) => { calls.push(chunk); return { ok: true, report: parseSourceReport(raw(chunk), sites[0], chunk) }; });
    assert.equal(calls.length, Math.ceil(days / 90));
    assert.ok(calls.every(q => q.contract_version === "1.2" && q.from_time === "09:00" && q.to_time === "18:00" && q.as_of === period.as_of));
    assert.ok(result.ok); if (result.ok) { assert.equal(result.report.daily.length, days); assert.equal(result.report.totals.page_views, days * 2); }
  }
});
test("1.2 unsupported sources fail explicitly without full-day fallback", async () => {
  const result = await fetchSiteReport(sites[0], period, { token: async () => "local-fixture-token", fetch: async () => new Response("{}", { status: 422 }) });
  assert.deepEqual(result, { ok: false, reason: "time_range_unavailable" });
});
test("daily windows mask future and microsecond retention; complete at selected end", () => {
  const report = parseSourceReport(raw(), sites[0], period);
  const site = { ...sites[0], status: "complete" as const, totals: report.totals, daily: report.daily, coverage: report.coverage };
  const data = websiteChartData([site], "2026-10", "page_views", "day", range, "2026-10-16T01:30:00.000Z");
  assert.deepEqual(data.map(p => p.values[site.key]), [2, 2, null]);
  const retained = { ...site, coverage: { ...site.coverage, data_available_from: "2026-10-14T02:00:00.000001Z", range_complete: false } };
  assert.equal(websiteChartData([retained], "2026-10", "page_views", "day", range, period.as_of)[0].values[site.key], null);
  assert.equal(websiteChartData([{ ...retained, coverage: { ...retained.coverage, data_available_from: "2026-10-14T01:59:59.999999Z" } }], "2026-10", "page_views", "day", range, period.as_of)[0].values[site.key], 2);
  const ended = websitePeriodSeries(site, range, "2026-10-16T11:00:00.000Z", "page_views", "day");
  assert.equal(ended.status, "complete");
  assert.equal(websitePeriodSeries(site, range, "2026-10-16T04:30:00.000Z", "page_views", "day").status, "ongoing");
  const shifted = websitePeriodSeries(site, { ...range, timeFrom: "10:00", timeTo: "19:00" }, period.as_of, "page_views", "day");
  assert.deepEqual(websitePeriodChange(ended, shifted), { kind: "unavailable" });
});

test("an unavailable first website retains the daily axis for healthy comparison websites", () => {
  const report = parseSourceReport(raw(), sites[0], period);
  const failed = { ...sites[1], status: "unavailable" as const, totals: null, coverage: null };
  const healthy = { ...sites[0], status: "complete" as const, totals: report.totals, daily: report.daily, coverage: report.coverage };
  const rows = websitePeriodRows([failed, healthy], range, { range, granularity: "day", sites: [failed, healthy] }, period.as_of, "page_views", "day");
  const points = websiteMultiPeriodPoints(rows);
  assert.deepEqual(points.map(p => p.date), ["2026-10-14", "2026-10-15", "2026-10-16"]);
  assert.equal(points[0].values[healthy.key].current, 2);
  assert.equal(points[0].values[failed.key].current, null);
});

test("daily bounds preserve midnight and reject impossible calendar dates", () => {
  assert.deepEqual(dailyWindowBounds("2026-10-16", { timeFrom: "23:00", timeTo: "24:00" }), { start: "2026-10-16T16:00:00.000Z", end: "2026-10-16T17:00:00.000Z" });
  assert.throws(() => dailyWindowBounds("2026-02-30", { timeFrom: "09:00", timeTo: "18:00" }));
});

test("chunk failures do not return partial success and microsecond watermarks use the latest value", async () => {
  const selected = { ...period, from_date: "2026-01-01", to_date: "2026-04-01" };
  let count = 0;
  const failed = await readSiteRange(sites[0], selected, async (_site, chunk) => ++count === 2 ? { ok: false, reason: "timeout" } : { ok: true, report: parseSourceReport(raw(chunk), sites[0], chunk) });
  assert.deepEqual(failed, { ok: false, reason: "timeout" });
  count = 0;
  const changed = await readSiteRange(sites[0], selected, async (_site, chunk) => {
    const report = parseSourceReport(raw(chunk), sites[0], chunk);
    report.coverage.data_available_from = `2025-12-01T00:00:00.00000${++count}Z`;
    return { ok: true, report };
  });
  assert.ok(changed.ok);
  if (changed.ok) { assert.equal(changed.report.coverage.data_available_from, "2025-12-01T00:00:00.000002Z"); assert.equal(changed.report.coverage.range_complete, false); }
});

test("full-day legacy and recurring daily windows can compare when complete", () => {
  const report = parseSourceReport(raw(), sites[0], period);
  const site = { ...sites[0], status: "complete" as const, totals: report.totals, daily: report.daily, coverage: report.coverage };
  const full = websitePeriodSeries(site, { ...range, timeFrom: "00:00", timeTo: "24:00" }, period.as_of, "page_views", "day");
  const legacy = websitePeriodSeries(site, { from: range.from, to: range.to }, period.as_of, "page_views", "day");
  assert.equal(full.status, "complete");
  assert.equal(websitePeriodChange(full, legacy).kind, "percentage");
});
