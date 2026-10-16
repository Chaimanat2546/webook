import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsPeriod, parseWebsiteAnalyticsQuery, websiteAnalyticsHref } from "../lib/website-analytics.ts";
import { parseWebsiteScope } from "../lib/website-analytics-scope.ts";
import { dashboardPeriodParams } from "../lib/dashboard-routes.ts";

const now = new Date("2026-10-16T04:00:00.000Z");
test("global business date changes retain the explicit analytics date and hours", () => {
  const previous = new URLSearchParams({ analyticsFrom: "2026-10-15", analyticsTo: "2026-10-15", analyticsTimeFrom: "09:00", analyticsTimeTo: "18:00", analyticsScope: '{"sites":["a"]}', unwanted: "ignored" });
  const next = dashboardPeriodParams({ month: "2026-09", dateFrom: "2026-09-01", dateTo: "2026-09-30" }, false, previous);
  assert.equal(next.get("analyticsTimeFrom"), "09:00");
  assert.equal(next.get("analyticsFrom"), "2026-10-15");
  assert.equal(next.get("unwanted"), null);
});
test("single day requests real hourly data and explicit times round trip", () => {
  const query = parseWebsiteAnalyticsQuery({ from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" }, ["a"], now);
  assert.equal(analyticsPeriod(query, now).contract_version, "1.1");
  assert.equal(new URL(websiteAnalyticsHref(query), "http://local").searchParams.get("timeFrom"), "09:00");
  assert.equal(analyticsPeriod(parseWebsiteAnalyticsQuery({ from: "2026-10-15", to: "2026-10-15" }, ["a"], now), now).contract_version, "1.1");
});
test("time changes reset pages but page changes preserve times", () => {
  const query = { month: "2026-10", from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00", site: "a", page: 3 };
  assert.equal(new URL(websiteAnalyticsHref(query, { timeFrom: "10:00" }), "http://local").searchParams.get("page"), null);
  assert.equal(new URL(websiteAnalyticsHref(query, { page: 4 }), "http://local").searchParams.get("timeTo"), "18:00");
  assert.equal(new URL(websiteAnalyticsHref(query, { month: "2026-09" }), "http://local").searchParams.get("timeFrom"), null);
  const next = new URL(websiteAnalyticsHref(query, { month: "2026-10", from: "2026-10-14", to: "2026-10-14" }), "http://local");
  assert.equal(next.searchParams.get("from"), "2026-10-14");
});
test("invalid or partial time filters are rejected while recurring ranges are accepted", () => {
  for (const extra of [{ timeFrom: "09:00" }, { timeFrom: "09:30", timeTo: "18:00" }, { timeFrom: "24:00", timeTo: "24:00" }, { timeFrom: "18:00", timeTo: "09:00" }]) {
    assert.throws(() => parseWebsiteAnalyticsQuery({ from: "2026-10-15", to: "2026-10-15", ...extra }, ["a"], now));
  }
  assert.equal(analyticsPeriod(parseWebsiteAnalyticsQuery({ from: "2026-10-14", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" }, ["a"], now), now).contract_version, "1.2");
  const scope = parseWebsiteScope(JSON.stringify({ sites: ["a"], comparison: { sites: ["a"], from: "2026-10-14", to: "2026-10-14", timeFrom: "10:00", timeTo: "24:00" } }), ["a"], now);
  assert.equal(scope?.comparison?.timeTo, "24:00");
});
