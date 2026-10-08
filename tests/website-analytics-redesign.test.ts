import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWebsiteAnalyticsQuery, websiteAnalyticsHref, emptyMetrics, type SourceReport } from "../lib/website-analytics.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { sites, period } from "./fixtures/website-analytics.ts";

test("monthly mode and independent website pages are allowlisted and reset with filters", () => {
  const query = parseWebsiteAnalyticsQuery({ granularity: "month", page_fluknasapoolvilla: "2" }, sites.map(s => s.key), new Date(period.as_of));
  assert.equal(query.granularity, "month");
  assert.equal(query.pages?.fluknasapoolvilla, 2);
  assert.equal(Object.getPrototypeOf(query.pages), Object.prototype, "query passed to React client components must use a plain object");
  assert.match(websiteAnalyticsHref(query), /page_fluknasapoolvilla=2/);
  assert.doesNotMatch(websiteAnalyticsHref(query, { month: "2026-09" }), /page_/);
  for (const raw of [{ granularity: "year" }, { page_unknown: "2" }, { page_fluknasapoolvilla: ["1", "2"] }]) assert.throws(() => parseWebsiteAnalyticsQuery(raw, sites.map(s => s.key), new Date(period.as_of)));
});

test("site tables keep full totals, unattributed activity and independent pages with house titles", async () => {
  const report: SourceReport = { totals: { ...emptyMetrics(), page_views: 20 }, unattributed: { ...emptyMetrics(), page_views: 8 }, daily: [], coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true }, villas: Array.from({ length: 12 }, (_, i) => ({ ...emptyMetrics(), villa_id: String(i + 1), page_views: 1 })) };
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, pages: { fluknasapoolvilla: 2 } }, { now: () => new Date(period.as_of), sites: () => sites, read: async () => ({ ok: true, report }), titles: async ids => new Map(ids.map(id => [id, `บ้าน ${id}`])) });
  assert.equal(result.websites[0].villas?.rows.length, 2);
  assert.equal(result.websites[1].villas?.rows.length, 10);
  assert.equal(result.websites[0].totals?.page_views, 20);
  assert.equal(result.websites[0].unattributed?.page_views, 8);
  assert.match(result.websites[0].villas!.rows[0].title!, /บ้าน/);
});

test("monthly history bounds requests and marks unavailable months without fabricated zeros", async () => {
  let active = 0, maximum = 0, calls = 0;
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, granularity: "month" }, { now: () => new Date(period.as_of), sites: () => sites, titles: async () => new Map(), read: async (_site, request) => {
    calls++; maximum = Math.max(maximum, ++active);
    assert.equal(request.as_of, period.as_of);
    assert.ok((Date.parse(request.to_date) - Date.parse(request.from_date)) / 86400000 < 92);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    if (request.from_date < "2026-10-01") return { ok: false, reason: "timeout" };
    return { ok: true, report: { totals: emptyMetrics(), unattributed: emptyMetrics(), villas: [], daily: [{ ...emptyMetrics(), date: "2026-10-01" }], coverage: { data_available_from: "2026-10-01T00:00:00+07:00", range_complete: true, rows_complete: true } } };
  } });
  assert.equal(calls, 6); assert.equal(maximum, 2);
  assert.equal(result.monthly?.length, 6);
  assert.equal(result.monthly?.[0].page_views, null);
  assert.equal(result.monthly?.[0].status, "unavailable");
  assert.equal(result.monthly?.[5].page_views, 0);
  assert.equal(result.monthly?.[5].status, "complete");
});

test("monthly buckets sum cross-range dates once and preserve retention boundaries", async () => {
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, granularity: "month" }, { now: () => new Date(period.as_of), sites: () => sites, titles: async () => new Map(), read: async (_site, request) => {
    const daily = [];
    for (let day = Date.parse(request.from_date); day <= Date.parse(request.to_date); day += 86400000) daily.push({ ...emptyMetrics(), date: new Date(day).toISOString().slice(0, 10), page_views: 1 });
    return { ok: true, report: { totals: emptyMetrics(), unattributed: emptyMetrics(), villas: [], daily, coverage: { data_available_from: "2026-05-15T00:00:00+07:00", range_complete: false, rows_complete: true } } };
  } });
  assert.deepEqual(result.monthly?.map(point => point.page_views), [62, 60, 62, 62, 60, 2]);
  assert.equal(result.monthly?.[0].status, "partial");
  assert.ok(result.monthly?.slice(1).every(point => point.status === "complete"));
});

test("catalog failure preserves metrics and missing-source per-site pagination clamps", async () => {
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, pages: { fluknasapoolvilla: 2 } }, { now: () => new Date(period.as_of), sites: () => sites, titles: async () => { throw new Error("catalog unavailable"); }, read: async () => ({ ok: true, report: { totals: { ...emptyMetrics(), page_views: 4 }, unattributed: emptyMetrics(), villas: [{ ...emptyMetrics(), villa_id: "9" }], daily: [], coverage: { data_available_from: "2026-10-01T01:00:00Z", range_complete: false, rows_complete: true } } }) });
  assert.equal(result.websites[0].villas?.page, 1);
  assert.equal(result.websites[0].villas?.rows[0].title, undefined);
  assert.equal(result.totals?.page_views, 8);
});

test("months entirely before collection began have null metrics rather than zero traffic", async () => {
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, granularity: "month" }, { now: () => new Date(period.as_of), sites: () => sites, read: async () => ({ ok: true, report: { totals: emptyMetrics(), unattributed: emptyMetrics(), villas: [], daily: [], coverage: { data_available_from: "2026-10-01T00:00:00+07:00", range_complete: false, rows_complete: true } } }) });
  assert.ok(result.monthly?.slice(0, 5).every(point => point.page_views === null && point.status === "no_data"));
  assert.equal(result.monthly?.[5].page_views, 0);
});
