import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics, parseWebsiteAnalyticsQuery, websiteAnalyticsHref, type SourceReport } from "../lib/website-analytics.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { sites, period } from "./fixtures/website-analytics.ts";

test("sort values are allowlisted and changing sort resets pagination but preserves filters", () => {
  for (const sort of ["contacts", "gallery", "views", "name", "code"]) assert.equal(parseWebsiteAnalyticsQuery({ sort }, [sites[0].key], new Date(period.as_of)).sort, sort);
  for (const sort of ["unknown", ["name", "code"]]) assert.throws(() => parseWebsiteAnalyticsQuery({ sort }, [], new Date(period.as_of)));
  const href = websiteAnalyticsHref({ month: "2026-10", site: sites[0].key, page: 3, view: "houses", pages: { [sites[0].key]: 2 } }, { sort: "name" });
  assert.match(href, /view=houses/); assert.match(href, /sort=name/); assert.doesNotMatch(href, /page/);
});

test("all five sorts operate before pagination, use numeric codes and leave totals unchanged", async () => {
  const report: SourceReport = { totals: { ...emptyMetrics(), page_views: 99 }, unattributed: emptyMetrics(), daily: [], coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true }, villas: Array.from({ length: 12 }, (_, i) => ({ ...emptyMetrics(), villa_id: String(i + 1), contact_clicks: i === 10 ? 20 : 0, gallery_opens: i === 11 ? 20 : 0, page_views: i === 9 ? 20 : 0 })) };
  let requested: string[] = [];
  const deps = { now: () => new Date(period.as_of), sites: () => [sites[0]], read: async () => ({ ok: true as const, report }), titles: async (ids: string[]) => { requested = ids; return new Map(ids.map(id => [id, id === "12" ? "กานต์" : "ฮาน่า " + id])); } };
  for (const [sort, first] of [["contacts", "11"], ["gallery", "12"], ["views", "10"], ["name", "12"], ["code", "1"]] as const) {
    const result = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, sort }, deps);
    assert.equal(result.websites[0].villas?.rows[0].villa_id, first);
    assert.equal(result.totals?.page_views, 99);
    if (sort === "name") assert.equal(requested.length, 12, "name sorting requires titles outside the first page");
  }
  const second = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, sort: "code", pages: { [sites[0].key]: 2 } }, deps);
  assert.deepEqual(second.websites[0].villas?.rows.map(row => row.villa_id), ["11", "12"]);
  const fallback = await loadWebsiteAnalytics({ month: "2026-10", site: sites[0].key, page: 1, sort: "name" }, { ...deps, titles: async () => { throw new Error("catalog unavailable"); } });
  assert.equal(fallback.nameSortUnavailable, true);
  assert.equal(fallback.websites[0].villas?.rows[0].villa_id, "1");
});
