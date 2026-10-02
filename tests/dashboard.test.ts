import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardAgencyChartLabel, dashboardScope, parseDashboardQuery, type DashboardBookingSource, type DashboardHouse, type DashboardScope } from "../lib/dashboard.ts";
import { safeHouseReturnTo } from "../lib/admin-return-to.ts";
import { parseThaiMonth, thaiMonthValue } from "../lib/thai-month.ts";
import { createDashboardRepository, type DashboardRepository } from "../server/repositories/dashboard.ts";
import { DashboardForbidden, loadDashboard, loadDashboardAgency, loadDashboardBookings } from "../server/services/dashboard.ts";
import { parseDashboardAgencyDetailQuery, parseDashboardBookingsQuery } from "../lib/dashboard-routes.ts";

const booking: DashboardBookingSource = {
  id: "1", code: "BK1", propertyId: "101", houseTitle: "House A", checkIn: "2026-11-01", checkOut: "2026-11-03",
  createdAt: "2026-09-10T00:00:00Z", status: "confirmed", priceCents: 123450, agentId: "agency-a", agentName: "Agency A",
};

test("booking loader accepts only the booking route contract", async () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", agency: "agency-a" });
  const report = await loadDashboardBookings(repository({ kind: "admin" }), "signed-in-user", query);
  assert.equal(report.bookings.total, 1);
  assert.deepEqual(report.bookings.rows[0].agency, { id: "agency-a", name: "Agency A" });
});

async function dashboardComponent(name: string, file: string) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

async function dashboardPageComponent(file: string, repo: DashboardRepository) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{ name: "auth-boundary", setup(builder) { builder.onResolve({ filter: /server\/auth\/dashboard$/ }, () => ({ path: "dashboard-auth-fixture", external: true })); } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "server-only" ? {} : name === "dashboard-auth-fixture" ? { dashboardSession: async () => ({ actorId: "signed-in-user", repository: repo }) } : require(name), loaded, loaded.exports);
  return loaded.exports.default as (props: { searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
}

test("legacy detail URLs redirect to their canonical route", async () => {
  const repo = repository({ kind: "owner", propertyId: "101" }, [booking, { ...booking, id: "foreign", propertyId: "202" }]);
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/admin/dashboard/page.tsx", import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{ name: "auth-boundary", setup(builder) { builder.onResolve({ filter: /server\/auth\/dashboard$/ }, () => ({ path: "dashboard-auth-fixture", external: true })); } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "server-only" ? {} : name === "dashboard-auth-fixture" ? { dashboardSession: async () => ({ actorId: "signed-in-user", repository: repo }) } : require(name), loaded, loaded.exports);
  const Page = loaded.exports.default as (props: { searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  for (const bookingId of ["missing", "foreign"]) {
    await assert.rejects(Page({ searchParams: Promise.resolve({ month: "2026-09", view: "booking", bookingId }) }), /NEXT_REDIRECT/);
  }
});

test("canonical bookings page renders the booking workflow", async () => {
  const repo = repository({ kind: "admin" });
  const Page = await dashboardPageComponent("../app/admin/dashboard/bookings/page.tsx", repo);
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ month: "2026-09", status: "confirmed" }) }) as ReactNode);
  assert.match(html, /<h1[^>]*>.*การจอง<\/h1>/);
  assert.match(html, /ตรวจสอบและจัดการรายการจอง/);
  assert.match(html, /href="\/admin\/dashboard\?month=2026-09"[^>]*>.*data-icon="inline-start".*กลับไปภาพรวม/);
  assert.match(html, /<header[^>]*>.*กลับไปภาพรวม.*<h1[^>]*>.*การจอง<\/h1>/);
  assert.doesNotMatch(html, /1 รายการ · ฿1,234\.50/);
  assert.doesNotMatch(html, /การจองติดจอง/);
  assert.match(html, /overflow-hidden rounded-xl border/);
  assert.doesNotMatch(html, /ยอดขายเอเจนซี่/);
  assert.ok(html.indexOf('aria-label="ค้นหาการจอง"') < html.indexOf('id="booking-month"'));
  assert.match(html, /action="\/admin\/dashboard\/bookings"/);
  assert.match(html, /href="\/admin\/dashboard\/bookings\/1\?month=2026-09&amp;status=confirmed"/);
});

test("canonical agency and house pages render their own workflows", async () => {
  const repo = repository({ kind: "admin" });
  const AgenciesPage = await dashboardPageComponent("../app/admin/dashboard/agencies/page.tsx", repo);
  const agenciesHtml = renderToStaticMarkup(await AgenciesPage({ searchParams: Promise.resolve({ month: "2026-09", search: "Agency" }) }) as ReactNode);
  assert.match(agenciesHtml, /<header[^>]*>.*href="\/admin\/dashboard\?month=2026-09"[^>]*>.*กลับไปภาพรวม.*<h1[^>]*>ยอดขายเอเจนซี่<\/h1>/);
  assert.equal((agenciesHtml.match(/ยอดขายเอเจนซี่/g) ?? []).length, 1);
  assert.doesNotMatch(agenciesHtml, /เฉพาะติดจอง · เรียงยอดขายสูงสุดก่อน/);
  assert.match(agenciesHtml, /action="\/admin\/dashboard\/agencies"/);
  assert.match(agenciesHtml, /aria-label="ค้นหาเอเจนซี่"/);
  assert.match(agenciesHtml, /class="relative col-span-2 min-w-0 sm:col-span-1 sm:flex-1 sm:max-w-sm"[\s\S]*lucide-search[\s\S]*aria-label="ค้นหาเอเจนซี่"/);
  assert.match(agenciesHtml, /<input type="month"[^>]*id="agency-month"[^>]*name="month"/);
  assert.match(agenciesHtml, /class="relative col-span-2 min-w-0 sm:col-span-1 sm:w-48"/);
  assert.match(agenciesHtml, /class="[^"]*h-11 pl-9" id="agency-month"/);
  assert.match(agenciesHtml, /class="[^"]*col-span-2[^"]*h-11[^"]*" type="submit"/);
  assert.doesNotMatch(agenciesHtml, /type="hidden" name="month"/);
  assert.match(agenciesHtml, /<table[^>]*>[\s\S]*<th[^>]*>ชื่อเอเจนซี่<\/th>[\s\S]*<th[^>]*>จำนวนการจอง<\/th>[\s\S]*<th[^>]*>ยอดขาย<\/th>/);
  assert.equal((agenciesHtml.match(/<th /g) ?? []).length, 3);
  assert.match(agenciesHtml, /Agency A[\s\S]*<td[^>]*>1<\/td>[\s\S]*<td[^>]*>฿1,234\.50<\/td>/);
  assert.doesNotMatch(agenciesHtml, /100\.0%|ของยอดขาย|h-1\.5 overflow-hidden rounded-full/);
  assert.ok(agenciesHtml.indexOf('aria-label="ค้นหาเอเจนซี่"') < agenciesHtml.indexOf("overflow-hidden rounded-xl border"));
  assert.match(agenciesHtml, /href="\/admin\/dashboard\/agencies\/agency-a\?month=2026-09&amp;search=Agency"/);

  const HousesPage = await dashboardPageComponent("../app/admin/dashboard/houses/page.tsx", repo);
  const housesHtml = renderToStaticMarkup(await HousesPage({ searchParams: Promise.resolve({ month: "2026-09" }) }) as ReactNode);
  assert.match(housesHtml, /<header[^>]*>.*href="\/admin\/dashboard\?month=2026-09"[^>]*>.*กลับไปภาพรวม.*<h1[^>]*>บ้านใหม่<\/h1>/);
  assert.equal((housesHtml.match(/บ้านใหม่/g) ?? []).length, 1);
  assert.doesNotMatch(housesHtml, /ประวัติบ้านเพิ่มใหม่|บ้านที่สร้างรายการในเดือนที่เลือก/);
  assert.match(housesHtml, /action="\/admin\/dashboard\/houses"/);
  assert.match(housesHtml, /aria-label="ค้นหาบ้าน"/);
  assert.match(housesHtml, /class="relative col-span-2 min-w-0 sm:col-span-1 sm:flex-1 sm:max-w-sm"[\s\S]*lucide-search[\s\S]*aria-label="ค้นหาบ้าน"/);
  assert.match(housesHtml, /<input type="month"[^>]*id="houses-month"[^>]*name="month"/);
  assert.match(housesHtml, /class="relative col-span-2 min-w-0 sm:col-span-1 sm:w-48"/);
  assert.match(housesHtml, /class="[^"]*h-11 pl-9" id="houses-month"/);
  assert.match(housesHtml, /class="[^"]*col-span-2[^"]*h-11[^"]*" type="submit"/);
  assert.doesNotMatch(housesHtml, /type="hidden" name="month"/);
  assert.ok(housesHtml.indexOf('aria-label="ค้นหาบ้าน"') < housesHtml.indexOf("overflow-hidden rounded-xl border"));
  assert.match(housesHtml, /href="\/admin\/dashboard\/houses\/listing-new\?month=2026-09"/);
});

test("canonical booking detail applies its own route authorization", async () => {
  const repo = repository({ kind: "owner", propertyId: "101" }, [booking, { ...booking, id: "foreign", propertyId: "202" }]);
  const Page = await dashboardPageComponent("../app/admin/dashboard/bookings/[bookingId]/page.tsx", repo) as (props: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  await assert.rejects(Page({ params: Promise.resolve({ bookingId: "foreign" }), searchParams: Promise.resolve({ month: "2026-09" }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
});

test("canonical detail pages use their list return headers", async () => {
  const repo = repository({ kind: "admin" });
  const BookingPage = await dashboardPageComponent("../app/admin/dashboard/bookings/[bookingId]/page.tsx", repo) as (props: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const bookingHtml = renderToStaticMarkup(await BookingPage({ params: Promise.resolve({ bookingId: "1" }), searchParams: Promise.resolve({ month: "2026-09", status: "confirmed" }) }) as ReactNode);
  assert.match(bookingHtml, /<header[^>]*>.*href="\/admin\/dashboard\/bookings\?month=2026-09&amp;status=confirmed"[^>]*>.*กลับไปการจอง.*<h1[^>]*>รายละเอียดการจอง<\/h1>/);
  assert.equal((bookingHtml.match(/House A · DV-101/g) ?? []).length, 1);

  const AgencyPage = await dashboardPageComponent("../app/admin/dashboard/agencies/[agencyId]/page.tsx", repo) as (props: { params: Promise<{ agencyId: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const agencyHtml = renderToStaticMarkup(await AgencyPage({ params: Promise.resolve({ agencyId: "agency-a" }), searchParams: Promise.resolve({ month: "2026-09" }) }) as ReactNode);
  assert.match(agencyHtml, /<header[^>]*>.*href="\/admin\/dashboard\/agencies\?month=2026-09"[^>]*>.*กลับไปเอเจนซี่.*<h1[^>]*>Agency A<\/h1>/);
  assert.match(agencyHtml, /<h2[^>]*>รายการจอง<\/h2>/);
  assert.match(agencyHtml, /บ้านพัก.*วันเข้าพัก.*ยอดจอง/);
  assert.doesNotMatch(agencyHtml, /ดูการจองทั้งหมด/);

  const HousePage = await dashboardPageComponent("../app/admin/dashboard/houses/[id]/page.tsx", repo) as (props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const houseHtml = renderToStaticMarkup(await HousePage({ params: Promise.resolve({ id: "listing-new" }), searchParams: Promise.resolve({ month: "2026-09", search: "villa", page: "2" }) }) as ReactNode);
  assert.match(houseHtml, /<header[^>]*>.*href="\/admin\/dashboard\/houses\?month=2026-09&amp;search=villa&amp;page=2"[^>]*>.*กลับไปบ้านใหม่.*<h1[^>]*>New House<\/h1>/);
});

test("dashboard mobile layouts keep house metadata grouped and details compact", async () => {
  const HouseRow = await dashboardComponent("DashboardHouseRow", "../components/admin/dashboard/dashboard-rows.tsx");
  const house = { id: "house-long", propertyId: "900260912", title: "[DEMO LARGE 2026-09] บ้านตัวอย่าง 13", createdAt: "2026-09-01T00:00:00Z", bedrooms: 3, bathrooms: 2, maxGuests: 8, locationZone: "พัทยาเหนือ", propertyType: "poolvilla", isActive: true, checkinTime: "15:00", checkoutTime: "11:00" };
  const rowHtml = renderToStaticMarkup(createElement(HouseRow, { house, href: "/admin/dashboard/houses/house-long?month=2026-09" }));
  assert.match(rowHtml, /grid-cols-\[minmax\(0,1fr\)\][\s\S]*sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(rowHtml, /DV-900260912/);
  assert.match(rowHtml, /sm:whitespace-nowrap/);

  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", view: "booking", bookingId: "1" });
  const bookingHtml = renderToStaticMarkup(createElement(await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx"), { report, query: parseDashboardQuery({ month: "2026-09", view: "booking", bookingId: "1" }) }));
  assert.match(bookingHtml, /grid-cols-2 gap-x-4 gap-y-3/);
  assert.match(bookingHtml, /รหัสจอง/);
  assert.match(bookingHtml, /Agency A/);

  const houseReport = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", view: "house", houseId: "listing-new" });
  const houseHtml = renderToStaticMarkup(createElement(await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx"), { report: houseReport, query: parseDashboardQuery({ month: "2026-09", view: "house", houseId: "listing-new" }) }));
  assert.match(houseHtml, /grid grid-cols-2 gap-x-4 gap-y-3/);
  assert.match(houseHtml, /ผู้เข้าพักสูงสุด/);
  assert.match(houseHtml, /เวลาเช็กอิน/);
});

test("agency detail filters render as a compact mobile-first toolbar", async () => {
  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" });
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const baseQuery = parseDashboardQuery({ month: "2026-09", view: "agency", agency: "agency-a" });
  const bookingsHtml = renderToStaticMarkup(createElement(View, {
    report,
    query: baseQuery,
    agencyQuery: parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "villa", search: "Agency", page: "2", sort: "price-desc" }),
  }));
  assert.match(bookingsHtml, /name="bookingSearch"[^>]*value="villa"/);
  assert.match(bookingsHtml, /type="hidden" name="search" value="Agency"/);
  assert.match(bookingsHtml, /type="hidden" name="page" value="2"/);
  assert.match(bookingsHtml, /type="month"[^>]*id="agency-detail-month"[^>]*name="month"/);
  assert.match(bookingsHtml, /value="price-desc" selected/);
  assert.doesNotMatch(bookingsHtml, /การจอง \(1\)|บ้านยอดขายสูงสุด/);
  assert.match(bookingsHtml, /hidden md:block[\s\S]*<table[\s\S]*md:hidden/);
  assert.match(bookingsHtml, /class="grid min-h-14 grid-cols-\[minmax\(0,1fr\)_auto\][^"]*md:grid-cols-3"/);
  assert.match(bookingsHtml, /House A/);
  assert.match(bookingsHtml, /1 พ\.ย\. 2569/);
  assert.match(bookingsHtml, /฿1,234\.50/);

});

test("agency bookings sort by check-in date or price before pagination", async () => {
  const rows = [
    { ...booking, id: "middle", checkIn: "2026-10-02", priceCents: 300 },
    { ...booking, id: "last", checkIn: "2026-10-03", priceCents: 100 },
    { ...booking, id: "first", checkIn: "2026-10-01", priceCents: 200 },
  ];
  const repo = repository({ kind: "admin" }, rows);
  const load = (sort: "date-asc" | "date-desc" | "price-asc" | "price-desc") => loadDashboardAgency(repo, "signed-in-user", { month: "2026-09", search: "", page: 1 }, "agency-a", 1, "", sort);
  for (const [sort, expected] of [
    ["date-asc", ["first", "middle", "last"]],
    ["date-desc", ["last", "middle", "first"]],
    ["price-asc", ["last", "first", "middle"]],
    ["price-desc", ["middle", "first", "last"]],
  ] as const) {
    const report = await load(sort);
    assert.equal(report.detail?.kind, "agency");
    if (report.detail?.kind !== "agency") assert.fail("expected agency detail");
    assert.deepEqual(report.detail.bookings.rows.map(row => row.id), expected);
  }
});

test("agency booking search reports when no booking matches", async () => {
  const report = await loadDashboardAgency(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", search: "", page: 1 }, "agency-a", 1, "no matching house");
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const html = renderToStaticMarkup(createElement(View, {
    report,
    query: parseDashboardQuery({ month: "2026-09", view: "agency", agency: "agency-a" }),
    agencyQuery: parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "no matching house" }),
  }));
  assert.match(html, /role="status"[^>]*>ไม่พบการจองที่ตรงกับคำค้นหา<\/p>/);
  assert.match(html, /name="bookingSearch"[^>]*value="no matching house"/);
});

test("booking list keeps its workflow in a compact toolbar", async () => {
  const View = await dashboardComponent("BookingsList", "../components/admin/dashboard/bookings-list.tsx");
  const raw = { month: "2026-09", view: "bookings", status: "confirmed", agency: "agency-a", page: "2" };
  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", raw);
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", agency: "agency-a", page: "2" });
  const html = renderToStaticMarkup(createElement(View, { report, query }));
  assert.match(html, /name="status"/);
  assert.match(html, /grid min-w-0 grid-cols-2 gap-2/);
  assert.match(html, /class="relative col-span-2 min-w-0 sm:col-span-1 sm:flex-1 sm:max-w-sm"[\s\S]*lucide-search[\s\S]*aria-label="ค้นหาการจอง"/);
  assert.match(html, /class="relative col-span-1 min-w-0 sm:col-span-1 sm:w-48"[\s\S]*id="booking-month"/);
  assert.match(html, /class="[^"]*col-span-2[^"]*h-11[^"]*" type="submit"/);
  assert.match(html, /class="[^\"]*h-11[^\"]*" id="booking-month"/);
  assert.match(html, /id="booking-status" name="status" class="[^\"]*h-11/);
  assert.match(html, /value="confirmed" selected/);
  assert.match(html, /name="agency"[^>]*value="agency-a"/);
  assert.doesNotMatch(html, /name="page"/);
  assert.doesNotMatch(html, /กลับภาพรวม/);
  assert.doesNotMatch(html, /การจองติดจอง/);
  assert.match(html, /aria-label="ค้นหาการจอง"/);
  assert.match(html, /data-dashboard-detail-link/);
  assert.match(html, /เอเจนซี่: Agency A/);
  assert.doesNotMatch(html, /รายการ ·/);
  assert.doesNotMatch(html, /ยอดขายเอเจนซี่/);
  assert.match(html, /บ้าน \/ DV/);
  assert.doesNotMatch(html, /บ้าน \/ DV \/ รหัสจอง/);
  assert.match(html, /เอเจนซี่/);
  assert.match(html, /<table/);
  assert.match(html, /฿1,234\.50/);
  assert.doesNotMatch(html, /กดรายการเพื่อดูรายละเอียด/);
  assert.doesNotMatch(html, /รหัสเอเจนซี่/);
});

test("booking detail exposes operational fields but repair has no monetary amount", async () => {
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const raw = { month: "2026-09", view: "booking", bookingId: "1" };
  const report = await loadDashboard(repository({ kind: "admin" }, [{ ...booking, status: "repair" }]), "signed-in-user", raw);
  const html = renderToStaticMarkup(createElement(View, { report, query: parseDashboardQuery(raw) }));
  assert.match(html, /ปิดซ่อม\/ปรับปรุง/);
  assert.match(html, /เช็กเอาต์/);
  assert.match(html, /วันที่สร้าง/);
  assert.match(html, /Agency A/);
  assert.match(html, /ยอดจอง<\/dt><dd[^>]*>—/);
  assert.match(html, /<header[^>]*>.*กลับไปหน้าก่อนหน้า.*<h1[^>]*>รายละเอียดการจอง<\/h1>/);
  assert.match(html, /grid grid-cols-2 gap-x-4 gap-y-3/);
  assert.match(html, /class="min-w-0 col-span-2"/);
  assert.doesNotMatch(html, /1,234/);
});

test("agency chart labels remove seeded demo prefixes", () => {
  assert.equal(dashboardAgencyChartLabel("[DEMO LARGE 2026-09] พูลวิลล่าแฟมิลี่"), "พูลวิลล่าแฟมิลี่");
  assert.equal(dashboardAgencyChartLabel("เอเจนซี่ชื่อยาวมากเกินกว่าพื้นที่แสดงผล"), "เอเจนซี่ชื่อยาวมากเกินก…");
});

test("house workspace return links allow dashboard detail routes and reject external destinations", () => {
  assert.equal(safeHouseReturnTo("/admin/dashboard/houses/listing-new?month=2026-09&search=villa&page=2"), "/admin/dashboard/houses/listing-new?month=2026-09&search=villa&page=2");
  assert.equal(safeHouseReturnTo("/admin/houses?page=2&q=villa"), "/admin/houses?page=2&q=villa");
  assert.equal(safeHouseReturnTo("https://evil.example"), null);
  assert.equal(safeHouseReturnTo("//evil.example/admin/dashboard/houses/listing-new"), null);
  assert.equal(safeHouseReturnTo("/admin/dashboard/houses/id/extra"), null);
});

test("agency detail shows only its booking list and house details expose manage destinations", async () => {
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const raw = { month: "2026-09", view: "agency", agency: "agency-a", from: "agencies", agenciesPage: "2" };
  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", raw);
  const html = renderToStaticMarkup(createElement(View, { report, query: parseDashboardQuery(raw) }));
  assert.match(html, /สัดส่วนยอดขาย/);
  assert.match(html, /100\.0%/);
  assert.equal((html.match(/<table/g) ?? []).length, 1);
  assert.match(html, /รายการจอง/);
  assert.match(html, /จำนวนการจอง/);
  assert.doesNotMatch(html, /บ้านยอดขายสูงสุด|section=houses/);
  assert.match(html, /href="\/admin\/dashboard\/bookings\/1\?month=2026-09&amp;status=confirmed&amp;agency=agency-a"/);
  const houseRaw = { month: "2026-09", view: "house", houseId: "listing-new" };
  const house = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", houseRaw);
  const houseHtml = renderToStaticMarkup(createElement(View, { report: house, query: parseDashboardQuery(houseRaw) }));
  assert.match(houseHtml, /href="\/admin\/houses\/202\?returnTo=%2Fadmin%2Fdashboard%2Fhouses%2Flisting-new%3Fmonth%3D2026-09"/);
  assert.match(houseHtml, /07:00/);
  assert.match(houseHtml, /ห้องนอน/);
  assert.match(houseHtml, /ห้องน้ำ/);
  assert.match(houseHtml, /ผู้เข้าพักสูงสุด/);
  assert.match(houseHtml, /โซน/);
  assert.match(houseHtml, /ประเภทบ้าน/);
  assert.match(houseHtml, /เปิดใช้งาน/);
});

test("empty booking lists distinguish empty month from unmatched filters", async () => {
  const View = await dashboardComponent("BookingsList", "../components/admin/dashboard/bookings-list.tsx");
  for (const [rows, search, expected] of [[[], "", /ไม่มีการจองในเดือนนี้/], [[booking], "not-found", /ไม่พบการจองที่ตรงกับตัวกรอง/]] as const) {
    const raw = { month: "2026-09", view: "bookings", search };
    const report = await loadDashboard(repository({ kind: "admin" }, [...rows]), "signed-in-user", raw);
    assert.match(renderToStaticMarkup(createElement(View, { report, query: parseDashboardBookingsQuery({ month: "2026-09", search }) })), expected);
  }
});

function repository(
  scope: DashboardScope | null,
  rows: DashboardBookingSource[] = [booking],
  houses: DashboardHouse[] = [{ id: "listing-new", propertyId: "202", title: "New House", createdAt: "2026-09-12T00:00:00Z", bedrooms: 3, bathrooms: 2, maxGuests: 8, locationZone: "พัทยาเหนือ", propertyType: "poolvilla", isActive: true, checkinTime: "15:00", checkoutTime: "11:00" }],
): DashboardRepository {
  return {
    async access(actorId) { assert.equal(actorId, "signed-in-user"); return scope; },
    async bookings(actualScope) { assert.deepEqual(actualScope, scope); return rows; },
    async newHouses() { return houses; },
  };
}

test("dashboard permissions grant every house only to role 1 and fail closed without a valid DV ID", () => {
  assert.deepEqual(dashboardScope({ role_id: 1, dv_id: null }), { kind: "admin" });
  assert.deepEqual(dashboardScope({ role_id: 3, dv_id: 101 }), { kind: "owner", propertyId: "101" });
  assert.deepEqual(dashboardScope({ role_id: null, dv_id: "9223372036854775807" }), { kind: "owner", propertyId: "9223372036854775807" });
  assert.equal(dashboardScope(null), null);
  for (const dv_id of [null, "", 0, -1, "101,102", "101 or true", 1.5, "9223372036854775808", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(dashboardScope({ role_id: 2, dv_id }), null);
  }
  assert.equal(dashboardScope({ role_id: "1", dv_id: null }), null);
});

test("dashboard months use Bangkok midnight, including year change and leap February", () => {
  assert.deepEqual(parseDashboardQuery({}, new Date("2026-09-30T17:00:00Z")), {
    month: "2026-10", start: "2026-09-30T17:00:00.000Z", end: "2026-10-31T17:00:00.000Z", view: "overview", from: "overview", page: 1, housesPage: 1, agenciesPage: 1, status: "all", search: "", agency: "", agencySearch: "", houseSearch: "", bookingId: "", houseId: "",
  });
  assert.equal(parseDashboardQuery({ month: "2028-02" }).end, "2028-02-29T17:00:00.000Z");
  assert.equal(parseDashboardQuery({ month: "2026-12" }).end, "2026-12-31T17:00:00.000Z");
  for (const raw of [{ month: "2026-13" }, { month: ["2026-09"] }, { month: "" }, { page: "0" }, { housesPage: "-1" }, { month: "2026-9" }]) assert.throws(() => parseDashboardQuery(raw));
});

test("shared Thai month picker uses Buddhist Era values", async () => {
  assert.deepEqual(parseThaiMonth("2026-10"), { month: 10, year: 2569 });
  assert.equal(thaiMonthValue({ month: 10, year: 2569 }), "2026-10");
  const ThaiMonthPicker = await dashboardComponent("ThaiMonthPicker", "../components/ui/thai-month-picker.tsx");
  assert.match(renderToStaticMarkup(createElement(ThaiMonthPicker, { month: "2026-10", onMonthChange() {} })), /ตุลาคม 2569/);
  assert.throws(() => parseThaiMonth("2026-13"));
  assert.throws(() => thaiMonthValue({ month: 10, year: 2568.5 }));
});

test("denied dashboard identities cannot read any booking or new-house data", async () => {
  const repo = repository(null);
  repo.bookings = async () => { assert.fail("denied identity queried bookings"); };
  repo.newHouses = async () => { assert.fail("denied identity queried new houses"); };
  await assert.rejects(loadDashboard(repo, "signed-in-user", { month: "2026-09", role_id: 1, dv_id: "101" }), DashboardForbidden);
});

test("owner cannot expand scope through URL parameters and receives no agency or foreign-house data", async () => {
  const repo = repository({ kind: "owner", propertyId: "101" }, [booking, { ...booking, id: "2", propertyId: "202", houseTitle: "Other house" }]);
  repo.newHouses = async () => { assert.fail("owner queried admin-only house history"); };
  const report = await loadDashboard(repo, "signed-in-user", { month: "2026-09", role_id: 1, dv_id: "202", propertyId: "202" });
  assert.equal(report.bookingCount, 1);
  assert.equal(report.admin, null);
  assert.equal(report.sales.amountCents, 123450);
  assert.equal(report.bookings.rows[0].propertyId, "101");
  assert.equal("agentId" in report.bookings.rows[0], false);
  assert.equal("agency" in report.bookings.rows[0], false);
  assert.equal(JSON.stringify(report).includes("Agency A"), false);
  assert.equal(JSON.stringify(report).includes("Other house"), false);
});

test("admin sales count only confirmed bookings, group agencies and flag missing full prices", async () => {
  const rows = [booking,
    { ...booking, id: "2", propertyId: "202", agentId: "agency-b", agentName: "Inactive B", priceCents: 20 },
    { ...booking, id: "3", priceCents: 10 },
    { ...booking, id: "4", priceCents: null },
    { ...booking, id: "5", agentId: null, agentName: null, priceCents: 30000 },
    ...["waiting", "cancelled", "repair", null].map((status, index) => ({ ...booking, id: `other-${index}`, status, priceCents: 99999999 })),
  ];
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09" });
  assert.deepEqual(report.sales, { count: 5, amountCents: 153480, missingPrices: 1 });
  assert.equal(report.waitingCount, 1);
  assert.equal(report.bookings.total, 9);
  assert.equal(report.bookingCount, 9);
  assert.deepEqual(report.statusCounts, { confirmed: 5, waiting: 1, cancelled: 1, repair: 1, unknown: 1 });
  assert.deepEqual(report.admin?.agencies.rows.map(row => [row.name, row.count, row.amountCents]), [
    ["Agency A", 3, 123460], ["ไม่ระบุเอเจนซี่", 1, 30000], ["Inactive B", 1, 20],
  ]);
  assert.equal(report.admin?.houses.total, 1);
  assert.deepEqual(report.bookings.rows[0].agency, { id: "agency-a", name: "Agency A" });
});

test("report boundaries exclude the next month and paginate details without reducing totals", async () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ ...booking, id: String(i + 1), priceCents: 100 }));
  rows.push({ ...booking, id: "26", createdAt: "2026-08-31T17:00:00Z", priceCents: 100 });
  rows.push({ ...booking, id: "27", createdAt: "2026-09-30T17:00:00Z", priceCents: 99999 });
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", page: "999" });
  assert.equal(report.sales.amountCents, 2600);
  assert.equal(report.bookings.total, 26);
  assert.equal(report.bookings.page, 3);
  assert.equal(report.bookings.rows.length, 6);
});

const dbRow = {
  id: 1, booking_code: "BK1", listing_id: "listing-a", houseid: 101, check_in: "2026-11-01", check_out: "2026-11-03",
  status: "confirmed", price_max: "1234.50", created_at: "2026-09-10T00:00:00Z",
  listing: { id: "listing-a", property_id: 101, title: "House A" },
};

test("status filtering precedes pagination and never changes monthly sales or counts", async () => {
  const rows = [booking, ...Array.from({ length: 23 }, (_, i) => ({ ...booking, id: `wait-${i}`, status: "waiting" }))];
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", status: "waiting", page: "2" });
  assert.equal(report.bookingCount, 24);
  assert.equal(report.statusCounts.waiting, 23);
  assert.equal(report.bookings.total, 23);
  assert.equal(report.bookings.rows.length, 10);
  assert.ok(report.bookings.rows.every(row => row.status === "waiting"));
  assert.equal(report.sales.amountCents, 123450);
});

test("search and agency drilldown preserve totals and owner isolation", async () => {
  const rows = [booking, { ...booking, id: "2", code: "OTHER", agentId: null, status: null }];
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", search: "other", status: "unknown", agency: "unassigned" });
  assert.deepEqual(report.bookings.rows.map(row => row.id), ["2"]);
  assert.equal(report.bookingCount, 2);
  assert.equal(report.sales.count, 1);
  const owner = await loadDashboard(repository({ kind: "owner", propertyId: "101" }, rows), "signed-in-user", { month: "2026-09", agency: "foreign" });
  assert.equal(owner.bookings.total, 2);
  const dvSearch = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", search: "DV-101" });
  assert.equal(dvSearch.bookings.total, 2);
  for (const raw of [{ status: "bogus" }, { status: ["waiting"] }, { search: ["x"] }, { agency: ["x"] }, { search: "x".repeat(201) }]) assert.throws(() => parseDashboardQuery(raw));
});

test("dashboard keeps all monthly status totals while filtering a bounded booking list", async () => {
  const rows: DashboardBookingSource[] = [
    ...Array.from({ length: 25 }, (_, index) => ({ ...booking, id: `waiting-${index}`, status: "waiting", createdAt: `2026-09-${String(index % 20 + 1).padStart(2, "0")}T00:00:00Z` })),
    ...Array.from({ length: 5 }, (_, index) => ({ ...booking, id: `confirmed-${index}`, status: "confirmed", priceCents: 100 })),
    ...Array.from({ length: 2 }, (_, index) => ({ ...booking, id: `cancelled-${index}`, status: "cancelled" })),
    { ...booking, id: "repair", status: "repair" },
    { ...booking, id: "legacy", status: null },
  ];
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", view: "bookings", status: "waiting", page: "3" });
  assert.equal(report.bookingCount, 34);
  assert.deepEqual(report.statusCounts, { confirmed: 5, waiting: 25, cancelled: 2, repair: 1, unknown: 1 });
  assert.equal(report.sales.amountCents, 500);
  assert.equal(report.bookings.total, 25);
  assert.equal(report.bookings.rows.length, 5);
  assert.ok(report.bookings.rows.every(row => row.status === "waiting"));
  assert.equal(report.overview.confirmedBookingsByDay.length, 30);
});

test("dashboard provides one confirmed-booking chart point for every day in the selected month", async () => {
  const rows: DashboardBookingSource[] = Array.from({ length: 30 }, (_, index) => ({
    ...booking,
    id: `daily-${index + 1}`,
    createdAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    status: index % 3 === 0 ? "confirmed" : "waiting",
  }));
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09" });
  const chart = report.overview.confirmedBookingsByDay;
  assert.equal(chart.length, 30);
  assert.deepEqual(chart[0], { date: "2026-09-01", count: 1 });
  assert.deepEqual(chart[1], { date: "2026-09-02", count: 0 });
  assert.deepEqual(chart[29], { date: "2026-09-30", count: 0 });
});

test("dashboard overview previews five agencies and six new houses", async () => {
  const agencies = Array.from({ length: 7 }, (_, index) => ({
    ...booking,
    id: `preview-agency-${index}`,
    agentId: `preview-agency-${index}`,
    agentName: `Preview Agency ${index}`,
    priceCents: (index + 1) * 100,
  }));
  const houses = Array.from({ length: 7 }, (_, index) => ({
    id: `preview-house-${index}`,
    propertyId: String(700 + index),
    title: `Preview House ${index}`,
    createdAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    bedrooms: 3, bathrooms: 2, maxGuests: 6, locationZone: null, propertyType: "poolvilla", isActive: true, checkinTime: null, checkoutTime: null,
  }));
  const report = await loadDashboard(repository({ kind: "admin" }, agencies, houses), "signed-in-user", { month: "2026-09" });
  assert.equal(report.overview.topAgencies.length, 5);
  assert.equal(report.overview.recentHouses.length, 6);
});

test("dashboard owner detail routes fail closed without leaking foreign or agency data", async () => {
  const rows = [booking, { ...booking, id: "foreign", propertyId: "202", houseTitle: "Foreign House", agentName: "Foreign Agency" }];
  const ownerRepository = repository({ kind: "owner", propertyId: "101" }, rows);
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" }));
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "house", houseId: "listing-new" }));
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "booking", bookingId: "foreign" }));
  const owner = await loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "bookings" });
  assert.doesNotMatch(JSON.stringify(owner), /Foreign House|Foreign Agency|agency-a/);
  assert.deepEqual(owner.overview.topAgencies, []);
  assert.deepEqual(owner.overview.recentHouses, []);
  assert.equal(owner.overview.agencyCount, 0);
  assert.equal(owner.overview.newHouseCount, 0);
  assert.equal(owner.overview.confirmedBookingsByDay.length, 30);
  assert.deepEqual(owner.overview.confirmedBookingsByDay[9], { date: "2026-09-10", count: 1 });
});

test("dashboard agency lists remain bounded and agency details retain their booking totals", async () => {
  const agencies = Array.from({ length: 100 }, (_, index) => ({ ...booking, id: `agency-${index}`, agentId: `agency-${index}`, agentName: `Agency ${index}`, propertyId: String(1000 + index), houseTitle: index < 5 ? "พูลวิลล่าชื่อซ้ำ" : `House ${index}`, priceCents: index === 99 ? null : (index + 1) * 100 }));
  const report = await loadDashboard(repository({ kind: "admin" }, agencies), "signed-in-user", { month: "2026-09", view: "agencies", agenciesPage: "999" });
  assert.equal(report.admin?.agencies.total, 100);
  assert.equal(report.admin?.agencies.rows.length, 10);
  assert.equal(report.overview.topAgencies.length, 5);
  assert.equal(report.sales.count, 100);
  assert.equal(report.sales.missingPrices, 1);
  const detailRows = Array.from({ length: 5 }, (_, index) => ({ ...booking, id: `detail-${index}`, agentId: "agency-a", agentName: "Agency A", propertyId: String(200 + index), houseTitle: "พูลวิลล่าชื่อซ้ำ", priceCents: (index + 1) * 100 }));
  const detailReport = await loadDashboard(repository({ kind: "admin" }, detailRows), "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" });
  assert.equal(detailReport.detail?.kind, "agency");
  if (detailReport.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(detailReport.detail.agency.amountCents, 1500);
  assert.equal(detailReport.detail.bookings.total, 5);
});

test("agency detail lists only that agency's confirmed bookings and paginates all of them", async () => {
  const agencyBookings = Array.from({ length: 12 }, (_, index) => ({
    ...booking,
    id: `agency-booking-${index + 1}`,
    agentId: "agency-a",
    agentName: "Agency A",
    houseTitle: `Agency House ${index + 1}`,
    priceCents: (index + 1) * 100,
  }));
  const rows = [
    ...agencyBookings,
    { ...booking, id: "agency-waiting", agentId: "agency-a", status: "waiting", houseTitle: "Waiting House" },
    { ...booking, id: "other-agency", agentId: "agency-b", agentName: "Agency B", houseTitle: "Other Agency House" },
  ];
  const firstPage = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" });
  assert.equal(firstPage.detail?.kind, "agency");
  if (firstPage.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(firstPage.detail.bookings.total, 12);
  assert.equal(firstPage.detail.bookings.rows.length, 10);
  assert.equal(firstPage.detail.bookings.rows[0].id, "agency-booking-12");

  const secondPage = await loadDashboardAgency(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", search: "", page: 1 }, "agency-a", 2);
  assert.equal(secondPage.detail?.kind, "agency");
  if (secondPage.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(secondPage.detail.bookings.total, 12);
  assert.equal(secondPage.detail.bookings.page, 2);
  assert.deepEqual(secondPage.detail.bookings.rows.map(row => row.id), ["agency-booking-2", "agency-booking-1"]);
  assert.ok(secondPage.detail.bookings.rows.every(row => row.agency?.id === "agency-a"));

  const filtered = await loadDashboardAgency(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", search: "", page: 1 }, "agency-a", 1, "Agency House 1");
  assert.equal(filtered.detail?.kind, "agency");
  if (filtered.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(filtered.detail.bookings.total, 4);
  assert.equal(filtered.detail.bookings.rows.length, 4);
  assert.deepEqual(filtered.detail.bookings.rows.map(row => row.id), ["agency-booking-12", "agency-booking-11", "agency-booking-10", "agency-booking-1"]);
});

test("repository owner reads constrain both house identifiers and omit agency/customer fields", async () => {
  let calls = 0;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(url.searchParams.get("houseid"), "eq.101");
    assert.equal(url.searchParams.get("listing.property_id"), "eq.101");
    assert.deepEqual(url.searchParams.getAll("created_at"), ["gte.2026-08-31T17:00:00.000Z", "lt.2026-09-30T17:00:00.000Z"]);
    assert.doesNotMatch(url.searchParams.get("select") ?? "", /agent|customer|note|phone/);
    assert.equal(url.searchParams.get("offset"), String(calls));
    calls++;
    // Simulate a server cap of one row despite our requested batch of 500.
    return new Response(JSON.stringify([{ ...dbRow, id: calls }]), { headers: { "Content-Type": "application/json", "Content-Range": `${calls - 1}-${calls - 1}/2` } });
  } } });
  const rows = await createDashboardRepository(client).bookings({ kind: "owner", propertyId: "101" }, parseDashboardQuery({ month: "2026-09" }));
  assert.equal(calls, 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].priceCents, 123450);
  assert.equal(rows[0].agentId, null);
});

test("repository discards mismatched or foreign house joins even if supplied by a data source", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => new Response(JSON.stringify([
    dbRow,
    { ...dbRow, id: 2, listing: { ...dbRow.listing, property_id: 202 } },
    { ...dbRow, id: 3, houseid: 202, listing: { ...dbRow.listing, property_id: 202 } },
    { ...dbRow, id: 4, listing_id: "foreign-listing" },
  ]), { headers: { "Content-Type": "application/json", "Content-Range": "0-3/4" } }) } });
  const rows = await createDashboardRepository(client).bookings({ kind: "owner", propertyId: "101" }, parseDashboardQuery({ month: "2026-09" }));
  assert.deepEqual(rows.map(row => row.id), ["1"]);
});

test("repository resolves access by authenticated UID and never by email or request DV ID", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/users");
    assert.equal(url.searchParams.get("uid"), "eq.signed-in-user");
    assert.equal(url.searchParams.get("select"), "role_id,dv_id");
    return new Response(JSON.stringify({ role_id: 3, dv_id: "101" }), { headers: { "Content-Type": "application/json" } });
  } } });
  assert.deepEqual(await createDashboardRepository(client).access("signed-in-user"), { kind: "owner", propertyId: "101" });
});

test("new-house history paginates beyond the server response cap using the selected month", async () => {
  let calls = 0;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/listings");
    assert.equal(url.searchParams.get("offset"), String(calls));
    assert.match(url.searchParams.get("select") ?? "", /bedrooms,bathrooms,max_guests,location_zone,property_type,is_active,checkin_time,checkout_time/);
    assert.deepEqual(url.searchParams.getAll("created_at"), ["gte.2026-08-31T17:00:00.000Z", "lt.2026-09-30T17:00:00.000Z"]);
    calls++;
    return new Response(JSON.stringify([{ id: `listing-${calls}`, property_id: 100 + calls, title: "New House", created_at: "2026-09-10T00:00:00Z", bedrooms: 3, bathrooms: 2, max_guests: 8, location_zone: "พัทยาเหนือ", property_type: "poolvilla", is_active: true, checkin_time: "15:00:00", checkout_time: "11:00:00" }]), { headers: { "Content-Type": "application/json", "Content-Range": `${calls - 1}-${calls - 1}/2` } });
  } } });
  const rows = await createDashboardRepository(client).newHouses(parseDashboardQuery({ month: "2026-09" }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].bedrooms, 3);
  assert.equal(rows[0].maxGuests, 8);
  assert.equal(rows[0].locationZone, "พัทยาเหนือ");
  assert.equal(rows[0].checkinTime, "15:00:00");
  assert.equal(calls, 2);
});

test("failed or incomplete reads reject rather than displaying partial totals", async () => {
  for (const response of [new Response("{}", { status: 500 }), new Response("[]", { headers: { "Content-Type": "application/json", "Content-Range": "*/3" } })]) {
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => response.clone() } });
    await assert.rejects(createDashboardRepository(client).bookings({ kind: "admin" }, parseDashboardQuery({ month: "2026-09" })));
  }
});

test("dashboard renders month controls and only administrator views include agency and house history", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../components/admin/dashboard/dashboard-view.tsx", import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
  const View = loaded.exports.DashboardView as ComponentType<Record<string, unknown>>;
  const query = parseDashboardQuery({ month: "2026-09" });
  for (const scope of [{ kind: "admin" }, { kind: "owner", propertyId: "101" }] as const) {
    const report = await loadDashboard(repository(scope), "signed-in-user", { month: "2026-09" });
    const html = renderToStaticMarkup(createElement(View, { report, query }));
    assert.match(html, /data-thai-month-picker/);
    assert.match(html, /aria-label="เลือกเดือน"/);
    assert.match(html, /กันยายน 2569/);
    assert.doesNotMatch(html, /<select/);
    assert.doesNotMatch(html, /ดูข้อมูล/);
    assert.match(html, /ติดจอง/);
    assert.equal((html.match(/<span class="block text-xl font-semibold tabular-nums">1<\/span>/g) ?? []).length, 1);
    assert.match(html, /ยอดขายจากการจอง/);
    assert.match(html, /สถานะการจอง/);
    assert.match(html, /จำนวนการจอง/);
    assert.match(html, /aria-label="กราฟจำนวนการจองติดจองรายวัน"/);
    assert.match(html, /aria-label="กราฟจำนวนการจองติดจองรายวัน" class="w-full"/);
    assert.match(html, /--color-count: var\(--primary\)/);
    assert.doesNotMatch(html, /แสดงจำนวนรายการตามวันที่สร้าง/);
    assert.match(html, /status=confirmed/);
    assert.match(html, /\/admin\/dashboard\/bookings\?month=2026-09/);
    assert.doesNotMatch(html, /ไม่ใช่เงินรับแล้ว/);
    assert.match(html, /status=waiting/);
    assert.doesNotMatch(html, /ตามวันที่สร้างรายการ/);
    assert.doesNotMatch(html, /วิธีคำนวณยอดขาย/);
    if (scope.kind === "admin") assert.match(html, /ดูทั้งหมด/);
    assert.equal(html.includes("ยอดขายเอเจนซี่"), scope.kind === "admin");
    assert.equal(html.includes("บ้านใหม่"), scope.kind === "admin");
    assert.equal(html.includes("New House"), scope.kind === "admin");
    assert.equal(html.includes("กราฟยอดขายเอเจนซี่ 5 อันดับแรก"), scope.kind === "admin");
    if (scope.kind === "admin") {
      assert.match(html, /flex w-full flex-1 flex-col divide-y \[&amp;&gt;a\]:flex-1/);
      assert.match(html, /--color-amountCents: var\(--primary\)/);
    }
  }
  const empty = await loadDashboard(repository({ kind: "admin" }, []), "signed-in-user", { month: "2026-09" });
  const emptyHtml = renderToStaticMarkup(createElement(View, {
    report: { ...empty, overview: { ...empty.overview, recentHouses: [] } },
    query,
  }));
  assert.match(emptyHtml, /ยังไม่มีบ้านเพิ่มใหม่/);
  assert.match(emptyHtml, /ยังไม่มีรายการติดจอง/);
  assert.match(emptyHtml, /data-slot="empty"/);
  assert.match(emptyHtml, /data-variant="icon"/);
  assert.match(emptyHtml, /ยังไม่มียอดขายเอเจนซี่/);
  assert.match(emptyHtml, /เมื่อมีรายการติดจอง ข้อมูลจะแสดงที่นี่/);
  assert.match(emptyHtml, /grid gap-5 lg:grid-cols-2/);
  assert.doesNotMatch(emptyHtml, /grid items-start gap-5 lg:grid-cols-2/);
  assert.ok((emptyHtml.match(/min-h-\[20rem\] h-full gap-2/g) ?? []).length >= 2);
  assert.ok((emptyHtml.match(/min-h-\[20rem\]/g) ?? []).length >= 2);
  assert.match(emptyHtml, /min-h-\[21rem\]/);
  assert.doesNotMatch(emptyHtml, /aria-label="กราฟยอดขายเอเจนซี่/);
  const missing = await loadDashboard(repository({ kind: "admin" }, [{ ...booking, priceCents: null }]), "signed-in-user", { month: "2026-09" });
  const missingHtml = renderToStaticMarkup(createElement(View, { report: missing, query }));
  assert.match(missingHtml, /role="status"/);
  assert.match(missingHtml, /ยังไม่ระบุยอด/);
  assert.match(missingHtml, /การจองติดจองรายวัน/);
});
