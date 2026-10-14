import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDashboardQuery } from "../lib/dashboard.ts";
import { parseDashboardBookingsQuery, parseDashboardAgenciesQuery, parseDashboardHousesQuery, dashboardBookingsHref, dashboardAgenciesHref, dashboardHousesHref, dashboardAgencyDetailHref, parseDashboardAgencyDetailQuery } from "../lib/dashboard-routes.ts";

const range = { dateFrom: "2026-08-29", dateTo: "2026-10-02" };
test("reporting range uses inclusive Bangkok dates across months", () => {
  const query = parseDashboardQuery({ month: "2026-09", ...range });
  assert.equal(query.start, "2026-08-28T17:00:00.000Z");
  assert.equal(query.end, "2026-10-02T17:00:00.000Z");
  for (const invalid of [{ dateFrom: range.dateFrom }, { dateTo: range.dateTo }, { dateFrom: "2026-02-30", dateTo: range.dateTo }, { dateFrom: range.dateTo, dateTo: range.dateFrom }, { dateFrom: [range.dateFrom], dateTo: range.dateTo }]) {
    assert.throws(() => parseDashboardQuery({ month: "2026-09", ...invalid }));
  }
});
test("list filters, pagination, and agency detail preserve reporting range", () => {
  const raw = { month: "2026-09", ...range, page: "4", search: "villa" };
  for (const parse of [parseDashboardBookingsQuery, parseDashboardAgenciesQuery, parseDashboardHousesQuery]) {
    const query = parse(raw);
    assert.equal(query.dateFrom, range.dateFrom);
    assert.equal(query.dateTo, range.dateTo);
  }
  const booking = parseDashboardBookingsQuery(raw);
  assert.match(dashboardBookingsHref(booking, { status: "waiting" }), /dateFrom=2026-08-29&dateTo=2026-10-02/);
  assert.doesNotMatch(dashboardBookingsHref(booking, { dateTo: "2026-10-03" }), /page=/);
  assert.match(dashboardAgenciesHref(parseDashboardAgenciesQuery(raw), { page: 5 }), /dateFrom=2026-08-29/);
  assert.match(dashboardHousesHref(parseDashboardHousesQuery(raw), { page: 5 }), /dateTo=2026-10-02/);
  const agency = parseDashboardAgencyDetailQuery({ ...raw, bookingsPage: "3" });
  assert.match(dashboardAgencyDetailHref(agency, "unassigned"), /page=4/);
  const url = new URL(dashboardAgencyDetailHref(agency, "unassigned", { dateTo: "2026-10-03" }), "https://test.invalid");
  const parsed = parseDashboardAgencyDetailQuery(Object.fromEntries(url.searchParams));
  assert.equal(parsed.dateTo, "2026-10-03");
  assert.equal(parsed.bookingsPage, 1);
});
