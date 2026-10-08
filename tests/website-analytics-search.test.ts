import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics, parseWebsiteAnalyticsQuery, websiteAnalyticsHref, type SourceReport } from "../lib/website-analytics.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { sites, period } from "./fixtures/website-analytics.ts";

test("search is validated and trimmed; links preserve sort and reset pagination", () => {
  assert.equal(parseWebsiteAnalyticsQuery({ search: "  บ้านทะเล  " }, [sites[0].key], new Date(period.as_of)).search, "บ้านทะเล");
  for (const search of [["a", "b"], "a".repeat(101)]) assert.throws(() => parseWebsiteAnalyticsQuery({ search }, [], new Date(period.as_of)));
  const href = websiteAnalyticsHref({ month: "2026-10", site: sites[0].key, page: 2, pages: { [sites[0].key]: 2 }, view: "houses", sort: "views" }, { search: "DV-12" });
  assert.match(href, /search=DV-12/); assert.match(href, /sort=views/); assert.doesNotMatch(href, /page/);
});

test("search finds titles beyond page one and exact numeric/DV codes without changing site totals", async () => {
  const report: SourceReport = { totals: { ...emptyMetrics(), page_views: 99 }, unattributed: emptyMetrics(), daily: [], coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true }, villas: Array.from({ length: 12 }, (_, i) => ({ ...emptyMetrics(), villa_id: String(i + 1) })) };
  const deps = { now: () => new Date(period.as_of), sites: () => [sites[0]], read: async () => ({ ok: true as const, report }), titles: async (ids: string[]) => new Map(ids.map(id => [id, id === "12" ? "บ้านทะเล Sea House" : "บ้านอื่น"])) };
  for (const search of ["ทะเล", "sea house", "12", "dv-12", "DV 12"]) {
    const result = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, search, sort: "views" }, deps);
    assert.deepEqual(result.websites[0].villas?.rows.map(villa => villa.villa_id), ["12"]);
    assert.equal(result.websites[0].villas?.total, 1); assert.equal(result.totals?.page_views, 99);
  }
  const missing = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, search: "ไม่พบแน่นอน" }, deps);
  assert.equal(missing.villas.total, 0);
  const unavailable = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, search: "ทะเล" }, { ...deps, titles: async () => { throw new Error("catalog failed"); } });
  assert.equal(unavailable.searchUnavailable, true);
});
