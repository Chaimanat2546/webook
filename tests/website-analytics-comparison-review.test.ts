import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

async function component(file: string, name: string) {
  const built = await build({ entryPoints: [`components/admin/dashboard/website-analytics/${file}.tsx`], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

test("prior-only website keeps its union color in overlay and total legends", async () => {
  const Comparison = await component("site-period-comparison", "SitePeriodComparison");
  const site = { key: "a", displayName: "A", origin: "https://a.test", status: "complete", coverage: { data_available_from: "2026-09-01T00:00:00Z", range_complete: true, rows_complete: true }, totals: emptyMetrics(), daily: [{ date: "2026-10-14", ...emptyMetrics() }] };
  for (const view of ["daily", "total"]) {
    const html = renderToStaticMarkup(createElement(Comparison, { granularity: "day", sites: [site], range: { from: "2026-10-14", to: "2026-10-15" }, asOf: "2026-10-16T04:00:00Z", previous: { granularity: "day", range: { from: "2026-10-12", to: "2026-10-13" }, sites: [{ ...site, key: "b", displayName: "B" }] }, view, metric: "page_views", hiddenSites: [], onToggleSite() {} }));
    assert.match(html, /stroke="var\(--chart-2\)"/, view);
  }
});

test("mixed data issues count only websites with the reason in the trigger", async () => {
  const Issues = await component("period-comparison-issues", "PeriodComparisonIssues");
  const series = { range: { from: "2026-10-14", to: "2026-10-15" }, granularity: "day", total: 0, availableDays: 2, expectedDays: 2, coverageComplete: true, status: "complete", daily: [] };
  const row = { current: series, previous: series, currentSelected: true, previousSelected: true };
  const html = renderToStaticMarkup(createElement(Issues, { rows: [
    { ...row, key: "a", displayName: "A", current: { ...series, total: null, status: "unavailable" } },
    { ...row, key: "b", displayName: "B", current: { ...series, status: "ongoing" } },
  ] }));
  assert.match(html, /โหลดไม่ได้ \(1 เว็บ\)/);
  assert.doesNotMatch(html, /โหลดไม่ได้ \(2 เว็บ\)/);
});
