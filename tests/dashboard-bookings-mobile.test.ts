import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardBooking, DashboardBookingsQuery } from "../lib/dashboard.ts";

async function component(file: string, name: string) {
  const bundle = await build({ entryPoints: [file], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => id === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(id), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

const query: DashboardBookingsQuery = { month: "2026-10", dateFrom: "2026-10-01", dateTo: "2026-10-21", timeFrom: "09:00", timeTo: "18:00", status: "confirmed", search: "Celuna", sort: "updated-desc", page: 2 };

test("mobile booking filters summarize the applied query without exposing agency choices", async () => {
  const Filters = await component("components/admin/dashboard/dashboard-booking-filters.tsx", "DashboardBookingFilters");
  const html = renderToStaticMarkup(createElement(Filters, { query, mobileRedesign: true }));
  assert.match(html, /ตัวกรองรายการจอง/);
  assert.match(html, /ตัวกรองที่ใช้/);
  assert.match(html, /09:00–18:00/);
  assert.match(html, /1–21 ต.ค. 2569/);
  assert.match(html, /จองล่าสุด/);
  assert.doesNotMatch(html, /เลือกเอเจนซี่/);
});

test("mobile booking list cards expose real amounts and keep owner agency data hidden", async () => {
  const Row = await component("components/admin/dashboard/dashboard-rows.tsx", "DashboardBookingRow");
  const booking: DashboardBooking = { id: "9", code: "BK9", propertyId: "9", houseTitle: "Celuna Pool Villa", status: "confirmed", priceCents: 690000, checkIn: "2026-10-04", checkOut: "2026-10-05", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", agency: { id: "private", name: "Private Agency" } };
  const html = renderToStaticMarkup(createElement(Row, { booking, href: "/admin/dashboard/bookings/9?month=2026-10", showAgency: false, presentation: "list-card" }));
  assert.match(html, /DV-9/);
  assert.match(html, /6,900\.00/);
  assert.match(html, /ยอดรวม/);
  assert.doesNotMatch(html, /Private Agency|เอเจนซี่/);
  const repair = renderToStaticMarkup(createElement(Row, { booking: { ...booking, status: "repair" }, href: "/admin/dashboard/bookings/9", showAgency: true, presentation: "list-card" }));
  assert.doesNotMatch(repair, /6,900\.00/);
});

test("mobile booking pager disables unavailable pages and retains period/search in page links", async () => {
  const Pager = await component("components/admin/dashboard/dashboard-list-primitives.tsx", "DashboardBookingMobilePager");
  assert.ok(Pager, "mobile pager is exported");
  const html = renderToStaticMarkup(createElement(Pager, { page: 1, pages: 2, href: (page: number) => `/admin/dashboard/bookings?month=2026-10&search=Celuna&page=${page}` }));
  assert.match(html, /disabled=""/);
  assert.match(html, /หน้า 1 จาก 2/);
  assert.match(html, /search=Celuna&amp;page=2/);
  assert.doesNotMatch(html, /page=0/);
});
