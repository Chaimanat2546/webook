import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { analyticsDateRange, analyticsPeriodGranularity, emptyMetrics, parseWebsiteAnalyticsQuery, type AnalyticsDateRange, type WebsiteSummary } from "../lib/website-analytics.ts";
import { websiteChartData, websiteComparisonData } from "../lib/website-analytics-chart.ts";
import { websitePeriodSeries } from "../lib/website-analytics-comparison.ts";
import { aggregateWebsitePeriod } from "../lib/website-analytics-aggregate.ts";
import { hourlyBounds } from "../lib/website-analytics-time.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";

const require = createRequire(import.meta.url);
const range = { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "12:00" };
const site: WebsiteSummary = {
  key: "a", displayName: "A", origin: "https://a.test", status: "complete",
  totals: { ...emptyMetrics(), page_views: 5 },
  coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true },
  hourly: [2, 3, 0].map((page_views, index) => ({ ...emptyMetrics(), page_views, start: `2026-10-15T0${index + 2}:00:00.000Z`, end: `2026-10-15T0${index + 3}:00:00.000Z` })),
};

test("individual, comparison and combined hourly charts share the snapshot cutoff", () => {
  const asOf = "2026-10-15T03:30:00.000Z";
  const expected = [2, 3, null];
  assert.deepEqual(websiteChartData([site], "2026-10", "page_views", "hour", range, asOf).map(point => point.values.a), expected);
  assert.deepEqual(websitePeriodSeries(site, range, asOf, "page_views", "hour").daily.map(point => point.value), expected);
  assert.deepEqual(aggregateWebsitePeriod([site], range, asOf, "page_views", "hour").daily.map(point => point.value), expected);
  const before = "2026-10-15T02:00:00.000Z";
  assert.deepEqual(websiteChartData([site], "2026-10", "page_views", "hour", range, before).map(point => point.values.a), [null, null, null]);
});

test("legacy full-day charts keep future days null at the shared snapshot", () => {
  const selected = { from: "2026-10-14", to: "2026-10-16" };
  const source = { ...site, daily: ["2026-10-14", "2026-10-15", "2026-10-16"].map(date => ({ ...emptyMetrics(), date })) };
  const asOf = "2026-10-14T17:00:00.000Z";
  assert.deepEqual(websiteChartData([source], "2026-10", "page_views", "day", selected, asOf).map(point => point.values.a), [0, null, null]);
  assert.deepEqual(websitePeriodSeries(source, selected, asOf, "page_views", "day").daily.map(point => point.value), [0, null, null]);
  assert.deepEqual(aggregateWebsitePeriod([source], selected, asOf, "page_views", "day").daily.map(point => point.value), [0, null, null]);
});

test("trend, totals and period legends label hourly, recurring and full-day selections consistently", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-trend-chart.tsx", "components/admin/dashboard/website-analytics/site-summary-chart.tsx", "components/admin/dashboard/website-analytics/period-comparison-summary.tsx"], outdir: "unused", bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const modules = built.outputFiles.map(output => {
    const loaded = { exports: {} as Record<string, unknown> };
    new Function("require", "module", "exports", output.text)(require, loaded, loaded.exports);
    return loaded.exports;
  });
  const Trend = modules[0].WebsiteSiteTrendChart as ComponentType<Record<string, unknown>>;
  const Totals = modules[1].WebsiteSiteSummaryChart as ComponentType<Record<string, unknown>>;
  const shortRange = modules[2].shortRange as (selected: AnalyticsDateRange) => string;
  const selections: AnalyticsDateRange[] = [
    range,
    { ...range, to: "2026-10-16" },
    { ...range, timeFrom: "00:00", timeTo: "24:00" },
    { from: range.from, to: "2026-10-16" },
  ];
  for (const selected of selections) {
    const label = !selected.timeFrom || selected.timeFrom === "00:00" && selected.timeTo === "24:00" ? "เต็มวัน 24 ชั่วโมง" : `${selected.from === selected.to ? "" : "ทุกวัน "}09:00–12:00`;
    const props = { sites: [], month: "2026-10", range: selected, granularity: selected.from === selected.to ? "hour" : "day", metric: "page_views", hiddenSites: [], onToggleSite() {} };
    assert.ok(renderToStaticMarkup(createElement(Trend, props)).includes(label));
    assert.ok(renderToStaticMarkup(createElement(Totals, props)).includes(label));
    assert.ok(shortRange(selected).includes(label));
  }
});

test("website details use the shared daily axis without bridging missing reports", async () => {
  const built = await build({
    entryPoints: ["components/admin/dashboard/website-analytics/website-period-detail-chart.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "inspect-daily-data", setup(builder) {
      builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "daily-probe" }));
      builder.onLoad({ filter: /.*/, namespace: "daily-probe" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: `
        import React from 'react';
        export const ResponsiveContainer=({children})=>children;
        export const AreaChart=({children,data})=>React.createElement('div',{'data-points':data.map(point=>point.date+':'+String(point.page_views)).join(',')},children);
        export const LineChart=AreaChart, BarChart=AreaChart;
        export const Area=()=>null, Line=()=>null, Bar=()=>null, Cell=()=>null, CartesianGrid=()=>null, XAxis=()=>null, YAxis=()=>null, Tooltip=()=>null, Legend=()=>null;
      ` }));
    } }],
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  const Detail = loaded.exports.WebsitePeriodDetailChart as ComponentType<Record<string, unknown>>;
  const daily = ["2026-10-14", "2026-10-16"].map(date => ({ ...emptyMetrics(), date }));
  const report = { period: { contract_version: "1.0", from_date: "2026-10-14", to_date: "2026-10-16", timezone: "Asia/Bangkok", as_of: "2026-10-17T00:00:00Z", villa_id: null }, daily, totals: emptyMetrics(), websites: [{ ...site, totals: emptyMetrics(), daily }] };
  const html = renderToStaticMarkup(createElement(Detail, { report, query: { month: "2026-10", site: "a", page: 1 }, compare: false }));
  assert.ok(html.includes('data-points="2026-10-14:0,2026-10-15:null,2026-10-16:0"'));
  assert.match(html, /เต็มวัน 24 ชั่วโมง/);
});

test("all chart views consume the same API totals and buckets for every time selection", async () => {
  const now = new Date("2026-10-17T00:00:00Z");
  const selections: AnalyticsDateRange[] = [
    { from: range.from, to: range.to },
    range,
    { ...range, to: "2026-10-16" },
    { ...range, to: "2026-10-16", timeFrom: "00:00", timeTo: "24:00" },
  ];
  for (const selection of selections) {
    let calls = 0;
    const query = parseWebsiteAnalyticsQuery({ ...selection, site: "a" }, [site.key], now);
    const report = await loadWebsiteAnalytics(query, {
      now: () => now, sites: () => [{ key: site.key, siteId: "fixture", displayName: site.displayName, origin: site.origin }],
      read: async (_site, period) => {
        calls++;
        assert.equal(period.contract_version, selection.from === selection.to ? "1.1" : "1.2");
        assert.equal(period.from_time, selection.timeFrom ?? "00:00");
        assert.equal(period.to_time, selection.timeTo ?? "24:00");
        const hourly = period.contract_version === "1.1" ? hourlyBounds(period.from_date, { timeFrom: period.from_time, timeTo: period.to_time }, period.as_of).buckets.map(bounds => ({ ...emptyMetrics(), ...bounds, page_views: 2, gallery_opens: 1 })) : undefined;
        const daily = Array.from({ length: (Date.parse(period.to_date) - Date.parse(period.from_date)) / 86400000 + 1 }, (_, index) => ({ ...emptyMetrics(), date: new Date(Date.parse(period.from_date) + index * 86400000).toISOString().slice(0, 10), page_views: hourly ? hourly.length * 2 : 7, gallery_opens: hourly ? hourly.length : 3 }));
        const totals = { ...emptyMetrics(), page_views: daily.reduce((sum, point) => sum + point.page_views, 0), gallery_opens: daily.reduce((sum, point) => sum + point.gallery_opens, 0) };
        return { ok: true, report: { totals, unattributed: totals, daily, hourly, villas: [], coverage: site.coverage! } };
      },
    });
    const selected = analyticsDateRange(report.period);
    const granularity = analyticsPeriodGranularity(report.period);
    for (const metric of ["page_views", "contact_clicks", "gallery_opens"] as const) {
      const expected = report.totals?.[metric];
      const points = websiteChartData(report.websites, query.month, metric, granularity, selected, report.period.as_of);
      assert.equal(points.reduce((sum, point) => sum + (point.values.a ?? 0), 0), expected);
      assert.equal(websiteComparisonData(report.websites)[0][metric], expected);
      assert.equal(websitePeriodSeries(report.websites[0], selected, report.period.as_of, metric, granularity).total, expected);
      const combined = aggregateWebsitePeriod(report.websites, selected, report.period.as_of, metric, granularity);
      assert.deepEqual(combined.daily.map(point => point.value), points.map(point => point.values.a));
      assert.equal(combined.total, expected);
    }
    assert.equal(calls, 1);
  }
});
