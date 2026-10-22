import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseDashboardQuery, type DashboardReport } from "../lib/dashboard.ts";
import { emptyMetrics } from "../lib/website-analytics.ts";

async function component(file: string, name: string) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", result.outputFiles[0].text)((id: string) => id === "next/navigation" ? { useRouter: () => ({ push() {}, replace() {} }) } : require(id), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

test("mobile overview links retain period and all-status access while owner navigation excludes admin sections", async () => {
  const View = await component("../components/admin/dashboard/dashboard-view.tsx", "DashboardView");
  const query = parseDashboardQuery({ dateFrom: "2026-09-10", dateTo: "2026-09-12", timeFrom: "09:00", timeTo: "17:00" });
  const report: DashboardReport = {
    scope: { kind: "owner", propertyId: "101" }, month: query.month, bookingCount: 3, waitingCount: 1,
    statusCounts: { confirmed: 1, waiting: 1, cancelled: 1, repair: 0, unknown: 0 },
    sales: { count: 1, amountCents: 690000, missingPrices: 0 },
    overview: { confirmedBookingsByDay: [], topAgencies: [], recentHouses: [], agencyCount: 0, newHouseCount: 0 },
    bookings: { rows: [], total: 0, page: 1, pages: 1 }, admin: null, detail: null,
  };
  const html = renderToStaticMarkup(createElement(View, { report, query }));
  const allBookings = html.match(/<a[^>]*aria-label="ดูการจองทั้งหมด"[^>]*>/)?.[0];
  assert.ok(allBookings);
  assert.match(allBookings, /dateFrom=2026-09-10/);
  assert.match(allBookings, /dateTo=2026-09-12/);
  assert.match(allBookings, /timeFrom=09%3A00/);
  assert.match(allBookings, /timeTo=17%3A00/);
  assert.match(allBookings, /status=all/);
  assert.match(html, />10–12 ก.ย. 2569<\//);
  assert.doesNotMatch(html, /<nav|href="#dashboard-/);
  assert.doesNotMatch(html, /WeBooks Pulse/);
});

test("mobile website rows retain detail filters without a full-table action", async () => {
  const Summary = await component("../components/admin/dashboard/website-analytics/site-summary.tsx", "WebsiteSiteSummary");
  const html = renderToStaticMarkup(createElement(Summary, {
    mobileOverview: true, sites: [{ key: "site-a", displayName: "Website A", origin: "https://a.test", status: "complete", coverage: null, totals: emptyMetrics(), daily: [] }], month: "2026-09", granularity: "day", compare: true,
    range: { from: "2026-09-10", to: "2026-09-12", timeFrom: "09:00", timeTo: "17:00" },
    scope: { sites: ["site-a"], comparison: { from: "2026-09-07", to: "2026-09-09", sites: ["site-a"] } },
  }));
  assert.doesNotMatch(html, /ดูตารางทั้งหมด/);
  const mobileList = html.match(/<ul[^>]*aria-label="สถิติแยกเว็บไซต์บนมือถือ"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
  const link = mobileList?.match(/href="([^"]+)"/)?.[1];
  assert.ok(link);
  const url = new URL(link.replaceAll("&amp;", "&"), "https://example.test");
  assert.equal(url.pathname, "/admin/dashboard/websites");
  assert.equal(url.searchParams.get("site"), "site-a");
  assert.equal(url.searchParams.get("from"), "2026-09-10");
  assert.equal(url.searchParams.get("to"), "2026-09-12");
  assert.equal(url.searchParams.get("timeFrom"), "09:00");
  assert.equal(url.searchParams.get("timeTo"), "17:00");
  assert.deepEqual(JSON.parse(url.searchParams.get("analyticsScope") ?? "null"), { sites: ["site-a"], comparison: { from: "2026-09-07", to: "2026-09-09", sites: ["site-a"] } });
});

test("compact mobile website rows hide partial badges but keep totals and load failures", async () => {
  const Summary = await component("../components/admin/dashboard/website-analytics/site-summary.tsx", "WebsiteSiteSummary");
  const html = renderToStaticMarkup(createElement(Summary, {
    mobileOverview: true, month: "2026-10", granularity: "day",
    sites: [
      { key: "a", displayName: "Website A", origin: "https://a.test", status: "partial", coverage: null, totals: { ...emptyMetrics(), page_views: 1240 }, daily: [] },
      { key: "b", displayName: "Website B", origin: "https://b.test", status: "timeout", coverage: null, totals: null, daily: [] },
    ],
  }));
  const mobileList = html.match(/<ul[^>]*aria-label="สถิติแยกเว็บไซต์บนมือถือ"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(mobileList);
  assert.doesNotMatch(mobileList, /ข้อมูลไม่ครบ/);
  assert.match(mobileList, /1,240/);
  assert.match(mobileList, /โหลดไม่ได้/);
});
