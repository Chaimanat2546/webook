import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { build } from "esbuild";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DateRange } from "react-day-picker";
import { analyticsDateRange, analyticsPeriod, analyticsPeriodGranularity, emptyMetrics, type AnalyticsDateRange, type AnalyticsPeriod, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport, type WebsiteSummary } from "../lib/website-analytics.ts";
import type { WebsiteChartMetric } from "../lib/website-analytics-chart.ts";
import { parseWebsiteComparisonQuery, type WebsitePreviousPeriod } from "../lib/website-analytics-comparison.ts";
import type { WebsiteScopeSelection } from "../lib/website-analytics-scope.ts";
import { hourlyBounds } from "../lib/website-analytics-time.ts";

interface PickerProbe {
  label: string;
  value: DateRange;
  loading?: boolean;
  confirmSelection?: boolean;
  onChange: (range: DateRange) => void;
}

const now = new Date("2026-10-19T06:00:00Z");
const selections = {
  hourly: { from: "2026-10-16", to: "2026-10-16", timeFrom: "09:00", timeTo: "12:00" },
  recurring: { from: "2026-10-16", to: "2026-10-18", timeFrom: "09:00", timeTo: "12:00" },
  fullDay: { from: "2026-10-16", to: "2026-10-18" },
} satisfies Record<string, AnalyticsDateRange>;
const probe = { pickers: [] as PickerProbe[] };
const navigations: { href: string; options?: { scroll?: boolean } }[] = [];
let pending = false;
let selectedMetric: WebsiteChartMetric = "page_views";
let Detail: ComponentType<Record<string, unknown>>;
let View: ComponentType<Record<string, unknown>>;
let Provider: ComponentType<{ children?: ReactNode }>;

before(async () => {
  const built = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      export { WebsitePeriodDetailChart } from './components/admin/dashboard/website-analytics/website-period-detail-chart';
      export { WebsiteAnalyticsView } from './components/admin/dashboard/website-analytics/view';
      export { WebsiteAnalyticsLoadingProvider } from './components/admin/dashboard/website-analytics/analytics-loading';
    ` },
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "detail-ui-probes", setup(builder) {
      builder.onLoad({ filter: /[\\/]thai-date-range-picker\.tsx$/ }, () => ({ loader: "js", contents: `
        import React from 'react';
        import probe from 'detail-picker-probe';
        export function ThaiDateRangePicker(props) {
          probe.pickers.push(props);
          return React.createElement('button', {'aria-label':props.label,disabled:props.loading},props.valueSuffix);
        }
      ` }));
      builder.onResolve({ filter: /^detail-picker-probe$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "detail-chart-probe" }));
      builder.onLoad({ filter: /.*/, namespace: "detail-chart-probe" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: `
        import React from 'react';
        export const ResponsiveContainer=({children})=>children;
        export const LineChart=({children,data})=>React.createElement('div',{'data-detail-points':JSON.stringify(data)},children);
        export const AreaChart=LineChart, BarChart=LineChart;
        export const Line=({dataKey,hide,connectNulls,strokeDasharray})=>React.createElement('span',{'data-series':dataKey,'data-hidden':hide,'data-connect-nulls':connectNulls,'data-dash':strokeDasharray});
        export const Area=Line, Bar=Line;
        export const Cell=()=>null, CartesianGrid=()=>null, XAxis=()=>null, YAxis=()=>null, Tooltip=()=>null, Legend=()=>null;
      ` }));
    } }],
  });
  const require = createRequire(import.meta.url), react = require("react");
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => {
    if (name === "detail-picker-probe") return probe;
    if (name === "react") return { ...react, useTransition: () => [pending, (callback: () => void) => callback()], useState: (initial: unknown) => react.useState(initial === "page_views" ? selectedMetric : initial) };
    if (name === "next/navigation") return { useRouter: () => ({ push: (href: string, options?: { scroll?: boolean }) => navigations.push({ href, options }), replace: (href: string, options?: { scroll?: boolean }) => navigations.push({ href, options }) }) };
    return require(name);
  }, loaded, loaded.exports);
  Detail = loaded.exports.WebsitePeriodDetailChart as typeof Detail;
  View = loaded.exports.WebsiteAnalyticsView as typeof View;
  Provider = loaded.exports.WebsiteAnalyticsLoadingProvider as typeof Provider;
});

function fixture(range: AnalyticsDateRange): { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery; site: WebsiteSummary; period: AnalyticsPeriod } {
  const query: WebsiteAnalyticsQuery = { month: range.to.slice(0, 7), site: "a", page: 1, ...range };
  const period = analyticsPeriod(query, now);
  const hourly = period.contract_version === "1.1" ? hourlyBounds(range.from, { timeFrom: period.from_time, timeTo: period.to_time }, period.as_of).buckets.map((bounds, index) => ({ ...emptyMetrics(), ...bounds, page_views: index, gallery_opens: index + 1 })) : undefined;
  const daily = Array.from({ length: (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1 }, (_, index) => ({ ...emptyMetrics(), date: new Date(Date.parse(range.from) + index * 86400000).toISOString().slice(0, 10), page_views: index, gallery_opens: index + 1 }));
  const totals = (hourly ?? daily).reduce((total, point) => ({ ...total, page_views: total.page_views + point.page_views, gallery_opens: total.gallery_opens + point.gallery_opens }), emptyMetrics());
  const site: WebsiteSummary = { key: "a", displayName: "Website A", origin: "https://a.test", status: "complete", totals, daily, hourly, coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true } };
  const report: WebsiteAnalyticsReport = { period, websites: [site], status: "complete", selectedSites: 1, availableSites: 1, totals, daily, hourly, unattributed: emptyMetrics(), villas: { rows: [], total: 0, page: 1, pageSize: 10 } };
  return { report, query, site, period };
}

function render(range: AnalyticsDateRange, comparison?: AnalyticsDateRange, fullView = false) {
  probe.pickers = [];
  navigations.length = 0;
  const current = fixture(range), prior = comparison ? fixture(comparison) : undefined;
  const previous: WebsitePreviousPeriod | undefined = prior ? { range: analyticsDateRange(prior.period), granularity: analyticsPeriodGranularity(prior.period), sites: [prior.site] } : undefined;
  const scope: WebsiteScopeSelection = { sites: ["a"], ...(comparison ? { comparison: { ...comparison, sites: ["a"] } } : {}) };
  return renderToStaticMarkup(createElement(Provider, null, createElement(fullView ? View : Detail, { report: current.report, query: current.query, compare: Boolean(previous), previous, scope, sites: [{ key: "a", displayName: "Website A" }] })));
}

for (const [mode, range] of Object.entries(selections)) {
  test(`website detail ${mode} exposes shared primary and comparison controls with every metric`, () => {
    pending = false;
    selectedMetric = "page_views";
    const html = render(range, undefined, true);
    const header = html.match(/data-slot="card-header"[^>]*>([\s\S]*?)<div data-slot="card-content"/)?.[1] ?? "";
    assert.match(header, /ช่วงหลัก/);
    assert.match(header, /ช่วงวันที่รายงาน/);
    assert.match(header, /เพิ่มชุดเปรียบเทียบ/);
    assert.equal(probe.pickers.filter(picker => picker.label === "ช่วงวันที่รายงาน").length, 1, "primary picker is not duplicated outside the chart");
    assert.ok(probe.pickers.every(picker => picker.confirmSelection));
    for (const label of ["เข้าชม", "กดติดต่อรวม", "เปิดรูป"]) assert.match(html, new RegExp(`>${label}</button>`));
    assert.match(html, /data-connect-nulls="false"/);
    const selected = probe.pickers.find(picker => picker.label === "ช่วงวันที่รายงาน");
    assert.equal(selected?.value.from?.getDate(), 16);
    assert.equal(selected?.value.to?.getDate(), range.to === range.from ? 16 : 18);
    for (const metric of ["page_views", "contact_clicks", "gallery_opens"] as const) {
      selectedMetric = metric;
      const metricHtml = render(range);
      assert.match(metricHtml, /data-series="values.a"/);
      const points = JSON.parse(metricHtml.match(/data-detail-points="([^"]+)"/)![1].replaceAll("&quot;", '"')) as { values: { a: number | null } }[];
      const source = fixture(range);
      assert.equal(points.reduce((sum, point) => sum + (point.values.a ?? 0), 0), source.report.totals?.[metric]);
    }
    selectedMetric = "page_views";
  });

  test(`website detail ${mode} shares loading across dates, metrics and stale comparison content`, () => {
    pending = true;
    const html = render(range, { ...range, from: "2026-10-10", to: range.from === range.to ? "2026-10-10" : "2026-10-12" });
    assert.match(html, /data-loading-website-chart/);
    assert.match(html, /aria-hidden="true"[^>]*inert=""/);
    assert.ok(probe.pickers.every(picker => picker.loading));
    const controls = html.match(/aria-label="เลือกสถิติเปรียบเทียบเว็บไซต์"([\s\S]*?)<\/div>/)?.[1] ?? "";
    assert.equal((controls.match(/disabled=""/g) ?? []).length, 3);
    const hiddenContent = html.match(/aria-hidden="true"[^>]*inert=""[^>]*>([\s\S]*?)<div data-loading-website-chart/)?.[1] ?? "";
    assert.match(hiddenContent, /ชุดหลักเส้นทึบ ชุดเทียบเส้นประ/);
    pending = false;
    assert.doesNotMatch(render(range), /data-loading-website-chart|inert=""/);
  });
}

for (const [primaryMode, range] of Object.entries(selections)) {
  for (const [comparisonMode, comparison] of Object.entries(selections)) {
    test(`website detail compares ${primaryMode} with ${comparisonMode} using the shared unit layout`, () => {
      const html = render(range, comparison);
      const mixed = (primaryMode === "hourly") !== (comparisonMode === "hourly");
      assert.equal(html.includes("ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน"), mixed);
      assert.equal((html.match(/data-detail-points=/g) ?? []).length, mixed ? 2 : 1);
      assert.match(html, /ช่วงวันที่ชุดเปรียบเทียบ/);
      if (mixed) assert.doesNotMatch(html, /[+-]\d+\.\d%/);
      else assert.match(html, /data-dash="6 4"/);
    });
  }
}

test("detail date navigation commits independent hours, preserves comparison and resets paging", () => {
  const range = selections.hourly;
  const comparison = { ...selections.recurring, timeFrom: "13:00", timeTo: "17:00" };
  render(range, comparison);
  const primaryPicker = probe.pickers.find(picker => picker.label === "ช่วงวันที่รายงาน");
  assert.ok(primaryPicker);
  primaryPicker.onChange({ from: new Date("2026-10-12T00:00:00"), to: new Date("2026-10-14T00:00:00") });
  const primaryUrl = new URL(navigations[0].href, "https://example.test");
  const primary = parseWebsiteComparisonQuery(Object.fromEntries(primaryUrl.searchParams), ["a"], now);
  assert.equal(primary.query.timeFrom, "09:00");
  assert.equal(primary.query.timeTo, "12:00");
  assert.equal(primary.query.from, "2026-10-12");
  assert.equal(primary.query.to, "2026-10-14");
  assert.deepEqual(primary.scope?.comparison, { ...comparison, sites: ["a"] });
  assert.equal(primary.query.page, 1);
  assert.equal(navigations[0].options?.scroll, false);
  navigations.length = 0;
  probe.pickers.find(picker => picker.label === "ช่วงวันที่ชุดเปรียบเทียบ")!.onChange({ from: new Date("2026-10-15T00:00:00"), to: new Date("2026-10-15T00:00:00") });
  const compareUrl = new URL(navigations[0].href, "https://example.test");
  const compared = parseWebsiteComparisonQuery(Object.fromEntries(compareUrl.searchParams), ["a"], now);
  assert.equal(compared.query.timeFrom, range.timeFrom);
  assert.equal(compared.query.timeTo, range.timeTo);
  assert.deepEqual(compared.scope?.comparison, { from: "2026-10-15", to: "2026-10-15", timeFrom: "13:00", timeTo: "17:00", sites: ["a"] });
});

test("single full day renders all 24 hourly buckets including the final 23:00 hour", () => {
  const html = render({ from: "2026-10-16", to: "2026-10-16", timeFrom: "00:00", timeTo: "24:00" });
  const points = JSON.parse(html.match(/data-detail-points="([^"]+)"/)![1].replaceAll("&quot;", '"')) as { date: string }[];
  assert.equal(points.length, 24);
  assert.equal(points[23].date, "2026-10-16T16:00:00.000Z");
  assert.match(html, /เต็มวัน 24 ชั่วโมง/);
});

test("editing primary dates freezes a legacy comparison and clears stale pagination", () => {
  const current = fixture(selections.hourly), prior = fixture({ ...selections.hourly, from: "2026-10-15", to: "2026-10-15" });
  probe.pickers = [];
  navigations.length = 0;
  renderToStaticMarkup(createElement(Provider, null, createElement(Detail, {
    report: current.report, query: { ...current.query, page: 4, pages: { a: 4 } }, compare: true,
    previous: { granularity: "hour", range: analyticsDateRange(prior.period), sites: [prior.site] },
  })));
  const primaryPicker = probe.pickers.find(picker => picker.label === "ช่วงวันที่รายงาน");
  assert.ok(primaryPicker);
  primaryPicker.onChange({ from: new Date("2026-10-11T00:00:00"), to: new Date("2026-10-12T00:00:00") });
  const url = new URL(navigations[0].href, "https://example.test");
  const parsed = parseWebsiteComparisonQuery(Object.fromEntries(url.searchParams), ["a"], now);
  assert.deepEqual(parsed.scope?.comparison, { ...analyticsDateRange(prior.period), sites: ["a"] });
  assert.equal(parsed.query.page, 1);
  assert.equal(parsed.query.pages, undefined);
  assert.equal(url.searchParams.has("analyticsCompare"), false);
});
