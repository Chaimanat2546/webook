import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { parseSourceReport } from "../server/site-analytics/report.ts";
import { sites, source, period } from "./fixtures/website-analytics.ts";
import { websiteAnalyticsHref, parseWebsiteAnalyticsQuery } from "../lib/website-analytics.ts";

async function view() {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../components/admin/dashboard/website-analytics/view.tsx", import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> }, require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  return loaded.exports.WebsiteAnalyticsView as ComponentType<Record<string, unknown>>;
}
test("website statistics render counts, accessible headings and safe site data", async () => {
  const query = { month: "2026-10", site: "all", page: 1 };
  const report = await loadWebsiteAnalytics(query, { now: () => new Date(period.as_of), sites: () => sites, read: async site => ({ ok: true, report: parseSourceReport(source(site), site, period) }) });
  const html = renderToStaticMarkup(createElement(await view(), { report, query, sites }));
  for (const label of ["ภาพรวมผลเว็บไซต์และบ้าน", "เข้าชม", "กดติดต่อรวม", "กดโทร", "LINE", "Messenger", "เปิดรูป", "กิจกรรมที่ไม่ระบุบ้าน", "รวมทั้งเว็บไซต์", "รายเดือน", "ครั้ง", "ไม่ใช่จำนวนคนไม่ซ้ำ"]) assert.ok(html.includes(label), label);
  assert.ok(!html.includes("nasapoolvilla.com")); assert.doesNotMatch(html, /ANALYTICS_REPORT_TOKEN/);
});
test("failed websites show missing data instead of a zero success", async () => {
  const query = { month: "2026-10", site: "all", page: 1 };
  const report = await loadWebsiteAnalytics(query, { now: () => new Date(period.as_of), sites: () => sites, read: async () => ({ ok: false, reason: "not_configured" }) });
  const html = renderToStaticMarkup(createElement(await view(), { report, query, sites }));
  assert.ok(html.includes("ยังไม่ได้ตั้งค่า")); assert.ok(html.includes("ยังโหลดสถิติไม่ได้"));
  assert.ok(!html.includes("ยังไม่มีเหตุการณ์ในช่วงนี้"));
});

test("overview shows five ranked houses and links to the complete paginated website list", async () => {
  const query = { month: "2026-10", site: sites[0].key, page: 1 };
  const data = parseSourceReport(source(), sites[0], period);
  data.villas = Array.from({ length: 12 }, (_, i) => ({ ...data.villas[0], villa_id: String(i + 1), contact_clicks: 12 - i }));
  const report = await loadWebsiteAnalytics(query, { now: () => new Date(period.as_of), sites: () => sites, titles: async ids => new Map(ids.map(id => [id, `House ${id}`])), read: async () => ({ ok: true, report: data }) });
  const View = await view();
  const overview = renderToStaticMarkup(createElement(View, { report, query, sites }));
  assert.ok(overview.includes("บ้านที่มีการกดติดต่อสูงสุด 5 อันดับ"));
  assert.ok(overview.includes("ดูทั้งหมด"));
  assert.ok(overview.includes("<details")); assert.ok(overview.includes("กดบ้านเพื่อดูช่องทางติดต่อ")); assert.ok(overview.includes("website-analytics-theme"));
  assert.ok(overview.includes("House 5")); assert.ok(!overview.includes("House 6"));
  assert.ok(!overview.includes("แบ่งหน้ารายการ"));
  assert.ok(!overview.includes("analytics-sort"));
  const href = websiteAnalyticsHref(query, { view: "houses" });
  assert.match(href, /view=houses/);
  const detailQuery = parseWebsiteAnalyticsQuery(Object.fromEntries(new URL(href, "https://example.test").searchParams), sites.map(site => site.key), new Date(period.as_of));
  assert.equal(detailQuery.view, "houses");
  const detail = renderToStaticMarkup(createElement(View, { report, query: detailQuery, sites }));
  assert.ok(detail.includes("สถิติบ้านทั้งหมด")); assert.ok(detail.includes("House 10"));
  assert.ok(detail.includes("แบ่งหน้ารายการ"));
  assert.ok(detail.includes("analytics-sort"));
  assert.ok(detail.includes("table-fixed"));
  assert.ok(detail.includes("md:hidden"));
  assert.ok(detail.includes("<article"));
  assert.ok(!detail.includes("data-slot=\"card\""));
  assert.ok(!detail.includes("แนวโน้มรายวัน"));
  assert.throws(() => parseWebsiteAnalyticsQuery({ view: "invalid" }, [], new Date(period.as_of)));
});


test("partial coverage stays in the report without displaying incomplete-period warnings", async () => {
  const query = { month: "2026-10", site: sites[0].key, page: 1, granularity: "month" as const };
  const data = parseSourceReport(source(), sites[0], period);
  data.coverage.range_complete = false;
  data.coverage.rows_complete = false;
  const report = await loadWebsiteAnalytics({ ...query, granularity: "day" }, { now: () => new Date(period.as_of), sites: () => sites, titles: async () => new Map(), read: async () => ({ ok: true, report: data }) });
  report.monthly = [{ date: "2026-10", page_views: 4, contact_clicks: 5, status: "partial" }];
  const html = renderToStaticMarkup(createElement(await view(), { report, query, sites }));
  assert.equal(report.status, "partial");
  assert.doesNotMatch(html, /ไม่ครบ|role="alert"/);
  assert.ok(html.includes("บ้านที่มีการกดติดต่อสูงสุด 5 อันดับ"));
});
