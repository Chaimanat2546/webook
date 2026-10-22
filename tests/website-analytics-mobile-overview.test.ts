import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../lib/website-analytics.ts";

async function render(report: WebsiteAnalyticsReport, mobile = true, changes: Partial<WebsiteAnalyticsQuery> = {}) {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/mobile-overview.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "mobile-fixture", setup(builder) {
    builder.onResolve({ filter: /hooks\/use-mobile$/ }, () => ({ path: "viewport-fixture", external: true }));
    builder.onResolve({ filter: /ui\/sidebar$/ }, () => ({ path: "sidebar-fixture", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> }, require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => {
    if (id === "viewport-fixture") return { useIsMobile: () => mobile };
    if (id === "sidebar-fixture") return { useSidebar: () => ({ setOpenMobile() {} }) };
    if (id === "next/navigation") return { useRouter: () => ({ push() {}, replace() {} }) };
    return require(id);
  }, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.WebsiteAnalyticsMobileOverview as ComponentType<Record<string, unknown>>, {
    report, query: { month: "2026-10", site: "a", page: 1, from: "2026-10-01", to: "2026-10-21", timeFrom: "09:00", timeTo: "18:00", ...changes },
    sites: [{ key: "a", displayName: "Baan Party Pattaya" }],
  }));
}

const totals = { ...emptyMetrics(), contact_clicks: 100, phone_clicks: 10, line_clicks: 70, chat_clicks: 20, page_views: 2400, gallery_opens: 600 };
const villas = Array.from({ length: 6 }, (_, index) => ({ ...totals, villa_id: String(index + 1), title: `House ${index + 1}`, siteKey: "a", siteName: "Baan Party Pattaya", contact_clicks: 20 - index }));
const report: WebsiteAnalyticsReport = {
  period: { contract_version: "1.2", granularity: "day", from_date: "2026-10-01", to_date: "2026-10-21", from_time: "09:00", to_time: "18:00", timezone: "Asia/Bangkok", as_of: "2026-10-22T02:00:00Z", villa_id: null },
  status: "complete", selectedSites: 1, availableSites: 1, totals, unattributed: emptyMetrics(), daily: [],
  websites: [{ key: "a", displayName: "Baan Party Pattaya", origin: "https://a.test", status: "complete", totals, coverage: null, daily: [], villas: { rows: villas, page: 1, total: 6 } }],
  villas: { rows: villas, page: 1, pageSize: 10, total: 6 },
};

test("mobile website overview uses contact summary, three metric tabs and five ranked houses", async () => {
  const html = await render(report);
  for (const label of ["ภาพรวมการติดต่อ", "แนวโน้มการติดต่อ", "บ้านที่มีการกดติดต่อสูงสุด", "ดูบ้านทั้งหมด", "WeBooks", "Baan Party Pattaya", "09:00–18:00", "เพิ่มชุดเปรียบเทียบ", "ดูช่องทางติดต่อ House 1"]) assert.ok(html.includes(label), label);
  assert.match(html, /aria-pressed="true"[^>]*>ติดต่อ</);
  assert.match(html, /House 5/);
  assert.doesNotMatch(html, /House 6|ข้อมูลไม่ครบ/);
  const link = html.match(/href="([^"]+)"[^>]*>ดูบ้านทั้งหมด/)?.[1];
  assert.ok(link);
  const url = new URL(link.replaceAll("&amp;", "&"), "https://app.test");
  assert.equal(url.searchParams.get("view"), "houses");
  assert.equal(url.searchParams.get("site"), "a");
  assert.equal(url.searchParams.get("from"), "2026-10-01");
  assert.equal(url.searchParams.get("timeFrom"), "09:00");
});

test("mobile website overview preserves missing data and is absent on desktop", async () => {
  const html = await render({ ...report, totals: null, status: "unavailable", availableSites: 0, websites: [{ ...report.websites[0], totals: null, status: "timeout", villas: undefined }] });
  assert.match(html, /—/);
  assert.match(html, /โหลดไม่ได้/);
  assert.doesNotMatch(html, /House 1|ดูบ้านทั้งหมด/);
  assert.equal(await render(report, false), "");
});

test("mobile monthly entry remains available and its advanced view does not duplicate the new summary", async () => {
  const monthlyReport: WebsiteAnalyticsReport = { ...report, period: { contract_version: "1.0", from_date: "2026-10-01", to_date: "2026-10-21", timezone: "Asia/Bangkok", as_of: report.period.as_of, villa_id: null } };
  const query = { from: undefined, to: undefined, timeFrom: undefined, timeTo: undefined };
  assert.match(await render(monthlyReport, true, query), /รายเดือน/);
  const advanced = await render(monthlyReport, true, { ...query, granularity: "month" });
  assert.match(advanced, /WeBooks/);
  assert.doesNotMatch(advanced, /ภาพรวมการติดต่อ|ดูบ้านทั้งหมด/);
});
