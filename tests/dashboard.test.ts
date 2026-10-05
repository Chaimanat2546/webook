import assert from "node:assert/strict";
import { dashboardReportFixture } from "./helpers/dashboard-report-fixture.ts";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { CircleUserRoundIcon, CreditCardIcon, TicketCheckIcon } from "lucide-react";
import { dashboardAgencyChartLabel, dashboardScope, parseDashboardQuery, type DashboardBookingSource, type DashboardHouse, type DashboardScope } from "../lib/dashboard.ts";
import { safeHouseReturnTo } from "../lib/admin-return-to.ts";
import { parseThaiMonth, thaiMonthValue } from "../lib/thai-month.ts";
import { createDashboardRepository, type DashboardRepository } from "../server/repositories/dashboard.ts";
import { DashboardForbidden, loadDashboard, loadDashboardAgencies, loadDashboardAgency, loadDashboardBooking, loadDashboardBookingCustomer, loadDashboardBookings } from "../server/services/dashboard.ts";
import { dashboardBookingsHref, parseDashboardAgencyDetailQuery, parseDashboardBookingsQuery } from "../lib/dashboard-routes.ts";

const booking: DashboardBookingSource = {
  id: "1", code: "BK1", propertyId: "101", houseTitle: "House A", checkIn: "2026-11-01", checkOut: "2026-11-03",
  createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z", customerId: null, customerFirstName: null, customerLastName: null,
  status: "confirmed", priceCents: 123450, agentId: "agency-a", agentName: "Agency A",
};

test("deferred booking customer action accepts only numeric booking IDs", () => {
  const action = readFileSync(fileURLToPath(new URL("../app/admin/dashboard/actions.ts", import.meta.url)), "utf8");
  assert.match(action, /const BOOKING_ID = \/\^\[1-9\]\\d\*\$\/;/);
  assert.doesNotMatch(action, /[0-9a-f]\{8\}-/);
  assert.match(action, /if \(!BOOKING_ID\.test\(bookingId\)\)/);
});

test("booking loader defaults to confirmed bookings sorted by latest update", async () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09" });
  const report = await loadDashboardBookings(repository({ kind: "admin" }), "signed-in-user", query);
  assert.equal(query.status, "confirmed");
  assert.equal(query.sort, "updated-desc");
  assert.equal(report.bookings.total, 1);
  assert.deepEqual(report.bookings.rows[0].agency, { id: "agency-a", name: "Agency A" });
});

test("booking route query allowlists filters and resets pagination on changes", () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "waiting", search: "  บ้านพัก  ", sort: "price-asc", page: "3" });
  assert.deepEqual(query, { month: "2026-09", status: "waiting", search: "บ้านพัก", sort: "price-asc", page: 3 });
  assert.throws(() => parseDashboardBookingsQuery({ month: "2026-09", agency: "agency-a" }));
  assert.throws(() => parseDashboardBookingsQuery({ month: "2026-09", sort: "date-asc" }));
  assert.equal(dashboardBookingsHref(query, { search: "วิลล่า" }), "/admin/dashboard/bookings?month=2026-09&status=waiting&search=%E0%B8%A7%E0%B8%B4%E0%B8%A5%E0%B8%A5%E0%B9%88%E0%B8%B2&sort=price-asc");
  assert.equal(dashboardBookingsHref(query, { page: 2 }), "/admin/dashboard/bookings?month=2026-09&status=waiting&search=%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%9E%E0%B8%B1%E0%B8%81&sort=price-asc&page=2");
});

test("booking amount filters parse baht values and exclude missing prices", async () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09", amountFrom: "100.50", amountTo: "200" });
  assert.deepEqual(query, { month: "2026-09", status: "confirmed", search: "", sort: "updated-desc", page: 1, amountFromCents: 10050, amountToCents: 20000 });
  assert.throws(() => parseDashboardBookingsQuery({ month: "2026-09", amountFrom: "201", amountTo: "200" }));
  const rows = [{ ...booking, id: "low", priceCents: 10049 }, { ...booking, id: "inside", priceCents: 15000 }, { ...booking, id: "missing", priceCents: null }];
  const report = await loadDashboardBookings(repository({ kind: "admin" }, rows), "signed-in-user", query);
  assert.deepEqual(report.bookings.rows.map(row => row.id), ["inside"]);
});

test("booking stay range takes priority over the updated month", async () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09", checkInFrom: "2026-10-01", checkInTo: "2026-10-03" });
  assert.deepEqual(query, { month: "2026-09", status: "confirmed", search: "", sort: "updated-desc", page: 1, checkInFrom: "2026-10-01", checkInTo: "2026-10-03" });
  assert.equal(dashboardBookingsHref(query), "/admin/dashboard/bookings?month=2026-09&status=confirmed&checkInFrom=2026-10-01&checkInTo=2026-10-03&sort=updated-desc");
  assert.equal(dashboardBookingsHref(query, { checkInFrom: undefined, checkInTo: undefined }), "/admin/dashboard/bookings?month=2026-09&status=confirmed&sort=updated-desc");

  const rows = [
    { ...booking, id: "stay-range", checkIn: "2026-10-02", updatedAt: "2026-08-01T00:00:00Z" },
    { ...booking, id: "updated-month", checkIn: "2026-09-02", updatedAt: "2026-09-20T00:00:00Z" },
  ] as DashboardBookingSource[];
  const report = await loadDashboardBookings(repository({ kind: "admin" }, rows), "signed-in-user", query);
  assert.deepEqual(report.bookings.rows.map(row => row.id), ["stay-range"]);
});

test("booking detail includes its saved internal note without exposing it to the list", async () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09" });
  const report = await loadDashboardBooking(repository({ kind: "admin" }, [{ ...booking, note: "เตรียมเตียงเสริม" }]), "signed-in-user", query, "1");
  assert.equal(report.detail?.kind, "booking");
  assert.equal(report.detail?.kind === "booking" ? report.detail.note : null, "เตรียมเตียงเสริม");
  assert.equal("note" in (report.bookings.rows[0] ?? {}), false);
});

test("booking detail resolves a booking reached through its check-in range", async () => {
  const row = { ...booking, id: "check-in-range", updatedAt: "2026-10-01T00:00:00Z", checkIn: "2026-09-15", checkOut: "2026-09-17" };
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "all", checkInFrom: "2026-09-01", checkInTo: "2026-09-30", sort: "updated-desc" });
  const report = await loadDashboardBooking(repository({ kind: "admin" }, [row]), "signed-in-user", query, row.id);
  assert.equal(report.detail?.kind, "booking");
  if (report.detail?.kind !== "booking") assert.fail("expected booking detail");
  assert.equal(report.detail.booking.id, row.id);
});

test("booking detail exposes its saved cost snapshot", async () => {
  const source = {
    ...booking,
    priceCents: 350000,
    depositCents: 100000,
    extraChargeCents: 25000,
    insuranceCents: 50000,
    paymentExpiresAt: "2026-09-12T03:45:00Z",
  } as DashboardBookingSource;
  const report = await loadDashboardBooking(repository({ kind: "admin" }, [source]), "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09" }), source.id);
  assert.equal(report.detail?.kind, "booking");
  assert.deepEqual(report.detail?.kind === "booking" ? report.detail.costs : null, {
    fullPriceCents: 350000,
    depositCents: 100000,
    extraChargeCents: 25000,
    insuranceCents: 50000,
    paymentExpiresAt: "2026-09-12T03:45:00Z",
  });
});

test("booking detail exposes its booking-specific operational metadata", async () => {
  const source = {
    ...booking,
    customerId: "22",
    checkInTime: "14:00:00",
    checkOutTime: "11:00:00",
    createdById: "00000000-0000-4000-8000-000000000001",
    updatedAt: "2026-09-12T03:45:00Z",
  } as DashboardBookingSource;
  const repo = repository({ kind: "admin" }, [source]);
  repo.creatorName = async (creatorId) => {
    assert.equal(creatorId, "00000000-0000-4000-8000-000000000001");
    return "ผู้ดูแลระบบ";
  };
  repo.customerDetail = async (scope, propertyId, customerId) => {
    assert.deepEqual(scope, { kind: "admin" });
    assert.equal(propertyId, "101");
    assert.equal(customerId, "22");
    return { firstName: "สมชาย", lastName: "ใจดี", title: "นาย", nationality: "ไทย", preferredLanguage: "th", vipStatus: true, phone: "081-234-5678", secondaryPhone: null, email: "somchai@example.com", lineId: "somchai.line", address: "99/99 หมู่ 1", subDistrict: "ตำบลหนองปรือ", district: "อำเภอบางละมุง", province: "ชลบุรี", postalCode: "20150", country: "ประเทศไทย", specialRequests: "ขอเตียงเสริม", notes: "ติดต่อผ่าน LINE" };
  };
  const report = await loadDashboardBooking(repo, "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09" }), "1");
  if (report.detail?.kind !== "booking") assert.fail("expected booking detail");
  assert.deepEqual({
    createdByName: report.detail.createdByName,
    checkInTime: report.detail.checkInTime,
    checkOutTime: report.detail.checkOutTime,
    customerName: report.detail.customer?.firstName,
    updatedAt: report.detail.booking.updatedAt,
  }, {
    createdByName: "ผู้ดูแลระบบ",
    checkInTime: "14:00:00",
    checkOutTime: "11:00:00",
    customerName: undefined,
    updatedAt: "2026-09-12T03:45:00Z",
  });
});

test("booking detail loads the selected house cover within the authorized scope", async () => {
  const repo = repository({ kind: "admin" });
  repo.coverImageUrl = async (scope, propertyId) => {
    assert.deepEqual(scope, { kind: "admin" });
    assert.equal(propertyId, "101");
    return "https://images.example/house-cover.jpg";
  };
  const report = await loadDashboardBooking(repo, "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09" }), "1");
  assert.equal(report.detail?.kind === "booking" ? report.detail.coverImageUrl : null, "https://images.example/house-cover.jpg");
});

test("booking customer is fetched only through its authorized deferred loader", async () => {
  const source = { ...booking, customerId: "22" } as DashboardBookingSource;
  const repo = repository({ kind: "owner", propertyId: "101" }, [source]);
  repo.customerDetail = async (scope, propertyId, customerId) => {
    assert.deepEqual(scope, { kind: "owner", propertyId: "101" });
    assert.equal(propertyId, "101");
    assert.equal(customerId, "22");
    return { firstName: "สมชาย", lastName: null, title: null, nationality: null, preferredLanguage: null, vipStatus: null, phone: "0812345678", secondaryPhone: null, email: null, lineId: null, address: null, subDistrict: null, district: null, province: null, postalCode: null, country: null, specialRequests: null, notes: null };
  };
  const customer = await loadDashboardBookingCustomer(repo, "signed-in-user", "1");
  assert.equal(customer?.firstName, "สมชาย");
});

test("booking list filters the selected updated month and approved search fields", async () => {
  const rows = [
    { ...booking, id: "updated-house", houseTitle: "บ้านริมทะเล", createdAt: "2026-08-31T23:00:00Z", updatedAt: "2026-09-25T00:00:00Z", customerFirstName: "สมชาย", customerLastName: "ใจดี" },
    { ...booking, id: "updated-customer", houseTitle: "Villa B", createdAt: "2026-08-31T23:00:00Z", updatedAt: "2026-09-20T00:00:00Z", customerFirstName: "สายใจ", customerLastName: "สุขใจ" },
    { ...booking, id: "updated-agency", houseTitle: "Villa C", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z", customerFirstName: null, customerLastName: null, agentName: "Agency North" },
    { ...booking, id: "outside-updated-month", houseTitle: "Villa D", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", customerFirstName: "เดือน", customerLastName: "ถัดไป" },
  ] as unknown as DashboardBookingSource[];
  const repo = repository({ kind: "admin" }, rows);
  for (const [search, expected] of [["บ้านริม", ["updated-house"]], ["DV-101", ["updated-house", "updated-customer", "updated-agency"]], ["สายใจ สุขใจ", ["updated-customer"]], ["agency north", ["updated-agency"]]] as const) {
    const report = await loadDashboardBookings(repo, "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", search }));
    assert.deepEqual(report.bookings.rows.map(row => row.id), expected);
  }
});

test("booking list sorts the selected confirmed rows with unpriced rows last", async () => {
  const rows = [
    { ...booking, id: "updated", checkIn: "2026-11-01", priceCents: 200, updatedAt: "2026-09-20T00:00:00Z", customerFirstName: null, customerLastName: null },
    { ...booking, id: "checkin", checkIn: "2026-12-01", priceCents: 500, updatedAt: "2026-09-10T00:00:00Z", customerFirstName: null, customerLastName: null },
    { ...booking, id: "cheap", checkIn: "2026-10-01", priceCents: 100, updatedAt: "2026-09-05T00:00:00Z", customerFirstName: null, customerLastName: null },
    { ...booking, id: "unpriced", checkIn: "2026-12-02", priceCents: null, updatedAt: "2026-09-25T00:00:00Z", customerFirstName: null, customerLastName: null },
  ] as unknown as DashboardBookingSource[];
  const repo = repository({ kind: "admin" }, rows);
  for (const [sort, expected] of [
    ["updated-desc", ["unpriced", "updated", "checkin", "cheap"]],
    ["checkin-desc", ["unpriced", "checkin", "updated", "cheap"]],
    ["price-desc", ["checkin", "updated", "cheap", "unpriced"]],
    ["price-asc", ["cheap", "updated", "checkin", "unpriced"]],
  ] as const) {
    const report = await loadDashboardBookings(repo, "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", sort }));
    assert.deepEqual(report.bookings.rows.map(row => row.id), expected);
  }
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
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name === "server-only" ? {} : name === "dashboard-auth-fixture" ? { dashboardSession: async () => ({ actorId: "signed-in-user", repository: repo }) } : name === "next/navigation" ? { ...require(name), useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
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
  assert.match(html, /<h1[^>]*>.*รายการจอง<\/h1>/);
  assert.match(html, /ตรวจสอบและจัดการรายการจอง/);
  assert.match(html, /href="\/admin\/dashboard\?month=2026-09"[^>]*>.*data-icon="inline-start".*กลับไปภาพรวม/);
  assert.match(html, /<header[^>]*>.*กลับไปภาพรวม.*<h1[^>]*>.*การจอง<\/h1>/);
  assert.match(html, /class="mx-auto w-full max-w-7xl"/);
  assert.doesNotMatch(html, /1 รายการ · ฿1,234\.50/);
  assert.doesNotMatch(html, /การจองติดจอง/);
  assert.match(html, /overflow-hidden rounded-xl border/);
  assert.match(html, /hidden overflow-hidden rounded-xl border md:block/);
  assert.match(html, /space-y-3 md:hidden/);
  assert.match(html, /rounded-xl border bg-card p-3 shadow-sm/);
  assert.doesNotMatch(html, /ยอดขายเอเจนซี่/);
  assert.match(html, /aria-label="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่"/);
  assert.match(html, /data-thai-month-picker/);
  assert.doesNotMatch(html, /type="month"[^>]*id="booking-month"/);
  assert.match(html, /id="booking-status"[^>]*role="combobox"/);
  assert.match(html, /id="booking-sort"[^>]*role="combobox"/);
  assert.match(html, /data-slot="select-value"[^>]*>จองล่าสุด/);
  assert.doesNotMatch(html, /name="agency"/);
  assert.match(html, /pb-1 md:overflow-x-auto/);
  assert.match(html, /href="\/admin\/dashboard\/bookings\/1\?month=2026-09&amp;status=confirmed&amp;sort=updated-desc"/);
});

test("canonical agency and house pages render their own workflows", async () => {
  const repo = repository({ kind: "admin" });
  const AgenciesPage = await dashboardPageComponent("../app/admin/dashboard/agencies/page.tsx", repo);
  const agenciesHtml = renderToStaticMarkup(await AgenciesPage({ searchParams: Promise.resolve({ month: "2026-09", search: "Agency" }) }) as ReactNode);
  assert.match(agenciesHtml, /class="mx-auto min-w-0 max-w-7xl space-y-5"/);
  assert.match(agenciesHtml, /<header[^>]*>.*href="\/admin\/dashboard\?month=2026-09"[^>]*>.*กลับไปภาพรวม.*<h1[^>]*>ยอดขายเอเจนซี่<\/h1>/);
  assert.equal((agenciesHtml.match(/ยอดขายเอเจนซี่/g) ?? []).length, 1);
  assert.doesNotMatch(agenciesHtml, /เฉพาะติดจอง · เรียงยอดขายสูงสุดก่อน/);
  assert.doesNotMatch(agenciesHtml, /action="\/admin\/dashboard\/agencies"/);
  assert.match(agenciesHtml, /aria-label="ค้นหาเอเจนซี่"/);
  assert.match(agenciesHtml, /data-thai-month-picker/);
  assert.match(agenciesHtml, /id="agency-sort"[^>]*role="combobox"/);
  assert.match(agenciesHtml, /data-slot="select-value"[^>]*>ยอดขายสูงสุด/);
  assert.match(agenciesHtml, /class="relative w-full"[\s\S]*lucide-search[\s\S]*aria-label="ค้นหาเอเจนซี่"/);
  assert.doesNotMatch(agenciesHtml, /type="month"[^>]*id="agency-month"/);
  assert.match(agenciesHtml, /class="hidden overflow-hidden rounded-xl border md:block"/);
  assert.match(agenciesHtml, /class="space-y-3 md:hidden"[\s\S]*rounded-xl border bg-card p-3 shadow-sm/);
  assert.match(agenciesHtml, /<table[^>]*>[\s\S]*<th[^>]*>ชื่อเอเจนซี่<\/th>[\s\S]*<th[^>]*>จำนวนการจองติดจอง<\/th>[\s\S]*<th[^>]*>ยอดขาย<\/th>/);
  assert.equal((agenciesHtml.match(/<th /g) ?? []).length, 3);
  assert.match(agenciesHtml, /Agency A[\s\S]*<td[^>]*>1<\/td>[\s\S]*<td[^>]*>฿1,234\.50<\/td>/);
  assert.doesNotMatch(agenciesHtml, /100\.0%|ของยอดขาย|h-1\.5 overflow-hidden rounded-full/);
  assert.ok(agenciesHtml.indexOf('aria-label="ค้นหาเอเจนซี่"') < agenciesHtml.indexOf("overflow-hidden rounded-xl border"));
  assert.match(agenciesHtml, /href="\/admin\/dashboard\/agencies\/agency-a\?month=2026-09&amp;search=Agency&amp;status=confirmed&amp;sort=updated-desc"/);

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
  assert.match(bookingHtml, /<header[^>]*>.*href="\/admin\/dashboard\/bookings\?month=2026-09&amp;status=confirmed&amp;sort=updated-desc"[^>]*>.*กลับไปการจอง.*<h1[^>]*>รายละเอียดการจอง<\/h1>/);
  assert.equal((bookingHtml.match(/House A · DV-101/g) ?? []).length, 1);

  const AgencyPage = await dashboardPageComponent("../app/admin/dashboard/agencies/[agencyId]/page.tsx", repo) as (props: { params: Promise<{ agencyId: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const agencyHtml = renderToStaticMarkup(await AgencyPage({ params: Promise.resolve({ agencyId: "agency-a" }), searchParams: Promise.resolve({ month: "2026-09" }) }) as ReactNode);
  assert.match(agencyHtml, /<header[^>]*>.*href="\/admin\/dashboard\/agencies\?month=2026-09"[^>]*>.*กลับไปเอเจนซี่.*<h1[^>]*>Agency A<\/h1>/);
  assert.match(agencyHtml, /<h2[^>]*>รายการจอง<\/h2>/);
  assert.match(agencyHtml, /บ้าน \/ DV.*วันเข้าพัก.*สถานะการจอง.*เอเจนซี่.*ยอดจอง/);
  assert.doesNotMatch(agencyHtml, /ดูการจองทั้งหมด/);

  const HousePage = await dashboardPageComponent("../app/admin/dashboard/houses/[id]/page.tsx", repo) as (props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const houseHtml = renderToStaticMarkup(await HousePage({ params: Promise.resolve({ id: "listing-new" }), searchParams: Promise.resolve({ month: "2026-09", search: "villa", page: "2" }) }) as ReactNode);
  assert.match(houseHtml, /<header[^>]*>.*href="\/admin\/dashboard\/houses\?month=2026-09&amp;search=villa&amp;page=2"[^>]*>.*กลับไปบ้านใหม่.*<h1[^>]*>New House<\/h1>/);
});

test("booking house links retain the full agency-origin booking detail URL", async () => {
  const BookingPage = await dashboardPageComponent("../app/admin/dashboard/bookings/[bookingId]/page.tsx", repository({ kind: "admin" })) as (props: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<unknown>;
  const html = renderToStaticMarkup(await BookingPage({
    params: Promise.resolve({ bookingId: "1" }),
    searchParams: Promise.resolve({ month: "2026-09", status: "confirmed", sort: "price-asc", checkInFrom: "2026-11-01", checkInTo: "2026-11-03", amountFrom: "1000", amountTo: "2000", fromAgency: "agency-a", agencySearch: "Agency", agencySort: "count-desc", agencyPage: "2", bookingSearch: "House", bookingsPage: "3" }),
  }) as ReactNode);
  assert.match(html, /href="\/admin\/houses\/101\?returnTo=%2Fadmin%2Fdashboard%2Fbookings%2F1%3Fmonth%3D2026-09%26status%3Dconfirmed%26search%3DHouse%26checkInFrom%3D2026-11-01%26checkInTo%3D2026-11-03%26amountFrom%3D1000%26amountTo%3D2000%26sort%3Dprice-asc%26page%3D3%26fromAgency%3Dagency-a%26agencySearch%3DAgency%26agencySort%3Dcount-desc%26agencyPage%3D2%26bookingSearch%3DHouse%26bookingsPage%3D3"/);
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
  assert.match(bookingHtml, /mx-auto min-w-0 max-w-7xl space-y-5/);
  assert.match(bookingHtml, /grid-cols-\[1\.25rem_minmax\(6\.5rem,9rem\)_minmax\(0,1fr\)\]/);
  assert.match(bookingHtml, /รหัสจอง/);
  assert.match(bookingHtml, /Agency A/);
  assert.match(bookingHtml, /ดูข้อมูลบ้าน/);
  assert.match(bookingHtml, /href="\/admin\/houses\/101\?returnTo=%2Fadmin%2Fdashboard%2Fbookings%2F1%3Fmonth%3D2026-09%26status%3Dall%26sort%3Dupdated-desc"/);

  const houseReport = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", view: "house", houseId: "listing-new" });
  const houseHtml = renderToStaticMarkup(createElement(await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx"), { report: houseReport, query: parseDashboardQuery({ month: "2026-09", view: "house", houseId: "listing-new" }) }));
  assert.match(houseHtml, /grid grid-cols-2 gap-x-4 gap-y-3/);
  assert.match(houseHtml, /ผู้เข้าพักสูงสุด/);
  assert.match(houseHtml, /เวลาเช็กอิน/);
});

test("agency detail reuses the booking toolbar and responsive list", async () => {
  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" });
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const baseQuery = parseDashboardQuery({ month: "2026-09", view: "agency", agency: "agency-a" });
  const bookingsHtml = renderToStaticMarkup(createElement(View, {
    report,
    query: baseQuery,
    agencyQuery: parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "villa", search: "Agency", page: "2", sort: "price-desc" }),
  }));
  assert.match(bookingsHtml, /name="search"[^>]*value="villa"/);
  assert.match(bookingsHtml, /aria-label="สถานะการจอง"/);
  assert.match(bookingsHtml, /aria-label="เรียงลำดับ"/);
  assert.match(bookingsHtml, /data-thai-month-picker/);
  assert.doesNotMatch(bookingsHtml, /การจอง \(1\)|บ้านยอดขายสูงสุด/);
  assert.match(bookingsHtml, /hidden overflow-hidden rounded-xl border md:block[\s\S]*<table[\s\S]*space-y-3 md:hidden/);
  assert.match(bookingsHtml, /rounded-xl border bg-card p-3 shadow-sm/);
  assert.match(bookingsHtml, /House A/);
  assert.match(bookingsHtml, /1 พ\.ย\. 2569/);
  assert.match(bookingsHtml, /฿1,234\.50/);

});

test("agency bookings use booking-list sort options before pagination", async () => {
  const rows = [
    { ...booking, id: "middle", checkIn: "2026-10-02", priceCents: 300 },
    { ...booking, id: "last", checkIn: "2026-10-03", priceCents: 100 },
    { ...booking, id: "first", checkIn: "2026-10-01", priceCents: 200 },
  ];
  const repo = repository({ kind: "admin" }, rows);
  const load = (sort: "checkin-desc" | "price-asc" | "price-desc") => loadDashboardAgency(repo, "signed-in-user", parseDashboardAgencyDetailQuery({ month: "2026-09", sort }), "agency-a");
  for (const [sort, expected] of [
    ["checkin-desc", ["last", "middle", "first"]],
    ["price-asc", ["last", "first", "middle"]],
    ["price-desc", ["middle", "first", "last"]],
  ] as const) {
    const report = await load(sort);
    assert.equal(report.detail?.kind, "agency");
    if (report.detail?.kind !== "agency") assert.fail("expected agency detail");
    assert.deepEqual(report.bookings.rows.map(row => row.id), expected);
  }
});

test("agency booking search reports when no booking matches", async () => {
  const report = await loadDashboardAgency(repository({ kind: "admin" }), "signed-in-user", parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "no matching house" }), "agency-a");
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const html = renderToStaticMarkup(createElement(View, {
    report,
    query: parseDashboardQuery({ month: "2026-09", view: "agency", agency: "agency-a" }),
    agencyQuery: parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "no matching house" }),
  }));
  assert.match(html, /role="status"[^>]*>ไม่พบการจองที่ตรงกับตัวกรอง<\/p>/);
  assert.match(html, /name="search"[^>]*value="no matching house"/);
  assert.ok(html.indexOf("ยอดขาย") < html.indexOf("ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่"));
});

test("booking filters use the Thai month picker without an agency dropdown", async () => {
  const View = await dashboardComponent("BookingsList", "../components/admin/dashboard/bookings-list.tsx");
  const raw = { month: "2026-09", view: "bookings", status: "confirmed", page: "2" };
  const report = await loadDashboard(repository({ kind: "admin" }), "signed-in-user", raw);
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", sort: "updated-desc", page: "2" });
  const html = renderToStaticMarkup(createElement(View, { report, query }));
  assert.match(html, /aria-label="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่"/);
  assert.match(html, /placeholder="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่"/);
  assert.match(html, /class="[^"]*h-8[^"]*text-sm[^"]*"[^>]*data-thai-month-picker/);
  assert.match(html, /class="[^"]*flex-1[^"]*min-w-0[^"]*"[^>]*data-thai-month-picker/);
  assert.doesNotMatch(html, /class="[^"]*min-w-(?:36|44|48)[^"]*"[^>]*data-thai-month-picker/);
  assert.doesNotMatch(html, /type="month"[^>]*id="booking-month"/);
  assert.match(html, /id="booking-status"[^>]*data-slot="select-trigger"/);
  assert.match(html, /id="booking-sort"[^>]*data-slot="select-trigger"/);
  assert.match(html, /data-slot="sheet-trigger"/);
  assert.match(html, /data-slot="sheet-trigger"[^>]*class="[^"]*px-2/);
  assert.match(html, /md:hidden/);
  assert.match(html, /id="booking-status"[^>]*class="[^"]*data-\[size=default\]:h-8/);
  assert.match(html, /id="booking-sort"[^>]*class="[^"]*data-\[size=default\]:h-8/);
  assert.doesNotMatch(html, /id="booking-status"[^>]*class="[^"]*min-w-/);
  assert.doesNotMatch(html, /id="booking-sort"[^>]*class="[^"]*min-w-/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /name="agency"/);
  assert.match(html, /pb-1 md:overflow-x-auto/);
  assert.doesNotMatch(html, /name="page"/);
  assert.doesNotMatch(html, /กลับภาพรวม/);
  assert.doesNotMatch(html, /การจองติดจอง/);
  assert.match(html, /data-dashboard-detail-link/);
  assert.doesNotMatch(html, /เอเจนซี่: Agency A/);
  assert.doesNotMatch(html, /รายการ ·/);
  assert.doesNotMatch(html, /ยอดขายเอเจนซี่/);
  assert.match(html, /บ้าน \/ DV/);
  assert.match(html, /<th[^>]*>สถานะการจอง<\/th>/);
  assert.equal((html.match(/data-dashboard-booking-status/g) ?? []).length, 2);
  assert.doesNotMatch(html, /บ้าน \/ DV \/ รหัสจอง/);
  assert.match(html, /เอเจนซี่/);
  assert.match(html, /<table/);
  assert.match(html, /฿1,234\.50/);
  assert.doesNotMatch(html, /กดรายการเพื่อดูรายละเอียด/);
  assert.doesNotMatch(html, /รหัสเอเจนซี่/);
});

test("booking advanced filters keep mobile status and sort controls in the sheet", async () => {
  const View = await dashboardComponent("DashboardBookingAdvancedFiltersPanel", "../components/admin/dashboard/dashboard-booking-filters.tsx");
  const html = renderToStaticMarkup(createElement(View, {
    onClose() {},
    onFiltersApply() {},
    query: parseDashboardBookingsQuery({ month: "2026-09" }),
    showBookingControls: true,
  }));

  assert.match(html, /ตัวกรองเพิ่มเติม/);
  assert.ok(html.includes("ช่วงยอดจอง (บาท)"));
  assert.match(html, /aria-label="ยอดจองต่ำสุด"/);
  assert.match(html, /aria-label="ยอดจองสูงสุด"/);
  assert.match(html, /ช่วงวันที่เข้าพัก/);
  assert.match(html, /aria-label="ช่วงวันที่เข้าพัก"/);
  assert.match(html, /id="mobile-booking-status"/);
  assert.match(html, /id="mobile-booking-sort"/);
  assert.match(html, /สถานะการจอง/);
  assert.match(html, /เรียงลำดับ/);
  assert.doesNotMatch(html, /type="date"|type="number"/);
  assert.match(html, /ล้างค่า/);
  assert.match(html, /ใช้ตัวกรอง/);
  assert.doesNotMatch(html, /บ้าน \/ โครงการ|ประเภทบ้าน|ช่องทางการจอง|สถานะการชำระเงิน|จำนวนต่อหน้า|เฉพาะรายการ/);
});

test("booking pager reports nine rows per page", async () => {
  const DashboardPager = await dashboardComponent("DashboardPager", "../components/admin/dashboard/dashboard-list-primitives.tsx");
  const html = renderToStaticMarkup(createElement(DashboardPager, {
    page: 1,
    pages: 2,
    total: 10,
    pageSize: 9,
    href: () => "#",
  }));

  assert.match(html, /1–9 จาก 10 รายการ/);
});

test("dashboard detail primitives preserve responsive slots and summary framing", async () => {
  const DashboardDetailLayout = await dashboardComponent("DashboardDetailLayout", "../components/admin/dashboard/dashboard-detail-layout.tsx");
  const DashboardSummaryCard = await dashboardComponent("DashboardSummaryCard", "../components/admin/dashboard/dashboard-summary-card.tsx");
  const summary = createElement(DashboardSummaryCard, { title: "สรุปตัวอย่าง", status: createElement("span", null, "ติดจอง") }, "ข้อมูลสรุป");
  const html = renderToStaticMarkup(createElement(DashboardDetailLayout, {
    desktopContent: createElement("p", null, "เนื้อหา desktop"),
    desktopHeader: createElement("p", null, "หัวข้อ desktop"),
    desktopSummary: summary,
    mobileContent: createElement("p", null, "เนื้อหา mobile"),
    mobileHeader: createElement("p", null, "หัวข้อ mobile"),
    mobileSummary: createElement("p", null, "สรุป mobile"),
    tabs: createElement("p", null, "แท็บตัวอย่าง"),
  }));
  assert.match(html, /mx-auto min-w-0 max-w-7xl space-y-5/);
  assert.match(html, /หัวข้อ mobile[\s\S]*สรุป mobile[\s\S]*แท็บตัวอย่าง[\s\S]*เนื้อหา mobile/);
  assert.match(html, /หัวข้อ desktop[\s\S]*แท็บตัวอย่าง[\s\S]*เนื้อหา desktop[\s\S]*สรุปตัวอย่าง[\s\S]*ติดจอง[\s\S]*ข้อมูลสรุป/);
});

test("dashboard tabs render only enabled selectable sections", async () => {
  const DashboardTabs = await dashboardComponent("DashboardTabs", "../components/admin/dashboard/dashboard-tabs.tsx");
  const html = renderToStaticMarkup(createElement(DashboardTabs, {
    ariaLabel: "แท็บตัวอย่าง",
    onValueChange() {},
    tabs: [
      { icon: TicketCheckIcon, label: "ข้อมูลการจอง", value: "booking" },
      { icon: CircleUserRoundIcon, label: "ข้อมูลลูกค้า", value: "customer" },
      { icon: CreditCardIcon, label: "ค่าใช้จ่าย", value: "costs" },
    ],
    value: "customer",
  }));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.match(html, /ข้อมูลการจอง/);
  assert.match(html, /ข้อมูลลูกค้า/);
  assert.match(html, /ค่าใช้จ่าย/);
  assert.match(html, /aria-selected="true"[^>]*>.*ข้อมูลลูกค้า/);
  assert.doesNotMatch(html, /disabled=""|เอกสาร|ประวัติการเปลี่ยนแปลง/);
});

test("booking detail composes the shared dashboard primitives", () => {
  const source = readFileSync(fileURLToPath(new URL("../components/admin/dashboard/dashboard-details.tsx", import.meta.url)), "utf8");
  assert.match(source, /import \{ DashboardDetailLayout \} from "\.\/dashboard-detail-layout"/);
  assert.match(source, /import \{ DashboardSummaryCard \} from "\.\/dashboard-summary-card"/);
  assert.match(source, /import \{ DashboardTabs \} from "\.\/dashboard-tabs"/);
  assert.match(source, /<DashboardDetailLayout/);
});

test("booking filters compose the shared dashboard list toolbar", () => {
  const source = readFileSync(fileURLToPath(new URL("../components/admin/dashboard/dashboard-booking-filters.tsx", import.meta.url)), "utf8");
  assert.match(source, /import \{ DashboardListToolbar \} from "\.\/dashboard-list-toolbar"/);
  assert.match(source, /<DashboardListToolbar onSubmit=\{submit\}>/);
});

test("booking detail exposes operational fields but repair has no monetary amount", async () => {
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const raw = { month: "2026-09", view: "booking", bookingId: "1" };
  const repo = repository({ kind: "admin" }, [{ ...booking, customerId: "22", note: "เตรียมเตียงเสริม", status: "repair", checkInTime: "14:00:00", checkOutTime: "11:00:00" }]);
  repo.coverImageUrl = async () => "https://images.example/house-cover.jpg";
  repo.customerDetail = async () => ({ firstName: "สมชาย", lastName: "ใจดี", title: "นาย", nationality: "ไทย", preferredLanguage: "th", vipStatus: true, phone: "081-234-5678", secondaryPhone: null, email: "somchai@example.com", lineId: "somchai.line", address: "99/99 หมู่ 1", subDistrict: null, district: null, province: "ชลบุรี", postalCode: "20150", country: "ประเทศไทย", specialRequests: "ขอเตียงเสริม", notes: "ติดต่อผ่าน LINE" });
  const report = await loadDashboardBooking(repo, "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09" }), "1");
  const html = renderToStaticMarkup(createElement(View, { report, query: parseDashboardQuery(raw) }));
  assert.match(html, /ปิดซ่อม\/ปรับปรุง/);
  assert.match(html, /เช็กเอาต์/);
  assert.match(html, /วันที่สร้าง/);
  assert.match(html, /Agency A/);
  assert.match(html, /ยอดจอง<\/dt><dd[^>]*>—/);
  assert.match(html, /<header[^>]*>.*กลับไปหน้าก่อนหน้า.*<h1[^>]*>รายละเอียดการจอง<\/h1>/);
  assert.match(html, /ข้อมูลการจอง/);
  assert.match(html, /ข้อมูลลูกค้า/);
  assert.match(html, /ค่าใช้จ่าย/);
  assert.match(html, /ค่าบ้านเต็มจำนวน/);
  assert.match(html, /มัดจำที่ต้องชำระ/);
  assert.match(html, /ค่าใช้จ่ายเพิ่ม/);
  assert.match(html, /ประกันที่พัก/);
  assert.doesNotMatch(html, /เอกสาร/);
  assert.doesNotMatch(html, /ประวัติการเปลี่ยนแปลง/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(html, /สรุปการจอง/);
  assert.match(html, /data-dashboard-booking-mobile-summary/);
  assert.match(html, /<dl data-dashboard-booking-mobile-timestamps/);
  assert.match(html, /data-dashboard-booking-mobile-tabs/);
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /lg:hidden/);
  assert.match(html, /1 พ\.ย\. 2569 · 14:00/);
  assert.match(html, /3 พ\.ย\. 2569 · 11:00/);
  assert.match(html, /!flex items-center justify-between/);
  assert.match(html, /data-dashboard-booking-cover/);
  assert.match(html, /ดูข้อมูลบ้าน/);
  assert.match(html, /href="\/admin\/houses\/101\?returnTo=/);
  assert.match(html, /lg:grid-cols-\[minmax\(0,1fr\)_20rem\]/);
  assert.match(html, /หมายเหตุ/);
  assert.match(html, /data-dashboard-booking-customer-loading/);
  assert.doesNotMatch(html, /สมชาย/);
  assert.match(html, /เตรียมเตียงเสริม/);
  assert.match(html, /ช่องทางการจอง/);
  assert.doesNotMatch(html, />จำนวน<\/dt>/);
  assert.doesNotMatch(html, />แก้ไข</);
  assert.doesNotMatch(html, /1,234/);
});

test("agency list sorts aggregate sales, bookings, and names", async () => {
  const rows = [
    { ...booking, id: "sales", agentId: "sales", agentName: "Sales", priceCents: 900 },
    { ...booking, id: "count-1", agentId: "count", agentName: "Count", priceCents: 200 },
    { ...booking, id: "count-2", agentId: "count", agentName: "Count", priceCents: 200 },
    { ...booking, id: "alpha", agentId: "alpha", agentName: "Alpha", priceCents: 100 },
  ];
  const repo = repository({ kind: "admin" }, rows);
  const load = (agencySort: "sales-desc" | "count-desc" | "name-asc") => loadDashboardAgencies(repo, "signed-in-user", { month: "2026-09", search: "", page: 1, agencySort });
  assert.deepEqual((await load("sales-desc")).admin?.agencies.rows.map(agency => agency.name), ["Sales", "Count", "Alpha"]);
  assert.deepEqual((await load("count-desc")).admin?.agencies.rows.map(agency => agency.name), ["Count", "Alpha", "Sales"]);
  assert.deepEqual((await load("name-asc")).admin?.agencies.rows.map(agency => agency.name), ["Alpha", "Count", "Sales"]);
});

test("agency chart labels remove seeded demo prefixes", () => {
  assert.equal(dashboardAgencyChartLabel("[DEMO LARGE 2026-09] พูลวิลล่าแฟมิลี่"), "พูลวิลล่าแฟมิลี่");
  assert.equal(dashboardAgencyChartLabel("เอเจนซี่ชื่อยาวมากเกินกว่าพื้นที่แสดงผล"), "เอเจนซี่ชื่อยาวมากเกินก…");
});

test("house workspace return links allow dashboard detail routes and reject external destinations", () => {
  assert.equal(safeHouseReturnTo("/admin/dashboard/houses/listing-new?month=2026-09&search=villa&page=2"), "/admin/dashboard/houses/listing-new?month=2026-09&search=villa&page=2");
  assert.equal(safeHouseReturnTo("/admin/dashboard/bookings/1?month=2026-09&status=confirmed&sort=updated-desc"), "/admin/dashboard/bookings/1?month=2026-09&status=confirmed&sort=updated-desc");
  assert.equal(safeHouseReturnTo("/admin/houses?page=2&q=villa"), "/admin/houses?page=2&q=villa");
  assert.equal(safeHouseReturnTo("https://evil.example"), null);
  assert.equal(safeHouseReturnTo("//evil.example/admin/dashboard/houses/listing-new"), null);
  assert.equal(safeHouseReturnTo("/admin/dashboard/houses/id/extra"), null);
});

test("agency booking links retain the selected booking-list month", async () => {
  const View = await dashboardComponent("DashboardDetails", "../components/admin/dashboard/dashboard-details.tsx");
  const raw = { month: "2026-09", view: "agency", agency: "agency-a" };
  const report = await loadDashboard(repository({ kind: "admin" }, [{ ...booking, createdAt: "2026-08-01T00:00:00Z" }]), "signed-in-user", raw);
  const html = renderToStaticMarkup(createElement(View, { report, query: parseDashboardQuery(raw) }));
  assert.match(html, /href="\/admin\/dashboard\/bookings\/1\?month=2026-09&amp;status=confirmed&amp;sort=updated-desc&amp;fromAgency=agency-a&amp;bookingSearch="/);
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
  assert.match(html, /href="\/admin\/dashboard\/bookings\/1\?month=2026-09&amp;status=confirmed&amp;sort=updated-desc&amp;fromAgency=agency-a&amp;agencyPage=2&amp;bookingSearch="/);
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
    async report(_actor, query) { assert.ok(scope); return dashboardReportFixture(scope, rows, query); },
    async bookingCustomer(actualScope, bookingId) {
      assert.deepEqual(actualScope, scope);
      const row = rows.find(candidate => candidate.id === bookingId);
      return row ? { propertyId: row.propertyId, customerId: row.customerId } : null;
    },
    async coverImageUrl() { return null; },
    async creatorName() { return null; },
    async customerDetail() { return null; },
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
  repo.report = async () => { assert.fail("denied identity queried bookings"); };
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
  rows.push({ ...booking, id: "26", updatedAt: "2026-08-31T17:00:00Z", priceCents: 100 });
  rows.push({ ...booking, id: "27", updatedAt: "2026-09-30T17:00:00Z", priceCents: 99999 });
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", page: "999" });
  assert.equal(report.sales.amountCents, 2600);
  assert.equal(report.bookings.total, 26);
  assert.equal(report.bookings.page, 3);
  assert.equal(report.bookings.rows.length, 8);
});

test("dashboard booking module shows nine bookings per page", async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({ ...booking, id: `booking-page-${index + 1}` }));
  const firstPage = await loadDashboardBookings(repository({ kind: "admin" }, rows), "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09", page: "1" }));
  const secondPage = await loadDashboardBookings(repository({ kind: "admin" }, rows), "signed-in-user", parseDashboardBookingsQuery({ month: "2026-09", page: "2" }));

  assert.equal(firstPage.bookings.pages, 2);
  assert.equal(firstPage.bookings.rows.length, 9);
  assert.equal(secondPage.bookings.rows.length, 1);
});

test("status filtering precedes pagination and never changes monthly sales or counts", async () => {
  const rows = [booking, ...Array.from({ length: 23 }, (_, i) => ({ ...booking, id: `wait-${i}`, status: "waiting" }))];
  const report = await loadDashboard(repository({ kind: "admin" }, rows), "signed-in-user", { month: "2026-09", status: "waiting", page: "2" });
  assert.equal(report.bookingCount, 24);
  assert.equal(report.statusCounts.waiting, 23);
  assert.equal(report.bookings.total, 23);
  assert.equal(report.bookings.rows.length, 9);
  assert.ok(report.bookings.rows.every(row => row.status === "waiting"));
  assert.equal(report.sales.amountCents, 123450);
});

test("search and agency drilldown preserve totals and owner isolation", async () => {
  const rows = [booking, { ...booking, id: "2", houseTitle: "OTHER", agentId: null, status: null }];
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
  assert.equal(report.bookings.rows.length, 7);
  assert.ok(report.bookings.rows.every(row => row.status === "waiting"));
  assert.equal(report.overview.confirmedBookingsByDay.length, 30);
});

test("dashboard provides one confirmed-booking chart point for every day in the selected month", async () => {
  const rows: DashboardBookingSource[] = Array.from({ length: 30 }, (_, index) => ({
    ...booking,
    id: `daily-${index + 1}`,
    updatedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
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

test("agency detail shows confirmed counts and sales while filtering the fixed agency", async () => {
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
  const query = parseDashboardAgencyDetailQuery({ month: "2026-09", status: "all", bookingSearch: "House", sort: "price-desc" });
  const report = await loadDashboardAgency(repository({ kind: "admin" }, rows), "signed-in-user", query, "agency-a");
  assert.equal(report.detail?.kind, "agency");
  if (report.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(report.detail.agency.count, 12);
  assert.equal(report.detail.agency.amountCents, 7800);
  assert.equal(report.bookings.total, 13);
  assert.equal(report.bookings.page, 1);
  assert.equal(report.bookings.rows.length, 9);
  assert.ok(report.bookings.rows.some(row => row.id === "agency-waiting"));
  assert.ok(report.bookings.rows.every(row => row.agency?.id === "agency-a"));
});

test("repository reads dashboard customer details only for the booking house and excludes sensitive identifiers", async () => {
  let calls = 0;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    calls++;
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/customers");
    assert.equal(url.searchParams.get("dv_id"), "eq.101");
    assert.equal(url.searchParams.get("id"), "eq.22");
    assert.doesNotMatch(url.searchParams.get("select") ?? "", /id_card_no|passport_no|tax_id/);
    return new Response(JSON.stringify({ first_name: "สมชาย", last_name: "ใจดี", title: null, nationality: "ไทย", preferred_language: "th", vip_status: true, phone: "0812345678", secondary_phone: null, email: null, line_id: null, address: null, sub_district: null, district: null, province: null, postal_code: null, country: null, special_requests: null, notes: null }), { headers: { "Content-Type": "application/json" } });
  } } });
  const repository = createDashboardRepository(client);
  const customer = await repository.customerDetail({ kind: "owner", propertyId: "101" }, "101", "22");
  assert.equal(customer?.firstName, "สมชาย");
  assert.equal(await repository.customerDetail({ kind: "owner", propertyId: "101" }, "202", "22"), null);
  assert.equal(calls, 1);
});

test("repository falls back to the first house image when no cover is selected", async () => {
  let calls = 0;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/images");
    assert.equal(url.searchParams.get("property_id"), "eq.101");
    calls++;
    if (calls === 1) {
      assert.deepEqual(url.searchParams.getAll("cover_select"), ["gte.1", "lte.10"]);
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }
    assert.equal(url.searchParams.get("order"), "image_move.asc,id.asc");
    return new Response(JSON.stringify({
      image_name: "first-house-image.jpg",
      image_url: "https://s3.ap-southeast-1.amazonaws.com/example-bucket/first-house-image.jpg",
    }), { headers: { "Content-Type": "application/json" } });
  } } });
  const imageUrl = await createDashboardRepository(client).coverImageUrl({ kind: "admin" }, "101");
  assert.equal(imageUrl, "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/first-house-image.jpg");
  assert.equal(calls, 2);
});

test("repository routes a legacy S3 cover image through the image proxy", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/images");
    assert.match(url.searchParams.get("select") ?? "", /image_name/);
    return new Response(JSON.stringify({
      image_name: "legacy-cover.webp",
      image_url: "https://s3.ap-southeast-1.amazonaws.com/example-bucket/legacy-cover.webp",
    }), { headers: { "Content-Type": "application/json" } });
  } } });

  assert.equal(
    await createDashboardRepository(client).coverImageUrl({ kind: "admin" }, "101"),
    "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/legacy-cover.webp",
  );
});

test("repository uses the house cover zone before card-cover selections", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    assert.equal(url.pathname, "/rest/v1/images");
    assert.equal(url.searchParams.get("image_zone"), "eq.cover");
    assert.equal(url.searchParams.get("order"), "image_move.asc,id.asc");
    return new Response(JSON.stringify({
      image_name: "cover-zone.jpg",
      image_url: "https://s3.ap-southeast-1.amazonaws.com/example-bucket/cover-zone.jpg",
    }), { headers: { "Content-Type": "application/json" } });
  } } });

  assert.equal(
    await createDashboardRepository(client).coverImageUrl({ kind: "admin" }, "9"),
    "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/cover-zone.jpg",
  );
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
    await assert.rejects(createDashboardRepository(client).report("signed-in-user", { month: "2026-09" }));
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
    assert.match(html, /จำนวนการจองเดือนนี้/);
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
    assert.equal(html.includes("ยอดขายเอเจนซี่สูงสุด 5 อันดับ"), scope.kind === "admin");
    assert.equal(html.includes("บ้านใหม่เดือนนี้"), scope.kind === "admin");
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
