import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDashboardQuery } from "../lib/dashboard.ts";
import { dashboardBackHref, dashboardHref } from "../lib/dashboard-navigation.ts";
import { dashboardNights, dashboardShare } from "../lib/dashboard-calculations.ts";
import { dashboardReturnState } from "../lib/dashboard-return.ts";

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

test("explicit return restores only its exact source and requires pending navigation", () => {
  const source = "/admin/dashboard?month=2026-09&view=bookings&status=waiting&page=2";
  const state = { sourceHref: source, detailHref: "/admin/dashboard?month=2026-09&view=booking&bookingId=1", originId: "dashboard-booking-1", scrollTop: 480, pending: true };
  assert.deepEqual(dashboardReturnState(JSON.stringify(state), source), state);
  assert.equal(dashboardReturnState(JSON.stringify(state), source.replace("page=2", "page=3")), null);
  assert.equal(dashboardReturnState(JSON.stringify({ ...state, pending: false }), source), null);
  assert.equal(dashboardReturnState(JSON.stringify({ ...state, sourceHref: "https://evil.example" }), source), null);
  assert.equal(dashboardReturnState("broken", source), null);
  assert.deepEqual(dashboardReturnState(JSON.stringify(state), "/admin/dashboard?page=2&view=bookings&month=2026-09&status=waiting&search="), state);
});
