import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

const require = createRequire(import.meta.url);
const requireWithNavigation = (name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name);

test("future month summary uses the shared illustrated empty state without querying analytics", async () => {
  const bundle = await build({
    entryPoints: ["components/admin/dashboard/website-analytics/site-summary-loader.tsx"],
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{
      name: "guard-external-analytics",
      setup(builder) {
        builder.onLoad({ filter: /server[\\/]site-analytics[\\/]registry\.tsx?$/ }, () => ({
          contents: 'export function listAnalyticsSites(){throw new Error("Future months must not access the site registry");}', loader: "js",
        }));
        builder.onLoad({ filter: /server[\\/]services[\\/]website-analytics-comparison\.tsx?$/ }, () => ({
          contents: 'export async function loadWebsiteSummaryPeriods(){throw new Error("Future months must not fetch analytics or access the site registry");}', loader: "js",
        }));
      },
    }],
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Loader = loaded.exports.WebsiteSiteSummaryLoader as (props: { month: string }) => Promise<ReactElement>;
  const html = renderToStaticMarkup(await Loader({ month: "9999-12" }));
  assert.match(html, /<h2>แนวโน้มประสิทธิภาพเว็บไซต์<\/h2>/);
  assert.match(html, /data-slot="empty"/);
  assert.match(html, /data-slot="empty-icon"/);
  assert.match(html, /ยังไม่มีข้อมูลสถิติ/);
  assert.match(html, /ยังไม่มีสถิติสำหรับเดือนในอนาคต/);
  assert.doesNotMatch(html, /data-slot="chart"|<table/);
});

test("website bar tooltip delegates positioning to Recharts instead of pinning to the chart corner", () => {
  const source = readFileSync(new URL("../components/admin/dashboard/website-analytics/site-summary-chart.tsx", import.meta.url), "utf8");
  const tooltip = source.match(/<ChartTooltip\s[^\n]+/u)?.[0];
  assert.ok(tooltip);
  assert.doesNotMatch(tooltip, /position=|portal=|wrapperStyle=/);
});

test("shared period control reports the selected period and disables both actions during loading", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/chart-period-toggle.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, loaded, loaded.exports);
  const Toggle = loaded.exports.ChartPeriodToggle as (props: { value: "day" | "month"; onChange: (period: "day" | "month") => void; disabled?: boolean }) => ReactElement<{ children: ReactElement<{ onClick: () => void }>[] }>;
  const selections: string[] = [];
  const element = Toggle({ value: "month", onChange: period => selections.push(period) });
  for (const button of element.props.children) button.props.onClick();
  assert.deepEqual(selections, ["day", "month"]);
  const html = renderToStaticMarkup(element);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  const disabled = renderToStaticMarkup(createElement(Toggle, { value: "day", onChange() {}, disabled: true }));
  assert.equal((disabled.match(/disabled=""/g) ?? []).length, 2);
});

test("website comparison shows all three metrics without period controls and preserves the shared empty state", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary-chart.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Chart = loaded.exports.WebsiteSiteSummaryChart as ComponentType<Record<string, unknown>>;
  const site = { key: "a", displayName: "เว็บ A", totals: emptyMetrics(), daily: [{ ...emptyMetrics(), date: "2026-10-01" }], coverage: null };
  const html = renderToStaticMarkup(createElement(Chart, { sites: [site], month: "2026-10" }));
  assert.ok(!html.includes("แนวโน้มประสิทธิภาพเว็บไซต์"));
  assert.ok(!html.includes('aria-label="เลือกสถิติกราฟ"'));
  assert.ok(!html.includes('aria-label="ช่วงกราฟ"'));
  assert.ok(!html.includes("รายวัน"));
  assert.ok(!html.includes("รายเดือน"));
  for (const label of ["เข้าชม", "กดติดต่อรวม", "เปิดรูป"]) assert.ok(html.includes(label));
  assert.match(html, /data-slot="chart"/);
  assert.ok(html.includes('aria-label="เลื่อนดูกราฟแท่งเว็บไซต์"'));
  const missing = renderToStaticMarkup(createElement(Chart, { sites: [{ ...site, totals: null }], month: "2026-10" }));
  assert.ok(missing.includes("ยังไม่มีข้อมูลสถิติ"));
  assert.ok(missing.includes("สถิติจากเว็บไซต์จะแสดงที่นี่เมื่อเชื่อมต่อสำเร็จ"));
  assert.match(missing, /data-slot="empty"/);
  assert.match(missing, /data-slot="empty-icon"/);
  assert.ok(!missing.includes('data-slot="chart"'));
});

async function siteSummarySkeleton() {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary-skeleton.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  return loaded.exports.WebsiteSiteSummarySkeleton as ComponentType<Record<string, unknown>>;
}

test("website summary preserves selected site/month and distinguishes failure from zero", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Component = loaded.exports.WebsiteSiteSummary as ComponentType<Record<string, unknown>>;
  const sites = ["partial", "unavailable", "not_configured"].map((status, index) => ({ key: `site${index}`, displayName: `Website ${index}`, origin: `https://site${index}.test`, status, coverage: null, daily: index === 0 ? [{ ...emptyMetrics(), date: "2026-10-01", page_views: 123 }] : undefined, totals: index === 0 ? { ...emptyMetrics(), page_views: 123 } : null }));
  sites[1].origin = "https://www.site1.test";
  const html = renderToStaticMarkup(createElement(Component, { sites, month: "2026-10" }));
  for (let index = 0; index < sites.length; index++) {
    assert.equal((html.match(new RegExp(`>www\\.site${index}\\.test<`, "g")) ?? []).length, 2, "desktop and mobile use a single www. prefix");
  }
  assert.doesNotMatch(html, /www\.www\./);
  assert.match(html, /<h2>แนวโน้มประสิทธิภาพเว็บไซต์<\/h2>/);
  assert.equal((html.match(/แนวโน้มประสิทธิภาพเว็บไซต์/g) ?? []).length, 1);
  assert.equal((html.match(/เปรียบเทียบจำนวนเข้าชม การกดติดต่อ และการเปิดรูป ของแต่ละเว็บไซต์/g) ?? []).length, 1);
  assert.ok(!html.includes("สถานะข้อมูลและผลรวมในเดือนที่เลือก"));
  assert.ok(!html.includes("<h2>แยกเว็บไซต์</h2>"));
  assert.ok(html.includes('aria-label="มุมมองกราฟเว็บไซต์"'));
  assert.match(html, /aria-pressed="true"[^>]*>แนวโน้มรายวัน/);
  assert.ok(html.includes('ยอดรวมแต่ละเว็บ'));
  assert.ok(html.includes('aria-label="เลือกสถิติรายวัน"'));
  assert.match(html, /aria-pressed="true"[^>]*>เข้าชม<\/button>/);
  assert.ok(html.includes('aria-label="กราฟแนวโน้มรายวันแต่ละเว็บไซต์"'));
  assert.ok(html.indexOf('กราฟแนวโน้มรายวันแต่ละเว็บไซต์') < html.indexOf('aria-label="สถิติแยกเว็บไซต์บนมือถือ"'));
  assert.ok(html.includes('ไม่แสดงเส้นของเว็บไซต์ที่ไม่มีข้อมูล: Website 1 · Website 2'));
  for (const value of ["โหลดสำเร็จ", "โหลดไม่ได้", "ยังไม่ได้ตั้งค่า", "123", "site0.test", "month=2026-10&amp;site=site0", "month=2026-10&amp;site=site1"]) assert.ok(html.includes(value), value);
  // Both responsive layouts preserve unavailable values rather than reporting zero.
  assert.equal((html.match(/—/g) ?? []).length, 24);
  assert.equal((html.match(/<details/g) ?? []).length, sites.length);
  assert.ok(html.includes('aria-label="สถิติแยกเว็บไซต์บนมือถือ"'));
  for (const site of sites) {
    assert.ok(html.includes(`ช่องทางติดต่อ<span class="sr-only"> ${site.displayName}</span>`));
  }
  assert.ok(!html.includes("ข้อมูลไม่ครบ"));
});

test("dashboard uses a shaped loading skeleton for the website summary", () => {
  const source = readFileSync(new URL("../app/admin/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(source, /fallback={<WebsiteSiteSummarySkeleton/);
});

test("range summary displays its dates and keeps cross-month detail links valid even with future dashboard context", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Component = loaded.exports.WebsiteSiteSummary as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Component, {
    sites: [{ key: "a", displayName: "A", origin: "https://a.test", status: "partial", totals: emptyMetrics(), coverage: null }],
    month: "2026-11", range: { from: "2026-09-25", to: "2026-10-05" }, today: "2026-10-14",
  }));
  assert.match(html, /2026-09-25 ถึง 2026-10-05/);
  assert.match(html, /aria-label="ช่วงวันที่สถิติเข้าเว็บไซต์"/);
  assert.doesNotMatch(html, />ใช้<|>ยกเลิก</);
  assert.match(html, /ข้อมูลไม่ครบช่วงวันที่/);
  assert.match(html, /month=2026-10&amp;site=a&amp;from=2026-09-25&amp;to=2026-10-05/);
});

test("custom range remains visible in mobile and full-list filters", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/filters.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Component = loaded.exports.WebsiteAnalyticsFilters as ComponentType<Record<string, unknown>>;
  for (const view of [undefined, "houses"]) {
    const html = renderToStaticMarkup(createElement(Component, {
      query: { month: "2026-10", site: "a", page: 1, from: "2026-09-25", to: "2026-10-05", view },
      sites: [{ key: "a", displayName: "A" }], maxMonth: "2026-10",
    }));
    assert.match(html, /<p class="text-xs text-muted-foreground">ช่วงวันที่: 2026-09-25 – 2026-10-05 · เวลาไทย<\/p>/);
  }
});

test("range confirmation actions live inside the calendar popup", async () => {
  const bundle = await build({
    entryPoints: ["components/admin/dashboard/website-analytics/summary-range-filter.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "expose-popup", setup(builder) {
      builder.onLoad({ filter: /components[\\/]ui[\\/]popover\.tsx$/ }, () => ({ loader: "tsx", contents: `
        import React from 'react';
        export const Popover = ({children}) => <>{children}</>;
        export const PopoverTrigger = ({children}) => <button>{children}</button>;
        export const PopoverContent = ({children}) => <section data-test-popup="">{children}</section>;
      ` }));
    } }],
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(requireWithNavigation, loaded, loaded.exports);
  const Component = loaded.exports.SummaryRangeFilter as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Component, { month: "2026-10", range: { from: "2026-10-01", to: "2026-10-14" }, today: "2026-10-14" }));
  const popup = html.match(/<section data-test-popup="">([\s\S]*)<\/section>/)?.[1] ?? "";
  assert.match(popup, />ใช้<\/button>/);
  assert.match(popup, />ยกเลิก<\/button>/);
  assert.equal((html.match(/>ใช้<\/button>/g) ?? []).length, 1);
});

test("website summary skeleton reserves the responsive eight-column table", async () => {
  const html = renderToStaticMarkup(createElement(await siteSummarySkeleton()));

  assert.match(html, /data-loading-section="analytics-loading-site-summary"/);
  assert.match(html, /role="status"/);
  assert.match(html, /กำลังโหลดสถิติแยกเว็บไซต์/);
  assert.match(html, /data-loading-site-summary-desktop/);
  assert.match(html, /data-loading-site-summary-chart/);
  assert.equal((html.match(/data-loading-site-summary-column/g) ?? []).length, 40);
});
