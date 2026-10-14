import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsPeriod, parseWebsiteAnalyticsQuery, websiteAnalyticsHref } from "../lib/website-analytics.ts";
import { emptyMetrics } from "../lib/website-analytics.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";

const now = new Date("2026-10-14T03:00:00Z");
const raw = { month: "2026-10", from: "2026-09-25", to: "2026-10-05" };

test("custom range includes both endpoints across months and survives detail links", () => {
  const query = parseWebsiteAnalyticsQuery(raw, [], now);
  const period = analyticsPeriod(query, now);
  assert.equal(period.from_date, "2026-09-25");
  assert.equal(period.to_date, "2026-10-05");
  assert.equal(period.timezone, "Asia/Bangkok");
  const url = new URL(websiteAnalyticsHref(query, { site: "example" }), "https://example.test");
  assert.equal(url.searchParams.get("from"), "2026-09-25");
  assert.equal(url.searchParams.get("to"), "2026-10-05");
  assert.equal(url.searchParams.get("month"), "2026-10");
  const reset = new URL(websiteAnalyticsHref(query, { month: "2026-09" }), "https://example.test");
  assert.equal(reset.searchParams.has("from"), false);
});

test("range validation rejects incomplete, reversed, impossible and future dates", () => {
  for (const change of [
    { to: undefined }, { from: undefined }, { from: ["2026-09-25"] },
    { from: "2026-10-06" }, { from: "2026-02-30" }, { to: "2026-10-15" },
  ]) assert.throws(() => parseWebsiteAnalyticsQuery({ ...raw, ...change }, [], now));
});

test("single day and leap day ranges use Bangkok today's boundary", () => {
  const query = parseWebsiteAnalyticsQuery({ month: "2024-02", from: "2024-02-29", to: "2024-02-29" }, [], now);
  assert.equal(analyticsPeriod(query, now).from_date, "2024-02-29");
  const bangkokNow = new Date("2026-10-13T17:00:00Z");
  const today = parseWebsiteAnalyticsQuery({ ...raw, from: "2026-10-14", to: "2026-10-14" }, [], bangkokNow);
  assert.equal(analyticsPeriod(today, bangkokNow).to_date, "2026-10-14");
});

test("long ranges split upstream requests without losing or double counting boundary days", async () => {
  const requests: string[][] = [];
  const result = await loadWebsiteAnalytics({ month: "2026-10", site: "all", page: 1, from: "2026-01-01", to: "2026-04-01" }, {
    now: () => now, sites: () => [{ key: "a", siteId: "a", displayName: "A", origin: "https://a.test" }],
    titles: async () => new Map(),
    read: async (_site, period) => {
      requests.push([period.from_date, period.to_date]);
      const metrics = { ...emptyMetrics(), page_views: 2 };
      return { ok: true, report: { totals: metrics, unattributed: emptyMetrics(), daily: [{ ...metrics, date: period.from_date }], villas: [{ ...metrics, villa_id: "1" }], coverage: { data_available_from: "2026-01-01T00:00:00+07:00", range_complete: true, rows_complete: true } } };
    },
  });
  assert.deepEqual(requests, [["2026-01-01", "2026-03-31"], ["2026-04-01", "2026-04-01"]]);
  assert.equal(result.totals?.page_views, 4);
  assert.equal(result.villas.rows[0].page_views, 4);
});
