import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

test("single-day filter exposes start and end hours but multi-day filter does not", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/summary-range-filter.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url);
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  const Filter = loaded.exports.SummaryRangeFilter as ComponentType<{ month: string; today: string; range: { from: string; to: string; timeFrom?: string; timeTo?: string } }>;
  const html = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-16", range: { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" } }));
  assert.match(html, /เวลาเริ่ม/);
  assert.match(html, /เวลาสิ้นสุด/);
  assert.match(html, /ใช้เวลา/);
  const multiple = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-16", range: { from: "2026-10-14", to: "2026-10-15" } }));
  assert.doesNotMatch(multiple, /เวลาเริ่ม|ใช้เวลา/);
  const implicit = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-01", range: { from: "2026-10-01", to: "2026-10-01" } }));
  assert.doesNotMatch(implicit, /เวลาเริ่ม|ใช้เวลา/, "implicit first-day monthly report must not show hourly controls");
});
test("completed comparison with different units reports the unit mismatch", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/period-comparison-summary.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Summary = loaded.exports.PeriodComparisonSummary as ComponentType<Record<string, unknown>>;
  const base = { range: { from: "2026-10-13", to: "2026-10-14" }, total: 0, availableDays: 2, expectedDays: 2, coverageComplete: true, status: "complete", daily: [] };
  const html = renderToStaticMarkup(createElement(Summary, { current: { ...base, granularity: "hour", durationMinutes: 120 }, previous: base }));
  assert.ok(html.includes("หน่วยเวลาต่างกัน"));
  assert.ok(!html.includes("ยังไม่จบช่วงเวลา"));
});
test("future hourly range is described as not reached rather than observed zero", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-trend-chart.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Trend = loaded.exports.WebsiteSiteTrendChart as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Trend, { sites: [], month: "2026-10", range: { from: "2026-10-16", to: "2026-10-16", timeFrom: "18:00", timeTo: "24:00" }, asOf: "2026-10-16T04:00:00Z", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.ok(html.includes("ยังไม่ถึงช่วงเวลาที่เลือก"));
});
test("mixed hourly and daily comparison renders separate trends and explicit units", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-period-comparison.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Comparison = loaded.exports.SitePeriodComparison as ComponentType<Record<string, unknown>>;
  const site = { key: "a", displayName: "A", origin: "https://a.test", status: "complete", coverage: { data_available_from: "2026-09-01T00:00:00Z", range_complete: true, rows_complete: true }, totals: emptyMetrics(), daily: [{ date: "2026-10-14", ...emptyMetrics() }], hourly: [] };
  const html = renderToStaticMarkup(createElement(Comparison, { sites: [site], range: { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" }, asOf: "2026-10-16T04:00:00Z", previous: { range: { from: "2026-10-13", to: "2026-10-14" }, sites: [site] }, view: "daily", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.match(html, /ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน/);
  assert.match(html, /กราฟแนวโน้มรายชั่วโมงแต่ละเว็บไซต์/);
  assert.match(html, /กราฟแนวโน้มรายวันแต่ละเว็บไซต์/);
});
