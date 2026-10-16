import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

test("analytics popup renders hour fields for one day and commits dates with hours", async () => {
  interface PickerProbe {
    onChange?: (range: { from: Date; to: Date }) => void;
    canConfirm?: (range: { from: Date; to: Date }) => boolean;
  }
  const probe: PickerProbe = {};
  const built = await build({
    entryPoints: ["components/admin/dashboard/website-analytics/website-date-range-picker.tsx"],
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "open-calendar", setup(builder) {
      builder.onLoad({ filter: /[\\/]thai-date-range-picker\.tsx$/ }, () => ({ loader: "js", contents: `
        import React from "react";
        import probe from "picker-probe";
        export function ThaiDateRangePicker(props) {
          Object.assign(probe, props);
          return React.createElement("section", null, props.renderSelection(props.value));
        }` }));
      builder.onResolve({ filter: /^picker-probe$/ }, args => ({ path: args.path, external: true }));
    } }],
  });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => name === "picker-probe" ? probe : require(name), loaded, loaded.exports);
  const Picker = loaded.exports.WebsiteDateRangePicker as ComponentType<{ month: string; range: { from: string; to: string; timeFrom?: string; timeTo?: string }; onChange: (range: object) => void }>;
  let committed: object | undefined;
  const render = (from: string, to: string, hours = {}) => renderToStaticMarkup(createElement(Picker, { month: "2026-10", range: { from, to, ...hours }, onChange: range => { committed = range; } }));
  const single = render("2026-10-15", "2026-10-15", { timeFrom: "09:00", timeTo: "18:00" });
  assert.match(single, /role="switch"[^>]*aria-checked="true"/);
  assert.match(single, /เวลาเริ่ม/);
  assert.match(single, /เวลาสิ้นสุด/);
  assert.doesNotMatch(single, /ใช้เวลา/);
  const day = new Date("2026-10-14T00:00:00");
  probe.onChange?.({ from: day, to: day });
  assert.deepEqual(committed, { from: "2026-10-14", to: "2026-10-14", timeFrom: "09:00", timeTo: "18:00" });
  const multiple = render("2026-10-14", "2026-10-15");
  assert.doesNotMatch(multiple, /เวลาเริ่ม|เวลาสิ้นสุด/);
  assert.match(multiple, /ระบุช่วงเวลา/);
  assert.match(multiple, /role="switch"[^>]*aria-checked="false"/);
  assert.match(multiple, /เต็มวัน 24 ชั่วโมง/);
  probe.onChange?.({ from: day, to: new Date("2026-10-15T00:00:00") });
  assert.deepEqual(committed, { from: "2026-10-14", to: "2026-10-15", timeFrom: "00:00", timeTo: "24:00" });
  const wholeDay = render("2026-10-15", "2026-10-15");
  assert.doesNotMatch(wholeDay, /เวลาเริ่ม|เวลาสิ้นสุด/);
  assert.match(wholeDay, /เต็มวัน 24 ชั่วโมง/);
  const explicitWholeDay = render("2026-10-15", "2026-10-15", { timeFrom: "00:00", timeTo: "24:00" });
  assert.match(explicitWholeDay, /role="switch"[^>]*aria-checked="false"/);
  assert.doesNotMatch(explicitWholeDay, /เวลาเริ่ม|เวลาสิ้นสุด/);
  render("2026-10-15", "2026-10-15", { timeFrom: "18:00", timeTo: "09:00" });
  assert.equal(probe.canConfirm?.({ from: day, to: day }), false);
});

test("date trigger summarizes hours and keeps time controls inside the popup", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/summary-range-filter.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url);
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  const Filter = loaded.exports.SummaryRangeFilter as ComponentType<{ month: string; today: string; range: { from: string; to: string; timeFrom?: string; timeTo?: string } }>;
  const html = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-16", range: { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" } }));
  assert.match(html, /09:00–18:00/);
  assert.doesNotMatch(html, /เวลาเริ่ม|เวลาสิ้นสุด|ใช้เวลา/);
  const multiple = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-16", range: { from: "2026-10-14", to: "2026-10-15" } }));
  assert.doesNotMatch(multiple, /เวลาเริ่ม|ใช้เวลา/);
  const implicit = renderToStaticMarkup(createElement(Filter, { month: "2026-10", today: "2026-10-01", range: { from: "2026-10-01", to: "2026-10-01" } }));
  assert.doesNotMatch(implicit, /เวลาเริ่ม|ใช้เวลา/, "implicit first-day monthly report must not show hourly controls");
});
test("recurring time selection renders a daily graph and labels every-day hours", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-trend-chart.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Trend = loaded.exports.WebsiteSiteTrendChart as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Trend, { granularity: "day", sites: [], month: "2026-10", range: { from: "2026-10-14", to: "2026-10-16", timeFrom: "09:00", timeTo: "18:00" }, asOf: "2026-10-17T00:00:00Z", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.match(html, /กราฟแนวโน้มรายวันแต่ละเว็บไซต์/);
  assert.match(html, /ทุกวัน 09:00–18:00/);
  assert.doesNotMatch(html, /ครั้งต่อชั่วโมง/);
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
  const html = renderToStaticMarkup(createElement(Trend, { granularity: "hour", sites: [], month: "2026-10", range: { from: "2026-10-16", to: "2026-10-16", timeFrom: "18:00", timeTo: "24:00" }, asOf: "2026-10-16T04:00:00Z", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.ok(html.includes("ยังไม่ถึงช่วงเวลาที่เลือก"));
});
test("mixed hourly and daily comparison renders separate trends and explicit units", async () => {
  const built = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-period-comparison.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", built.outputFiles[0].text)(require, loaded, loaded.exports);
  const Comparison = loaded.exports.SitePeriodComparison as ComponentType<Record<string, unknown>>;
  const site = { key: "a", displayName: "A", origin: "https://a.test", status: "complete", coverage: { data_available_from: "2026-09-01T00:00:00Z", range_complete: true, rows_complete: true }, totals: emptyMetrics(), daily: [{ date: "2026-10-14", ...emptyMetrics() }], hourly: [] };
  const html = renderToStaticMarkup(createElement(Comparison, { granularity: "hour", sites: [site], range: { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00" }, asOf: "2026-10-16T04:00:00Z", previous: { granularity: "day", range: { from: "2026-10-13", to: "2026-10-14" }, sites: [site] }, view: "daily", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.match(html, /ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน/);
  assert.match(html, /กราฟแนวโน้มรายชั่วโมงแต่ละเว็บไซต์/);
  assert.match(html, /กราฟแนวโน้มรายวันแต่ละเว็บไซต์/);
  const differentWindows = renderToStaticMarkup(createElement(Comparison, { granularity: "day", sites: [site], range: { from: "2026-10-13", to: "2026-10-14", timeFrom: "09:00", timeTo: "18:00" }, asOf: "2026-10-16T04:00:00Z", previous: { granularity: "day", range: { from: "2026-10-13", to: "2026-10-14", timeFrom: "10:00", timeTo: "19:00" }, sites: [site] }, view: "daily", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.match(differentWindows, /ช่วงเวลารายวันต่างกัน · งด % ยอดรวม/);
  const hourlyWindows = renderToStaticMarkup(createElement(Comparison, { granularity: "hour", sites: [site], range: { from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "12:00" }, asOf: "2026-10-16T04:00:00Z", previous: { granularity: "hour", range: { from: "2026-10-14", to: "2026-10-14", timeFrom: "18:00", timeTo: "21:00" }, sites: [site] }, view: "daily", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.equal((hourlyWindows.match(/aria-label="กราฟแนวโน้มรายชั่วโมงแต่ละเว็บไซต์"/g) ?? []).length,0);
  assert.match(hourlyWindows,/ช่วงเวลารายวันต่างกัน · งด % ยอดรวม/);
  const severalReasons = renderToStaticMarkup(createElement(Comparison, { granularity: "day", sites: [site], range: { from: "2026-10-12", to: "2026-10-14", timeFrom: "09:00", timeTo: "18:00" }, asOf: "2026-10-16T04:00:00Z", previous: { granularity: "day", range: { from: "2026-10-01", to: "2026-10-07", timeFrom: "00:00", timeTo: "24:00" }, sites: [site] }, view: "daily", metric: "page_views", hiddenSites: [], onToggleSite() {} }));
  assert.match(severalReasons,/จำนวนวันต่างกัน/);
  assert.match(severalReasons,/ช่วงเวลารายวันต่างกัน/);
});
