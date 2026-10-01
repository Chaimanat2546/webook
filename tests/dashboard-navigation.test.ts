import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDashboardQuery } from "../lib/dashboard.ts";
import { dashboardBackHref, dashboardHref } from "../lib/dashboard-navigation.ts";
import { dashboardNights, dashboardShare } from "../lib/dashboard-calculations.ts";
import { dashboardAgenciesHref, dashboardAgencyDetailHref, dashboardBookingDetailHref, dashboardHousesHref, dashboardBookingsHref, parseDashboardAgenciesQuery, parseDashboardAgencyDetailQuery, parseDashboardBookingsQuery, parseDashboardHousesQuery } from "../lib/dashboard-routes.ts";

test("dashboard booking routes retain only booking filters", () => {
  const query = parseDashboardBookingsQuery({ month: "2026-09", status: "confirmed", search: "DV-101", agency: "agency-a", page: "2" });
  assert.deepEqual(query, { month: "2026-09", status: "confirmed", search: "DV-101", agency: "agency-a", page: 2 });
  assert.equal(dashboardBookingsHref(query, { month: "2026-10" }), "/admin/dashboard/bookings?month=2026-10");
  assert.equal(dashboardBookingDetailHref(query, "booking/1"), "/admin/dashboard/bookings/booking%2F1?month=2026-09&status=confirmed&search=DV-101&agency=agency-a&page=2");
  assert.throws(() => parseDashboardBookingsQuery({ month: "2026-09", housesPage: "2" }));
});
test("dashboard agency and house routes reject booking state", () => {
  assert.deepEqual(parseDashboardAgenciesQuery({ month: "2026-09", search: "trip", page: "2" }), { month: "2026-09", search: "trip", page: 2 });
  assert.deepEqual(parseDashboardHousesQuery({ month: "2026-09", search: "sea", page: "3" }), { month: "2026-09", search: "sea", page: 3 });
  assert.equal(dashboardAgenciesHref({ month: "2026-09", search: "trip", page: 2 }, { search: "" }), "/admin/dashboard/agencies?month=2026-09");
  assert.equal(dashboardHousesHref({ month: "2026-09", search: "sea", page: 3 }, { month: "2026-10" }), "/admin/dashboard/houses?month=2026-10");
  assert.throws(() => parseDashboardAgenciesQuery({ month: "2026-09", status: "confirmed" }));
  assert.throws(() => parseDashboardAgenciesQuery({ month: "2026-09", bookingSearch: "DV-101" }));
  assert.throws(() => parseDashboardHousesQuery({ month: "2026-09", agency: "agency-a" }));
});

test("agency detail retains month, sort, search, and booking pagination", () => {
  const query = parseDashboardAgencyDetailQuery({ month: "2026-09", search: "trip", page: "2", bookingSearch: "DV-201", bookingsPage: "3", sort: "price-asc" });
  assert.deepEqual(query, { month: "2026-09", search: "trip", page: 2, bookingSearch: "DV-201", bookingsPage: 3, sort: "price-asc" });
  assert.equal(dashboardAgencyDetailHref(query, "agency-a", { bookingsPage: 4 }), "/admin/dashboard/agencies/agency-a?month=2026-09&search=trip&page=2&bookingSearch=DV-201&sort=price-asc&bookingsPage=4");
  assert.equal(dashboardAgencyDetailHref({ ...query, month: "2026-10", sort: "date-asc", bookingsPage: 1 }, "agency-a"), "/admin/dashboard/agencies/agency-a?month=2026-10&search=trip&page=2&bookingSearch=DV-201");
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", bookingsPage: "0" }));
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", bookingsPage: ["2", "3"] }));
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: ["DV-1"] }));
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", bookingSearch: "x".repeat(201) }));
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", sort: "amount" }));
  assert.throws(() => parseDashboardAgencyDetailQuery({ month: "2026-09", section: "houses" }));
  assert.throws(() => parseDashboardAgenciesQuery({ month: "2026-09", bookingsPage: "2" }));
});

test("dashboard query defaults to an overview and allows only the seven report views", () => {
  const now = new Date("2026-09-30T17:00:00.000Z");
  assert.equal(parseDashboardQuery({}, now).view, "overview");
  for (const view of ["overview", "bookings", "agencies", "houses", "booking", "agency", "house"] as const) {
    assert.equal(parseDashboardQuery({ view, bookingId: "booking-1", agency: "agency-1", houseId: "house-1" }, now).view, view);
  }
  assert.equal(parseDashboardQuery({ status: "waiting" }, now).view, "bookings");
  assert.equal(parseDashboardQuery({ housesPage: "2" }, now).view, "houses");
  for (const raw of [
    { view: "unknown" },
    { view: ["overview"] },
    { view: "booking" },
    { view: "booking", bookingId: ["booking-1"] },
    { view: "agency" },
    { view: "house", houseId: "" },
  ]) {
    assert.throws(() => parseDashboardQuery(raw, now));
  }
});

test("dashboard links retain an allowlisted booking source and never use a return URL", () => {
  const query = parseDashboardQuery({ month: "2026-09", view: "bookings", status: "waiting", search: "DV-101", page: "2" });
  const detailHref = dashboardHref(query, { view: "booking", from: "bookings", bookingId: "booking-1" });
  assert.equal(detailHref, "/admin/dashboard?month=2026-09&view=booking&from=bookings&bookingId=booking-1&status=waiting&search=DV-101&page=2");
  const detail = parseDashboardQuery({ month: "2026-09", view: "booking", from: "bookings", bookingId: "booking-1", status: "waiting", search: "DV-101", page: "2", returnUrl: "https://attacker.example" });
  assert.equal(dashboardBackHref(detail), "/admin/dashboard?month=2026-09&view=bookings&status=waiting&search=DV-101&page=2");
  const direct = parseDashboardQuery({ month: "2026-09", view: "booking", bookingId: "booking-1" });
  assert.equal(dashboardBackHref(direct), "/admin/dashboard?month=2026-09");
});

test("agency detail Back drops the selected detail ID while preserving source search and page", () => {
  const detail = parseDashboardQuery({ month: "2026-09", view: "agency", from: "agencies", agency: "agency-a", agencySearch: "trip", agenciesPage: "2" });
  assert.equal(dashboardBackHref(detail), "/admin/dashboard?month=2026-09&view=agencies&agencySearch=trip&agenciesPage=2");
  const source = parseDashboardQuery({ month: "2026-09", view: "agencies", agency: "irrelevant-booking-filter", agencySearch: "trip", agenciesPage: "2" });
  assert.equal(dashboardHref(source), "/admin/dashboard?month=2026-09&view=agencies&agencySearch=trip&agenciesPage=2");
});

test("dashboard links reset the affected list page and reset detail selection for a new month", () => {
  const query = parseDashboardQuery({ month: "2026-09", view: "bookings", status: "waiting", search: "villa", page: "3", agenciesPage: "4", houseSearch: "sea", housesPage: "5" });
  assert.equal(dashboardHref(query, { status: "cancelled" }), "/admin/dashboard?month=2026-09&view=bookings&status=cancelled&search=villa&agenciesPage=4&houseSearch=sea&housesPage=5");
  assert.equal(dashboardHref(query, { agencySearch: "trip" }), "/admin/dashboard?month=2026-09&view=bookings&status=waiting&search=villa&agencySearch=trip&page=3&houseSearch=sea&housesPage=5");
  assert.equal(dashboardHref(query, { month: "2026-10" }), "/admin/dashboard?month=2026-10");
  assert.equal(dashboardHref(query, { status: "waiting" }), "/admin/dashboard?month=2026-09&view=bookings&status=waiting&search=villa&page=3&agenciesPage=4&houseSearch=sea&housesPage=5");
});

test("dashboard share and nights use safe integer and date-only calculations", () => {
  assert.equal(dashboardShare(2500, 10000), 25);
  assert.equal(dashboardShare(2500, 0), null);
  assert.equal(dashboardNights("2026-09-30", "2026-10-02"), 2);
  assert.equal(dashboardNights("2028-02-28", "2028-03-01"), 2);
  for (const [checkIn, checkOut] of [["2026-02-30", "2026-03-01"], ["2026-10-02", "2026-10-02"], ["2026-10-02", "2026-10-01"], ["2026-10-02T00:00:00Z", "2026-10-03"]] as const) {
    assert.equal(dashboardNights(checkIn, checkOut), null);
  }
});
