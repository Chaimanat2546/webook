import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics, type WebsiteSummary } from "../lib/website-analytics.ts";

test("aggregate mode is the third 32px control and keeps the original default", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary-graph.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Component = loaded.exports.WebsiteSiteSummaryGraph as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Component, { sites: [], month: "2026-10", range: { from: "2026-10-15", to: "2026-10-15" }, asOf: "2026-10-17T00:00:00Z", granularity: "hour" }));
  assert.match(html, /aria-pressed="true"[^>]*>แนวโน้มรายชั่วโมง/);
  assert.ok(html.indexOf("แนวโน้มรายชั่วโมง") < html.indexOf("ยอดรวมแต่ละเว็บ"));
  assert.ok(html.indexOf("ยอดรวมแต่ละเว็บ") < html.indexOf("แนวโน้มรวมทุกเว็บ"));
  assert.match(html, /<button[^>]*h-8[^>]*aria-pressed="false"[^>]*>แนวโน้มรวมทุกเว็บ/);
});

test("aggregate trends label partial sources, mixed units and unavailable data", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/all-sites-trend.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Component = loaded.exports.AllSitesTrend as ComponentType<Record<string, unknown>>;
  const range = { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "12:00" };
  const healthy: WebsiteSummary = { key: "a", displayName: "A", origin: "https://a.test", status: "complete", totals: emptyMetrics(), coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true }, daily: [{ date: range.from, ...emptyMetrics() }] };
  const failed: WebsiteSummary = { ...healthy, key: "b", status: "timeout", totals: null, coverage: null };
  const props = { sites: [healthy, failed], range, asOf: "2026-10-17T00:00:00Z", metric: "page_views", granularity: "day" };
  const html = renderToStaticMarkup(createElement(Component, { ...props, previous: { range, granularity: "hour", sites: [failed] } }));
  assert.match(html, /รวมเฉพาะเว็บที่มีข้อมูล.*1.*\/.*2.*เว็บ/);
  assert.match(html, /ช่วงที่เลือกใช้หน่วยเวลาต่างกัน/);
  assert.match(html, /ช่วงหลัก · ครั้งต่อวัน/);
  assert.match(html, /ชุดเทียบ · ครั้งต่อชั่วโมง/);
  const unavailable = renderToStaticMarkup(createElement(Component, { ...props, sites: [failed] }));
  assert.match(unavailable, /ไม่มีข้อมูลสำหรับแนวโน้มรวมทุกเว็บไซต์/);
});

test("coincident aggregate series use distinct colors and an outer comparison marker", async () => {
  const built = await build({
    entryPoints: ["components/admin/dashboard/website-analytics/site-period-trend-chart.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "inspect-line-presentation", setup(builder) {
      builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "line-probe" }));
      builder.onLoad({ filter: /.*/, namespace: "line-probe" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: `
        import React from 'react';
        export const ResponsiveContainer=({children})=>children;
        export const LineChart=({children})=>React.createElement('svg',null,children);
        export const CartesianGrid=()=>null, XAxis=()=>null, YAxis=()=>null, Tooltip=()=>null, Legend=()=>null;
        export const Line=p=>React.createElement('path',{'data-series':p.dataKey,stroke:p.stroke,strokeWidth:p.strokeWidth,strokeDasharray:p.strokeDasharray,'data-dot-radius':p.dot.r});
      ` }));
    } }],
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { aggregateWebsitePeriod } = await import("../lib/website-analytics-aggregate.ts");
  const range = { from: "2026-10-15", to: "2026-10-15" };
  const site: WebsiteSummary = { key: "a", displayName: "A", origin: "https://a.test", status: "complete", totals: { ...emptyMetrics(), page_views: 5 }, coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true }, daily: [{ date: range.from, ...emptyMetrics(), page_views: 5 }] };
  const series = aggregateWebsitePeriod([site], range, "2026-10-17T00:00:00Z", "page_views", "day");
  const Component = loaded.exports.SitePeriodTrendChart as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Component, { current: series, previous: series }));
  const lines = [...html.matchAll(/<path[^>]+>/g)].map(match => match[0]);
  assert.equal(lines.length, 2);
  assert.notEqual(lines[0].match(/stroke="([^"]+)"/)?.[1], lines[1].match(/stroke="([^"]+)"/)?.[1]);
  assert.match(lines[0], /data-series="previous"/);
  assert.match(lines[0], /stroke-dasharray="6 4"/);
  assert.ok(Number(lines[0].match(/data-dot-radius="([^"]+)"/)?.[1]) > Number(lines[1].match(/data-dot-radius="([^"]+)"/)?.[1]));
  const separatePrevious = renderToStaticMarkup(createElement(Component, { current: series, currentLabel: "ชุดเทียบ" }));
  assert.equal(separatePrevious.match(/<path[^>]+stroke="([^"]+)"/)?.[1], lines[0].match(/stroke="([^"]+)"/)?.[1]);
});

test("all ordinary website lines and legends are solid, only comparison lines are dashed", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-trend-chart.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "line-style-probe", setup(builder) {
    builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "line-style-probe" }));
    builder.onLoad({ filter: /.*/, namespace: "line-style-probe" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: `
      import React from 'react';
      export const ResponsiveContainer=({children})=>children;
      export const LineChart=({children})=>React.createElement('svg',null,children);
      export const CartesianGrid=()=>null, XAxis=()=>null, YAxis=()=>null, Tooltip=()=>null, Legend=()=>null;
      export const Line=p=>React.createElement('path',{'data-series':p.name,stroke:p.stroke,strokeDasharray:p.strokeDasharray});
    ` }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Component = loaded.exports.WebsiteSiteTrendChart as ComponentType<Record<string, unknown>>;
  const sites: WebsiteSummary[] = Array.from({ length: 5 }, (_, index) => ({ key: `site-${index}`, displayName: `Site ${index}`, origin: `https://site-${index}.test`, status: "complete", totals: { ...emptyMetrics(), page_views: index }, coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true }, daily: [{ date: "2026-10-14", ...emptyMetrics(), page_views: index }] }));
  const props = { sites, granularity: "day", month: "2026-10", range: { from: "2026-10-14", to: "2026-10-14" }, metric: "page_views", hiddenSites: [], onToggleSite() {} };
  const normal = renderToStaticMarkup(createElement(Component, props));
  assert.equal([...normal.matchAll(/<path[^>]+data-series=/g)].length, 5);
  assert.doesNotMatch(normal, /stroke-dasharray=/);
  const comparison = renderToStaticMarkup(createElement(Component, { ...props, comparison: true }));
  const curves = [...comparison.matchAll(/<path[^>]+>/g)].map(match => match[0]);
  assert.equal(curves.length, 5);
  assert.ok(curves.every(curve => curve.includes('stroke-dasharray="6 4"')));
});
