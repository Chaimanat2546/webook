import "server-only";
import { dashboardStatus, parseDashboardQuery, type DashboardAgency, type DashboardBooking, type DashboardBookingSource, type DashboardDetail, type DashboardHouse, type DashboardHouseSales, type DashboardOverview, type DashboardPage, type DashboardReport, type DashboardSales } from "../../lib/dashboard.ts";
import { dashboardShare } from "../../lib/dashboard-calculations.ts";
import type { DashboardRepository } from "../repositories/dashboard.ts";

const DASHBOARD_PAGE_SIZE = 10;

export class DashboardForbidden extends Error {}
export class DashboardItemNotFound extends Error {}

function paginate<T>(rows: T[], requestedPage: number): DashboardPage<T> {
  const pages = Math.max(1, Math.ceil(rows.length / DASHBOARD_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  return { rows: rows.slice((page - 1) * DASHBOARD_PAGE_SIZE, page * DASHBOARD_PAGE_SIZE), total: rows.length, page, pages };
}

function addSale(total: DashboardSales, priceCents: number | null) {
  total.count++;
  if (priceCents === null) total.missingPrices++;
  else {
    total.amountCents += priceCents;
    if (!Number.isSafeInteger(total.amountCents)) throw new Error("dashboard_amount_overflow");
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "th-TH");
}

function sortBookings(rows: DashboardBookingSource[]): DashboardBookingSource[] {
  return [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id, "en", { numeric: true }));
}

function sortHouses(rows: DashboardHouse[]): DashboardHouse[] {
  return [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id, "en", { numeric: true }));
}

function publicBooking(row: DashboardBookingSource): DashboardBooking {
  return { id: row.id, code: row.code, propertyId: row.propertyId, houseTitle: row.houseTitle, checkIn: row.checkIn, checkOut: row.checkOut, createdAt: row.createdAt, status: row.status, priceCents: row.priceCents };
}

function matchesText(row: DashboardBookingSource, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("th-TH");
  return [row.code, row.houseTitle, row.propertyId, `DV-${row.propertyId}`].some(value => value.toLocaleLowerCase("th-TH").includes(needle));
}

function agencyLabel(row: DashboardBookingSource): string {
  return row.agentName ?? (row.agentId ? "เอเจนซี่ที่ไม่มีชื่อในระบบ" : "ไม่ระบุเอเจนซี่");
}

function collectAgencies(rows: DashboardBookingSource[]): DashboardAgency[] {
  const agencies = new Map<string | null, DashboardAgency>();
  for (const row of rows) {
    if (dashboardStatus(row.status) !== "confirmed") continue;
    const group = agencies.get(row.agentId) ?? { id: row.agentId, name: agencyLabel(row), count: 0, amountCents: 0, missingPrices: 0 };
    addSale(group, row.priceCents);
    agencies.set(row.agentId, group);
  }
  return [...agencies.values()].sort((left, right) => right.amountCents - left.amountCents || right.count - left.count || compareText(left.name, right.name));
}

function collectHouseSales(rows: DashboardBookingSource[]): DashboardHouseSales[] {
  const houses = new Map<string, DashboardHouseSales>();
  for (const row of rows) {
    if (dashboardStatus(row.status) !== "confirmed") continue;
    const group = houses.get(row.propertyId) ?? { propertyId: row.propertyId, houseTitle: row.houseTitle, count: 0, amountCents: 0 };
    group.count++;
    if (row.priceCents !== null) {
      group.amountCents += row.priceCents;
      if (!Number.isSafeInteger(group.amountCents)) throw new Error("dashboard_amount_overflow");
    }
    houses.set(row.propertyId, group);
  }
  return [...houses.values()].sort((left, right) => right.amountCents - left.amountCents || right.count - left.count || compareText(left.houseTitle, right.houseTitle) || left.propertyId.localeCompare(right.propertyId, "en", { numeric: true }));
}

function emptyOverview(): DashboardOverview {
  return { recentBookings: [], topAgencies: [], recentHouses: [], agencyCount: 0, newHouseCount: 0 };
}

export async function loadDashboard(repository: DashboardRepository, actorId: string, raw: Record<string, unknown>, now = new Date()): Promise<DashboardReport> {
  const scope = await repository.access(actorId);
  if (!scope) throw new DashboardForbidden();
  const query = parseDashboardQuery(raw, now);
  if (scope.kind === "owner" && ["agencies", "houses", "agency", "house"].includes(query.view)) throw new DashboardForbidden();
  const [source, sourceHouses] = await Promise.all([
    repository.bookings(scope, query),
    scope.kind === "admin" ? repository.newHouses(query) : Promise.resolve([]),
  ]);
  const rows = sortBookings(source.filter(row => (scope.kind === "admin" || row.propertyId === scope.propertyId)
    && Date.parse(row.createdAt) >= Date.parse(query.start) && Date.parse(row.createdAt) < Date.parse(query.end)));
  const houses = sortHouses(sourceHouses);
  const sales: DashboardSales = { count: 0, amountCents: 0, missingPrices: 0 };
  const statusCounts: DashboardReport["statusCounts"] = { confirmed: 0, waiting: 0, cancelled: 0, repair: 0, unknown: 0 };
  for (const row of rows) {
    const status = dashboardStatus(row.status);
    statusCounts[status]++;
    if (status === "confirmed") addSale(sales, row.priceCents);
  }
  const agencies = scope.kind === "admin" ? collectAgencies(rows) : [];
  const overview: DashboardOverview = scope.kind === "admin"
    ? { recentBookings: rows.slice(0, 3).map(publicBooking), topAgencies: agencies.slice(0, 3), recentHouses: houses.slice(0, 3), agencyCount: agencies.length, newHouseCount: houses.length }
    : { ...emptyOverview(), recentBookings: rows.slice(0, 3).map(publicBooking) };
  const bookingAgency = scope.kind === "admin" && query.view === "bookings" ? query.agency : "";
  const bookings = paginate(rows.filter(row => (query.status === "all" || dashboardStatus(row.status) === query.status)
    && (!bookingAgency || (row.agentId ?? "unassigned") === bookingAgency)
    && matchesText(row, query.search)).map(publicBooking), query.page);
  const agencyRows = scope.kind === "admin"
    ? agencies.filter(row => !query.agencySearch || row.name.toLocaleLowerCase("th-TH").includes(query.agencySearch.toLocaleLowerCase("th-TH")))
    : [];
  const houseRows = scope.kind === "admin"
    ? houses.filter(row => !query.houseSearch || `${row.title} DV-${row.propertyId ?? ""}`.toLocaleLowerCase("th-TH").includes(query.houseSearch.toLocaleLowerCase("th-TH")))
    : [];
  let detail: DashboardDetail | null = null;
  if (query.view === "booking") {
    const booking = rows.find(row => row.id === query.bookingId);
    if (!booking) throw new DashboardItemNotFound();
    detail = { kind: "booking", booking: publicBooking(booking), ...(scope.kind === "admin" ? { agency: { id: booking.agentId, name: agencyLabel(booking) } } : {}) };
  }
  if (query.view === "agency") {
    const agency = agencies.find(row => (query.agency === "unassigned" ? row.id === null : row.id === query.agency));
    if (!agency) throw new DashboardItemNotFound();
    const agencyBookings = rows.filter(row => (query.agency === "unassigned" ? row.agentId === null : row.agentId === query.agency));
    const houseSales = collectHouseSales(agencyBookings);
    detail = { kind: "agency", agency, sharePercent: dashboardShare(agency.amountCents, sales.amountCents), houseCount: houseSales.length, topHouses: houseSales.slice(0, 4) };
  }
  if (query.view === "house") {
    const house = houses.find(row => row.id === query.houseId);
    if (!house) throw new DashboardItemNotFound();
    detail = { kind: "house", house };
  }
  return {
    scope,
    month: query.month,
    bookingCount: rows.length,
    waitingCount: statusCounts.waiting,
    statusCounts,
    sales,
    overview,
    bookings,
    admin: scope.kind === "admin" ? { agencies: paginate(agencyRows, query.agenciesPage), houses: paginate(houseRows, query.housesPage) } : null,
    detail,
  };
}
