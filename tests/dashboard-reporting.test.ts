import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createDashboardRepository } from "../server/repositories/dashboard.ts";
import type { DashboardRepository } from "../server/repositories/dashboard.ts";
import { loadDashboardOverview, loadDashboardBookings, loadDashboardAgency, loadDashboardBooking, DashboardForbidden } from "../server/services/dashboard.ts";
import { parseDashboardReportingResult } from "../server/repositories/dashboard-reporting.ts";

export const reportFixture = {
  bookingCount: 20000, statusCounts: { confirmed: 15000, waiting: 5000, cancelled: 0, repair: 0, unknown: 0 },
  sales: { count: 15000, amountCents: 1234500, missingPrices: 2 }, totalSalesCents: 2469000,
  daily: [{ date: "2026-09-10", count: 15000 }],
  bookings: { rows: [{ id: "238", code: "BK238", propertyId: "101", houseTitle: "House A", checkIn: "2026-11-01", checkOut: "2026-11-02", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z", status: "confirmed", priceCents: 123450, agentId: null, agentName: "ไม่ระบุเอเจนซี่" }], total: 1, page: 1, pages: 1 },
  bookingDetail: null, agencies: { rows: [{ id: null, name: "ไม่ระบุเอเจนซี่", count: 15000, amountCents: 1234500, missingPrices: 2 }], total: 1, page: 1, pages: 1 },
  selectedAgency: null, agencyCount: 1, topAgencies: [{ id: null, name: "ไม่ระบุเอเจนซี่", count: 15000, amountCents: 1234500, missingPrices: 2 }],
};
test("repository requests one bounded RPC and preserves pre-filter metrics", async () => {
  let calls = 0;
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, "/rest/v1/rpc/dashboard_report");
    assert.deepEqual(await request.json(), { p_actor: "signed-in-user", p_query: { month: "2026-09", status: "waiting", page: 3, pageSize: 9 } });
    calls++;
    return Response.json(reportFixture);
  } } });
  const result = await createDashboardRepository(client).report("signed-in-user", { month: "2026-09", status: "waiting", page: 3, pageSize: 9 });
  assert.equal(calls, 1);
  assert.equal(result.bookingCount, 20000);
  assert.equal(result.bookings.rows[0].priceCents, 123450);
  assert.deepEqual(result.sales, { count: 15000, amountCents: 1234500, missingPrices: 2 });
  assert.equal(result.agencies.rows[0].count, 15000);
  assert.equal(result.daily[0].count, 15000);
});
test("repository rejects malformed, overflowing or unbounded RPC results", async () => {
  for (const data of [null, {}, { ...reportFixture, sales: { ...reportFixture.sales, amountCents: Number.MAX_SAFE_INTEGER + 1 } }, { ...reportFixture, bookings: { ...reportFixture.bookings, rows: Array(101).fill(reportFixture.bookings.rows[0]) } }]) {
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => Response.json(data) } });
    await assert.rejects(createDashboardRepository(client).report("signed-in-user", { month: "2026-09" }), /dashboard_invalid/);
  }
});

function serviceRepository(): DashboardRepository {
  return {
    access: async () => ({ kind: "admin" }),
    report: async () => parseDashboardReportingResult(reportFixture),
    newHouses: async () => [], bookingCustomer: async () => null,
    coverImageUrl: async () => null, creatorName: async () => null, customerDetail: async () => null,
    houseDetail: async () => null,
  };
}
test("overview and booking workflows consume database totals instead of page rows", async () => {
  const repo = serviceRepository();
  repo.report = async (actor, query) => {
    assert.equal(actor, "signed-in-user");
    assert.equal(query.month, "2026-09");
    assert.equal(query.pageSize, 9);
    return parseDashboardReportingResult(reportFixture);
  };
  for (const result of [await loadDashboardOverview(repo, "signed-in-user", { month: "2026-09" }), await loadDashboardBookings(repo, "signed-in-user", { month: "2026-09", status: "waiting", search: "x", sort: "price-asc", page: 2 })]) {
    assert.equal(result.bookingCount, 20000);
    assert.equal(result.sales.amountCents, 1234500);
    assert.equal(result.overview.confirmedBookingsByDay[0].count, 15000);
  }
});
test("agency detail uses one fixed-agency request for filtered page and unfiltered summary", async () => {
  const repo = serviceRepository(); let calls = 0;
  repo.report = async (_actor, query) => {
    calls++;
    assert.equal(query.agency, "unassigned");
    assert.equal(query.search, "House");
    assert.equal(query.status, "waiting");
    assert.equal(query.checkInFrom, "2026-11-01");
    assert.equal(query.checkInTo, "2026-11-03");
    return parseDashboardReportingResult({ ...reportFixture, selectedAgency: reportFixture.agencies.rows[0] });
  };
  const result = await loadDashboardAgency(repo, "signed-in-user", { month: "2026-09", status: "waiting", search: "", bookingSearch: "House", page: 1, bookingsPage: 1, sort: "updated-desc", checkInFrom: "2026-11-01", checkInTo: "2026-11-03" }, "unassigned");
  assert.equal(calls, 1);
  assert.equal(result.detail?.kind, "agency");
  if (result.detail?.kind !== "agency") assert.fail();
  assert.equal(result.detail.agency.count, 15000);
  assert.equal(result.detail.sharePercent, 50);
  assert.equal(result.detail.bookings.total, result.bookings.total);
});
test("booking details use a scoped detail independent of page/status/search", async () => {
  const repo = serviceRepository();
  repo.report = async (_actor, query) => {
    assert.equal(query.bookingId, "238");
    return parseDashboardReportingResult({ ...reportFixture, bookings: { rows: [], total: 0, page: 1, pages: 1 }, bookingDetail: { ...reportFixture.bookings.rows[0], note: "internal" } });
  };
  const result = await loadDashboardBooking(repo, "signed-in-user", { month: "2026-09", status: "waiting", search: "unmatched", sort: "updated-desc", page: 99 }, "238");
  assert.equal(result.detail?.kind === "booking" ? result.detail.note : null, "internal");
});
test("denied users never execute the reporting RPC", async () => {
  const repo = serviceRepository(); repo.access = async () => null;
  repo.report = async () => assert.fail("unauthorized RPC");
  await assert.rejects(loadDashboardOverview(repo, "denied", { month: "2026-09" }), DashboardForbidden);
});
