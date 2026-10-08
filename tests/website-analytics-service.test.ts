import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { emptyMetrics, type SiteReportResult } from "../lib/website-analytics.ts";
import { parseSourceReport } from "../server/site-analytics/report.ts";
import { sites, source, period } from "./fixtures/website-analytics.ts";
const query = { month: "2026-10", site: "all", page: 1 };
const now = () => new Date(period.as_of);
test("aggregation shares snapshot, bounds concurrency and adds independent sites", async () => {
  let active = 0, maximum = 0;
  const result = await loadWebsiteAnalytics(query, { now, sites: () => sites, read: async (site, request) => {
    assert.deepEqual(request, period); maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return { ok: true, report: parseSourceReport(source(site), site, period) };
  } });
  assert.equal(maximum, 2); assert.equal(result.totals?.contact_clicks, 10);
  assert.equal(result.daily[0].page_views, 8); assert.equal(result.villas.total, 2);
  assert.equal(result.status, "complete");
});
test("partial, unavailable and incomplete retention are never complete zero reports", async () => {
  const success: SiteReportResult = { ok: true, report: parseSourceReport(source(), sites[0], period) };
  const result = await loadWebsiteAnalytics(query, { now, sites: () => sites, read: async site => site.key === sites[0].key ? success : { ok: false, reason: "not_configured" } });
  assert.equal(result.status, "partial"); assert.equal(result.availableSites, 1); assert.equal(result.totals?.page_views, 4);
  assert.equal(result.websites[1].totals, null);
  const failed = await loadWebsiteAnalytics(query, { now, sites: () => sites, read: async () => ({ ok: false, reason: "timeout" }) });
  assert.equal(failed.status, "unavailable"); assert.equal(failed.totals, null); assert.deepEqual(failed.daily, []);
  const lostPage = await loadWebsiteAnalytics({ ...query, page: 2 }, { now, sites: () => sites, read: async () => ({ ok: false, reason: "timeout" }) });
  assert.equal(lostPage.status, "unavailable"); assert.equal(lostPage.villas.page, 1);
  success.report.coverage.range_complete = false;
  assert.equal((await loadWebsiteAnalytics(query, { now, sites: () => [sites[0]], read: async () => success })).status, "partial");
});
test("zero data and pagination retain totals and checked arithmetic", async () => {
  const report = parseSourceReport(source(), sites[0], period);
  report.villas = Array.from({ length: 11 }, (_, i) => ({ ...emptyMetrics(), villa_id: String(i + 1) }));
  report.totals = emptyMetrics(); report.unattributed = emptyMetrics(); report.daily = [{ ...emptyMetrics(), date: period.from_date }];
  const deps = { now, sites: () => [sites[0]], read: async (): Promise<SiteReportResult> => ({ ok: true, report }) };
  assert.equal((await loadWebsiteAnalytics({ ...query, page: 2 }, deps)).villas.rows.length, 1);
  await assert.rejects(loadWebsiteAnalytics({ ...query, page: 3 }, deps), /invalid_query/);
  report.villas = [];
  assert.equal((await loadWebsiteAnalytics(query, deps)).status, "complete");
  report.totals.page_views = Number.MAX_SAFE_INTEGER;
  await assert.rejects(loadWebsiteAnalytics(query, { ...deps, sites: () => sites }), /invalid_report/);
});
