import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dashboardBackHref, dashboardHref } from "../lib/dashboard-navigation.ts";
import { parseDashboardQuery, dashboardDateFilter, type DashboardHouse } from "../lib/dashboard.ts";
import { dashboardBookingsHref, dashboardAgenciesHref, dashboardHousesHref, parseDashboardBookingsQuery, parseDashboardAgenciesQuery, parseDashboardHousesQuery, dashboardPeriodParams, dashboardBookingDetailHref, dashboardHouseDetailHref, dashboardAgencyDetailHref, parseDashboardAgencyDetailQuery, dashboardAgencyBookingDetailHref, parseDashboardBookingOrigin } from "../lib/dashboard-routes.ts";
import { safeHouseReturnTo } from "../lib/admin-return-to.ts";
import { loadDashboardOverview } from "../server/services/dashboard.ts";
import { parseDashboardReportingResult } from "../server/repositories/dashboard-reporting.ts";
import type { DashboardRepository } from "../server/repositories/dashboard.ts";
import { dashboardReportFixture } from "./helpers/dashboard-report-fixture.ts";

const window = { dateFrom: "2026-10-14", dateTo: "2026-10-16", timeFrom: "09:00", timeTo: "18:00" };

test("legacy business navigation retains clocks and resets all pages on time edits", () => {
  const query = parseDashboardQuery({ month: "2026-10", ...window, view: "booking", from: "bookings", bookingId: "1", page: "3" });
  assert.equal(new URL(dashboardBackHref(query), "https://test.invalid").searchParams.get("timeFrom"), "09:00");
  const next = new URL(dashboardHref(query, { timeFrom: "10:00" }), "https://test.invalid");
  assert.equal(next.searchParams.get("timeFrom"), "10:00");
  assert.equal(next.searchParams.get("page"), null);
});

test("business pickers and chart expose hourly, recurring and full-day context", async () => {
  const bundled = await build({
    entryPoints: ["components/admin/dashboard/dashboard-view.tsx", "components/admin/dashboard/confirmed-bookings-chart.tsx", "components/admin/dashboard/dashboard-booking-filters.tsx", "components/admin/dashboard/dashboard-agency-filters.tsx", "components/admin/dashboard/dashboard-house-filters.tsx"],
    outdir: "unused", bundle: true, write: false, format: "cjs", platform: "node", packages: "external",
    plugins: [{ name: "business-axis-probe", setup(builder) {
      builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "axis-probe" }));
      builder.onLoad({ filter: /.*/, namespace: "axis-probe" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: `
        import React from 'react';
        export const ResponsiveContainer=({children})=>children;
        export const BarChart=({children})=>React.createElement('div',null,children);
        export const AreaChart=BarChart, Area=()=>null;
        export const XAxis=({tickFormatter})=>React.createElement('span',null,tickFormatter?.('2026-10-14T02:00:00.000Z'));
        export const Bar=()=>null, CartesianGrid=()=>null, YAxis=()=>null, Tooltip=()=>null, Legend=()=>null, Cell=()=>null;
      ` }));
    } }],
  });
  const require = createRequire(import.meta.url);
  const modules = bundled.outputFiles.map(output => {
    const loaded = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    new Function("require", "module", "exports", output.text)((name: string) => name === "next/navigation" ? { useRouter: () => ({ push() {} }) } : require(name), loaded, loaded.exports);
    return loaded.exports;
  });
  for (const range of [window, { ...window, dateTo: window.dateFrom }, { ...window, timeFrom: "00:00", timeTo: "24:00" }]) {
    const label = range.timeTo === "24:00" ? "เต็มวัน 24 ชั่วโมง" : `${range.dateFrom === range.dateTo ? "" : "ทุกวัน "}09:00–18:00`;
    const query = { month: "2026-10", ...range, status: "confirmed", sort: "updated-desc", search: "", page: 1 };
    for (const [component, props] of [[modules[0].DashboardHeader, query], [modules[2].DashboardBookingFilters, { query }], [modules[3].DashboardAgencyFilters, { query }], [modules[4].DashboardHouseFilters, { query }]] as const) {
      assert.ok(renderToStaticMarkup(createElement(component, props)).includes(label), label);
    }
  }
  for (const presentation of ["bar", "area"]) {
    const chart = renderToStaticMarkup(createElement(modules[1].ConfirmedBookingsChart, { points: [{ date: "2026-10-14T02:00:00.000Z", count: 2 }], granularity: "hour", presentation }));
    assert.match(chart, /กราฟจำนวนการจองติดจองรายชั่วโมง/);
    assert.match(chart, /09:00/);
  }
});

test("business time windows validate hours and use Bangkok outer bounds", () => {
  const query = parseDashboardQuery({ month: "2026-10", ...window });
  assert.equal(query.start, "2026-10-14T02:00:00.000Z");
  assert.equal(query.end, "2026-10-16T11:00:00.000Z");
  assert.deepEqual(dashboardDateFilter(query), window);
  const midnight = parseDashboardQuery({ month: "2026-10", ...window, dateTo: window.dateFrom, timeFrom: "23:00", timeTo: "24:00" });
  assert.equal(midnight.start, "2026-10-14T16:00:00.000Z");
  assert.equal(midnight.end, "2026-10-14T17:00:00.000Z");
  for (const invalid of [{ timeFrom: "09:00" }, { timeFrom: "09:30", timeTo: "18:00" }, { timeFrom: "24:00", timeTo: "24:00" }, { timeFrom: "18:00", timeTo: "09:00" }, { timeFrom: ["09:00"], timeTo: "18:00" }]) {
    assert.throws(() => parseDashboardQuery({ month: "2026-10", dateFrom: window.dateFrom, dateTo: window.dateTo, ...invalid }));
  }
  assert.throws(() => parseDashboardQuery({ month: "2026-10", timeFrom: "09:00", timeTo: "18:00" }));
});

test("business clocks survive all list links and reset paging when edited", () => {
  const raw = { month: "2026-10", ...window, page: "3" };
  const pairs = [
    [parseDashboardBookingsQuery(raw), dashboardBookingsHref],
    [parseDashboardAgenciesQuery(raw), dashboardAgenciesHref],
    [parseDashboardHousesQuery(raw), dashboardHousesHref],
  ] as const;
  for (const [query, href] of pairs) {
    assert.deepEqual(dashboardDateFilter(query), window);
    const params = dashboardPeriodParams(query);
    assert.equal(params.get("timeFrom"), "09:00");
    assert.equal(params.get("timeTo"), "18:00");
    assert.ok(href);
  }
  for (const url of [dashboardBookingsHref(pairs[0][0], { timeFrom: "10:00" }), dashboardAgenciesHref(pairs[1][0], { timeFrom: "10:00" }), dashboardHousesHref(pairs[2][0], { timeFrom: "10:00" })]) {
    const params = new URL(url, "https://test.invalid").searchParams;
    assert.equal(params.get("timeFrom"), "10:00");
    assert.equal(params.get("page"), null);
  }
});

test("canonical detail, agency-origin and house-workspace return links retain clocks", () => {
  const raw = { month: "2026-10", ...window, page: "3" };
  const agency = parseDashboardAgencyDetailQuery({ ...raw, bookingsPage: "2" });
  for (const url of [dashboardBookingDetailHref(parseDashboardBookingsQuery(raw), "1"), dashboardAgencyDetailHref(agency, "unassigned"), dashboardHouseDetailHref(parseDashboardHousesQuery(raw), "1", "overview")]) {
    assert.equal(new URL(url, "https://test.invalid").searchParams.get("timeTo"), "18:00");
  }
  const bookingUrl = new URL(dashboardAgencyBookingDetailHref(agency, "unassigned", "1"), "https://test.invalid");
  const origin = parseDashboardBookingOrigin(Object.fromEntries(bookingUrl.searchParams));
  assert.deepEqual(dashboardDateFilter(origin!.query), window);
  const changed = new URL(dashboardAgencyDetailHref(agency, "unassigned", { timeFrom: "10:00" }), "https://test.invalid");
  assert.equal(changed.searchParams.get("bookingsPage"), null);
  assert.equal(changed.searchParams.get("timeFrom"), "10:00");
  const house = dashboardHouseDetailHref(parseDashboardHousesQuery(raw), "1", "overview");
  assert.equal(safeHouseReturnTo(house), house);
});

test("overview website clocks inherit business selection only without explicit analytics overrides", async () => {
  const bundled = await build({ entryPoints: ["app/admin/dashboard/page.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{ name: "overview-boundaries", setup(builder) {
    builder.onResolve({ filter: /server\/auth\/dashboard$/ }, () => ({ path: "dashboard-auth-fixture", external: true }));
    builder.onResolve({ filter: /server\/services\/dashboard$/ }, () => ({ path: "dashboard-service-fixture", external: true }));
    builder.onResolve({ filter: /server\/site-analytics\/registry$/ }, () => ({ path: "analytics-registry-fixture", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundled.outputFiles[0].text)((name: string) => {
    if (name === "dashboard-auth-fixture") return { dashboardSession: async () => ({ actorId: "admin", repository: { access: async () => ({ kind: "admin" }) } }) };
    if (name === "dashboard-service-fixture") return { loadDashboardOverview: async () => ({ scope: { kind: "admin" } }), DashboardForbidden: class extends Error {}, DashboardItemNotFound: class extends Error {} };
    if (name === "analytics-registry-fixture") return { listAnalyticsSites: () => [] };
    if (name === "server-only") return {};
    return require(name);
  }, loaded, loaded.exports);
  interface OverviewProps { websiteSummary?: ReactElement<{ children: ReactElement<{ range: { from: string; to: string; timeFrom?: string; timeTo?: string } }> }> }
  const Page = loaded.exports.default as (props: { searchParams: Promise<Record<string, unknown>> }) => Promise<ReactElement<OverviewProps>>;
  const implicit = await Page({ searchParams: Promise.resolve({ month: "2026-10", ...window }) });
  assert.deepEqual(implicit.props.websiteSummary?.props.children.props.range, { from: window.dateFrom, to: window.dateTo, timeFrom: window.timeFrom, timeTo: window.timeTo });
  const explicit = await Page({ searchParams: Promise.resolve({ month: "2026-10", ...window, analyticsFrom: "2026-10-12", analyticsTo: "2026-10-12", analyticsTimeFrom: "10:00", analyticsTimeTo: "12:00" }) });
  assert.deepEqual(explicit.props.websiteSummary?.props.children.props.range, { from: "2026-10-12", to: "2026-10-12", timeFrom: "10:00", timeTo: "12:00" });
  const independentFullDay = await Page({ searchParams: Promise.resolve({ month: "2026-10", ...window, analyticsFrom: "2026-10-12", analyticsTo: "2026-10-12" }) });
  assert.equal(independentFullDay.props.websiteSummary?.props.children.props.range.timeTo, "24:00");
  const partial = await Page({ searchParams: Promise.resolve({ month: "2026-10", ...window, analyticsTimeFrom: "10:00" }) });
  assert.equal(partial.props.websiteSummary, undefined);
});

test("hourly RPC buckets remain real bounded counts instead of being discarded", () => {
  const base = dashboardReportFixture({ kind: "admin" }, [], { month: "2026-10" });
  const hourly = [{ date: "2026-10-14T02:00:00.000Z", count: 0 }, { date: "2026-10-14T03:00:00.000Z", count: 0 }];
  assert.deepEqual(parseDashboardReportingResult({ ...base, hourly }).hourly, hourly);
  for (const invalid of [Array(25).fill(hourly[0]), [{ ...hourly[0], count: -1 }], [hourly[0], hourly[0]], [{ ...hourly[0], date: "2026-10-14T02:30:00.000Z" }], [{ ...hourly[0], count: 1 }]]) {
    assert.throws(() => parseDashboardReportingResult({ ...base, hourly: invalid }));
  }
});

test("all business metrics receive clocks and new houses are filtered before preview and count", async () => {
  const report = dashboardReportFixture({ kind: "admin" }, [], { month: "2026-10" });
  const house: DashboardHouse = { id: "1", propertyId: "1", title: "A", createdAt: "", bedrooms: null, bathrooms: null, maxGuests: null, locationZone: null, propertyType: null, isActive: true, checkinTime: null, checkoutTime: null };
  const houses = ["2026-10-14T01:59:59.999Z", "2026-10-14T02:00:00.000Z", "2026-10-14T11:00:00.000Z", "2026-10-15T02:00:00.000Z", "2026-10-15T20:00:00.000Z", "2026-10-16T10:59:59.999Z", "2026-10-16T11:00:00.000Z"].map((createdAt, index) => ({ ...house, id: String(index + 1), createdAt }));
  const repository: DashboardRepository = {
    access: async () => ({ kind: "admin" }),
    report: async (_actor, query) => { assert.deepEqual(dashboardDateFilter(query), window); return report; },
    newHouses: async query => { assert.equal(query.start, "2026-10-14T02:00:00.000Z"); return houses; },
    bookingCustomer: async () => null, coverImageUrl: async () => null, creatorName: async () => null, customerDetail: async () => null, houseDetail: async () => null,
  };
  const result = await loadDashboardOverview(repository, "admin", { month: "2026-10", ...window });
  assert.equal(result.overview.newHouseCount, 3);
  assert.deepEqual(result.overview.recentHouses.map(row => row.id), ["6", "4", "2"]);
  assert.equal(result.admin?.houses.total, 3);
});
