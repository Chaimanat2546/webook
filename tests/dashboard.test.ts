import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardScope, parseDashboardQuery, type DashboardBookingSource, type DashboardScope } from "../lib/dashboard.ts";
import { createDashboardRepository, type DashboardRepository } from "../server/repositories/dashboard.ts";
import { DashboardForbidden, loadDashboard } from "../server/services/dashboard.ts";

const booking: DashboardBookingSource = {
  id: "1", code: "BK1", propertyId: "101", houseTitle: "House A", checkIn: "2026-11-01", checkOut: "2026-11-03",
  createdAt: "2026-09-10T00:00:00Z", status: "confirmed", priceCents: 123450, agentId: "agency-a", agentName: "Agency A",
};

function repository(scope: DashboardScope | null, rows: DashboardBookingSource[] = [booking]): DashboardRepository {
  return {
    async access(actorId) { assert.equal(actorId, "signed-in-user"); return scope; },
    async bookings(actualScope) { assert.deepEqual(actualScope, scope); return rows; },
    async newHouses() { return [{ id: "listing-new", propertyId: "202", title: "New House", createdAt: "2026-09-12T00:00:00Z" }]; },
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
  assert.equal(report.overview.recentBookings.length, 3);
});

test("dashboard owner detail routes fail closed without leaking foreign or agency data", async () => {
  const rows = [booking, { ...booking, id: "foreign", propertyId: "202", houseTitle: "Foreign House", agentName: "Foreign Agency" }];
  const ownerRepository = repository({ kind: "owner", propertyId: "101" }, rows);
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" }));
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "house", houseId: "listing-new" }));
  await assert.rejects(loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "booking", bookingId: "foreign" }));
  const owner = await loadDashboard(ownerRepository, "signed-in-user", { month: "2026-09", view: "bookings" });
  assert.doesNotMatch(JSON.stringify(owner), /Foreign House|Foreign Agency|agency-a/);
  assert.deepEqual(owner.overview, { recentBookings: [owner.bookings.rows[0]], topAgencies: [], recentHouses: [], agencyCount: 0, newHouseCount: 0 });
});

test("dashboard agency lists remain bounded and agency detail reconciles by house DV", async () => {
  const agencies = Array.from({ length: 100 }, (_, index) => ({ ...booking, id: `agency-${index}`, agentId: `agency-${index}`, agentName: `Agency ${index}`, propertyId: String(1000 + index), houseTitle: index < 5 ? "พูลวิลล่าชื่อซ้ำ" : `House ${index}`, priceCents: index === 99 ? null : (index + 1) * 100 }));
  const report = await loadDashboard(repository({ kind: "admin" }, agencies), "signed-in-user", { month: "2026-09", view: "agencies", agenciesPage: "999" });
  assert.equal(report.admin?.agencies.total, 100);
  assert.equal(report.admin?.agencies.rows.length, 10);
  assert.equal(report.overview.topAgencies.length, 3);
  assert.equal(report.sales.count, 100);
  assert.equal(report.sales.missingPrices, 1);
  const detailRows = Array.from({ length: 5 }, (_, index) => ({ ...booking, id: `detail-${index}`, agentId: "agency-a", agentName: "Agency A", propertyId: String(200 + index), houseTitle: "พูลวิลล่าชื่อซ้ำ", priceCents: (index + 1) * 100 }));
  const detailReport = await loadDashboard(repository({ kind: "admin" }, detailRows), "signed-in-user", { month: "2026-09", view: "agency", agency: "agency-a" });
  assert.equal(detailReport.detail?.kind, "agency");
  if (detailReport.detail?.kind !== "agency") assert.fail("expected agency detail");
  assert.equal(detailReport.detail.agency.amountCents, 1500);
  assert.equal(detailReport.detail.houseCount, 5);
  assert.equal(detailReport.detail.topHouses.length, 4);
  assert.deepEqual(detailReport.detail.topHouses.map(house => house.propertyId), ["204", "203", "202", "201"]);
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
    assert.deepEqual(url.searchParams.getAll("created_at"), ["gte.2026-08-31T17:00:00.000Z", "lt.2026-09-30T17:00:00.000Z"]);
    calls++;
    return new Response(JSON.stringify([{ id: `listing-${calls}`, property_id: 100 + calls, title: "New House", created_at: "2026-09-10T00:00:00Z" }]), { headers: { "Content-Type": "application/json", "Content-Range": `${calls - 1}-${calls - 1}/2` } });
  } } });
  const rows = await createDashboardRepository(client).newHouses(parseDashboardQuery({ month: "2026-09" }));
  assert.equal(rows.length, 2);
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
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const View = loaded.exports.DashboardView as ComponentType<Record<string, unknown>>;
  const query = parseDashboardQuery({ month: "2026-09" });
  for (const scope of [{ kind: "admin" }, { kind: "owner", propertyId: "101" }] as const) {
    const report = await loadDashboard(repository(scope), "signed-in-user", { month: "2026-09" });
    const html = renderToStaticMarkup(createElement(View, { report, query }));
    assert.match(html, /name="month"/);
    assert.match(html, /value="2026-09"/);
    assert.match(html, /ติดจอง/);
    assert.match(html, /ยอดขายจากการจอง/);
    assert.match(html, /สถานะการจอง/);
    assert.match(html, /การจองล่าสุด/);
    assert.match(html, /ดูรายการทั้งหมด/);
    assert.match(html, /view=bookings/);
    assert.doesNotMatch(html, /ไม่ใช่เงินรับแล้ว/);
    assert.match(html, /status=waiting/);
    assert.match(html, /<details/);
    if (scope.kind === "admin") assert.match(html, /ดูทั้งหมด/);
    assert.equal(html.includes("ยอดขายเอเจนซี่"), scope.kind === "admin");
    assert.equal(html.includes("บ้านที่เพิ่มใหม่"), scope.kind === "admin");
    assert.equal(html.includes("Agency A"), scope.kind === "admin");
    assert.equal(html.includes("New House"), scope.kind === "admin");
  }
  const empty = await loadDashboard(repository({ kind: "admin" }, []), "signed-in-user", { month: "2026-09" });
  const emptyHtml = renderToStaticMarkup(createElement(View, { report: empty, query }));
  assert.match(emptyHtml, /ไม่มีการจองในเดือนนี้/);
  assert.match(emptyHtml, /ไม่มียอดขายติดจองในเดือนนี้/);
  assert.doesNotMatch(emptyHtml, /aria-label="กราฟยอดขายเอเจนซี่/);
  const missing = await loadDashboard(repository({ kind: "admin" }, [{ ...booking, priceCents: null }]), "signed-in-user", { month: "2026-09" });
  const missingHtml = renderToStaticMarkup(createElement(View, { report: missing, query }));
  assert.match(missingHtml, /role="status"/);
  assert.match(missingHtml, /ยังไม่ระบุยอด/);
  assert.match(missingHtml, /House A/);
});
