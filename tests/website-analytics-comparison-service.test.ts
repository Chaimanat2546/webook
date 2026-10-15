import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics, type AnalyticsPeriod, type AnalyticsSite, type SiteReportResult } from "../lib/website-analytics.ts";
import { loadWebsiteSummaryPeriods, loadPreviousWebsitePeriod } from "../server/services/website-analytics-comparison.ts";
import { sites } from "./fixtures/website-analytics.ts";

const query = { month: "2026-10", from: "2026-10-08", to: "2026-10-14", site: "all", page: 1 };
const now = () => new Date("2026-10-15T03:00:00.000Z");
test("custom datasets load only their independent sites and dates at one snapshot", async () => {
  const reads: string[][] = [];
  const scope = { sites: [sites[0].key], comparison: { from: "2026-09-01", to: "2026-09-03", sites: [sites[1].key] } };
  const result = await loadWebsiteSummaryPeriods(query, false, { now, sites: () => sites, read: async (site, period) => { reads.push([site.key, period.from_date, period.to_date, period.as_of]); return report(site, period); } }, scope);
  assert.deepEqual(reads, [[sites[0].key, "2026-10-08", "2026-10-14", "2026-10-15T03:00:00.000Z"], [sites[1].key, "2026-09-01", "2026-09-03", "2026-10-15T03:00:00.000Z"]]);
  assert.deepEqual(result.sites.map(site => site.key), [sites[0].key]);
  assert.deepEqual(result.previous?.sites.map(site => site.key), [sites[1].key]);
  reads.length = 0;
  const normal = await loadWebsiteSummaryPeriods(query, true, { now, sites: () => sites, read: async (site, period) => { reads.push([site.key]); return report(site, period); } }, { sites: [sites[0].key] });
  assert.equal(normal.previous, undefined, "an explicit normal scope overrides legacy compare flags");
  assert.equal(reads.length, 1);
});
function report(_site: AnalyticsSite, period: AnalyticsPeriod): SiteReportResult {
  const metrics = { ...emptyMetrics(), page_views: period.from_date === "2026-10-08" ? 7 : 3 };
  return { ok: true, report: { totals: metrics, unattributed: metrics, villas: [],
    daily: [{ ...metrics, date: period.from_date }], coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true } } };
}

test("comparison loads adjacent periods with the same snapshot and at most two concurrent upstream reads", async () => {
  let clockReads = 0, active = 0, maximum = 0;
  const requests: AnalyticsPeriod[] = [];
  const result = await loadWebsiteSummaryPeriods(query, true, { now: () => { clockReads++; return now(); }, sites: () => sites,
    read: async (site, period) => {
      requests.push(period); maximum = Math.max(maximum, ++active);
      await new Promise(resolve => setTimeout(resolve, 5)); active--;
      return report(site, period);
    } });
  assert.equal(clockReads, 1);
  assert.equal(maximum, 2);
  assert.deepEqual(requests.map(r => [r.from_date, r.to_date, r.as_of]), [
    ["2026-10-08", "2026-10-14", "2026-10-15T03:00:00.000Z"],
    ["2026-10-08", "2026-10-14", "2026-10-15T03:00:00.000Z"],
    ["2026-10-01", "2026-10-07", "2026-10-15T03:00:00.000Z"],
    ["2026-10-01", "2026-10-07", "2026-10-15T03:00:00.000Z"],
  ]);
  assert.equal(result.sites[0].totals?.page_views, 7);
  assert.equal(result.previous?.sites[0].totals?.page_views, 3);
  assert.deepEqual(result.previous?.range, { from: "2026-10-01", to: "2026-10-07" });
  assert.equal(result.period.as_of, "2026-10-15T03:00:00.000Z");
});

test("comparison off reads current range only and does not query optional catalog titles", async () => {
  let reads = 0, titleReads = 0;
  const result = await loadWebsiteSummaryPeriods(query, false, { now, sites: () => sites,
    titles: async () => { titleReads++; throw new Error("should not read titles"); },
    read: async (site, period) => { reads++; return report(site, period); } });
  assert.equal(reads, 2);
  assert.equal(titleReads, 0);
  assert.equal(result.previous, undefined);
  assert.equal(result.sites[0].totals?.page_views, 7);
});

test("one prior failure preserves current totals, successful prior sites and their diagnostic status", async () => {
  const result = await loadWebsiteSummaryPeriods(query, true, { now, sites: () => sites, read: async (site, period) => {
    if (period.from_date === "2026-10-01" && site.key === sites[0].key) return { ok: false, reason: "timeout" };
    return report(site, period);
  } });
  assert.equal(result.sites[0].totals?.page_views, 7);
  assert.equal(result.previous?.sites[0].totals, null);
  assert.equal(result.previous?.sites[0].status, "timeout");
  assert.equal(result.previous?.sites[1].totals?.page_views, 3);
});

test("current failure does not stop loading the prior period", async () => {
  const result = await loadWebsiteSummaryPeriods(query, true, { now, sites: () => sites, read: async (site, period) => {
    if (period.from_date === "2026-10-08") throw new Error("offline");
    return report(site, period);
  } });
  assert.equal(result.sites[0].totals, null);
  assert.equal(result.previous?.sites[0].totals?.page_views, 3);
});

test("previous dates outside the supported calendar do not fetch an invalid range", async () => {
  let reads = 0;
  const result = await loadWebsiteSummaryPeriods({ ...query, month: "1900-01", from: "1900-01-01", to: "1900-01-01" }, true,
    { now, sites: () => sites, read: async (site, period) => { reads++; return report(site, period); } });
  assert.equal(reads, 2);
  assert.equal(result.previous, undefined);
});

test("website detail loads only that site's previous period with the existing report snapshot", async () => {
  const requests: { key: string; period: AnalyticsPeriod }[] = [];
  const currentPeriod: AnalyticsPeriod = { from_date: query.from, to_date: query.to, as_of: "2026-10-15T03:00:00.000Z", timezone: "Asia/Bangkok", contract_version: "1.0", villa_id: null };
  const previous = await loadPreviousWebsitePeriod({ ...query, site: sites[1].key }, currentPeriod, { sites: () => sites,
    now: () => { throw new Error("must reuse snapshot"); }, read: async (site, period) => { requests.push({ key: site.key, period }); return report(site, period); } });
  assert.deepEqual(requests, [{ key: sites[1].key, period: { ...currentPeriod, from_date: "2026-10-01", to_date: "2026-10-07" } }]);
  assert.equal(previous?.sites.length, 1);
  assert.equal(previous?.sites[0].key, sites[1].key);
  assert.equal(await loadPreviousWebsitePeriod({ ...query, view: "houses" }, currentPeriod, { read: async () => { throw new Error("must not read"); } }), undefined);
});
