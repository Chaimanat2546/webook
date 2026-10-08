import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsPeriod, parseWebsiteAnalyticsQuery, websiteAnalyticsHref } from "../lib/website-analytics.ts";

const now = new Date("2026-09-30T17:00:00Z");
const keys = ["nasa", "pukmood"];
test("analytics query uses Bangkok month and one inclusive period", () => {
  const query = parseWebsiteAnalyticsQuery({}, keys, now);
  assert.deepEqual(query, { month: "2026-10", site: "all", page: 1 });
  assert.deepEqual(analyticsPeriod(query, now), { from_date: "2026-10-01", to_date: "2026-10-01", timezone: "Asia/Bangkok", as_of: now.toISOString(), contract_version: "1.0", villa_id: null });
  assert.equal(analyticsPeriod({ ...query, month: "2024-02" }, now).to_date, "2024-02-29");
});
test("analytics query rejects unknown, repeated, future and unsafe inputs", () => {
  for (const raw of [{ url: "https://evil.test" }, { token: "secret" }, { site: "wrong" }, { site: ["nasa", "pukmood"] }, { month: "2026-13" }, { month: "2026-11" }, { page: "0" }, { page: "-1" }, { page: "9007199254740992" }, { page: ["1", "2"] }]) {
    assert.throws(() => parseWebsiteAnalyticsQuery(raw, keys, now));
  }
});
test("filter changes reset pagination and preserve other filters", () => {
  const query = { month: "2026-09", site: "nasa", page: 2 };
  assert.equal(websiteAnalyticsHref(query, { month: "2026-10" }), "/admin/dashboard/websites?month=2026-10&site=nasa");
  assert.equal(websiteAnalyticsHref(query, { page: 3 }), "/admin/dashboard/websites?month=2026-09&site=nasa&page=3");
});

test("page selects one website by default and normalizes legacy all links", () => {
  for (const raw of [{}, { site: "all" }]) assert.equal(parseWebsiteAnalyticsQuery(raw, keys, now, { singleSite: true }).site, "nasa");
  assert.equal(parseWebsiteAnalyticsQuery({ site: "pukmood" }, keys, now, { singleSite: true }).site, "pukmood");
  assert.equal(parseWebsiteAnalyticsQuery({}, keys, now).site, "all", "aggregate API contract remains unchanged");
});
