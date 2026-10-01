import "server-only";
import { dashboardStatus, parseDashboardQuery, type DashboardAgency, type DashboardAgencySort, type DashboardBooking, type DashboardBookingSource, type DashboardBookingsQuery, type DashboardDailyBookingCount, type DashboardDetail, type DashboardHouse, type DashboardListQuery, type DashboardOverview, type DashboardOverviewQuery, type DashboardPage, type DashboardReport, type DashboardSales } from "../../lib/dashboard.ts";
import { dashboardShare } from "../../lib/dashboard-calculations.ts";
import type { DashboardRepository } from "../repositories/dashboard.ts";

const DASHBOARD_PAGE_SIZE = 10;

export class DashboardForbidden extends Error {}
export class DashboardItemNotFound extends Error {}

interface DashboardLoadOptions {
  now?: Date;
  agencyBookingsPage?: number;
  agencyBookingsSearch?: string;
  agencyBookingsSort?: DashboardAgencySort;
}

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

function publicBooking(row: DashboardBookingSource, includeAgency = false): DashboardBooking {
  return {
    id: row.id, code: row.code, propertyId: row.propertyId, houseTitle: row.houseTitle,
    checkIn: row.checkIn, checkOut: row.checkOut, createdAt: row.createdAt,
    status: row.status, priceCents: row.priceCents,
    ...(includeAgency ? { agency: { id: row.agentId, name: agencyLabel(row) } } : {}),
  };
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

function sortAgencyBookings(rows: DashboardBookingSource[], sort: DashboardAgencySort): DashboardBookingSource[] {
  const direction = sort.endsWith("desc") ? -1 : 1;
  return [...rows].sort((left, right) => {
    let comparison = 0;
    if (sort.startsWith("price")) {
      if (left.priceCents === null && right.priceCents !== null) return 1;
      if (left.priceCents !== null && right.priceCents === null) return -1;
      if (left.priceCents !== null && right.priceCents !== null) comparison = left.priceCents - right.priceCents;
    } else {
      comparison = left.checkIn.localeCompare(right.checkIn);
    }
    return comparison * direction
      || right.createdAt.localeCompare(left.createdAt)
      || right.id.localeCompare(left.id, "en", { numeric: true });
  });
}

function confirmedBookingsByDay(rows: DashboardBookingSource[], month: string): DashboardDailyBookingCount[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (dashboardStatus(row.status) !== "confirmed") continue;
    const date = new Date(Date.parse(row.createdAt) + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    return { date, count: counts.get(date) ?? 0 };
  });
}

function emptyOverview(month: string): DashboardOverview {
  return { confirmedBookingsByDay: confirmedBookingsByDay([], month), topAgencies: [], recentHouses: [], agencyCount: 0, newHouseCount: 0 };
}

export async function loadDashboard(repository: DashboardRepository, actorId: string, raw: Record<string, unknown>, options: DashboardLoadOptions = {}): Promise<DashboardReport> {
  const scope = await repository.access(actorId);
  if (!scope) throw new DashboardForbidden();
  const query = parseDashboardQuery(raw, options.now);
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
  const dailyConfirmedBookings = confirmedBookingsByDay(rows, query.month);
  const overview: DashboardOverview = scope.kind === "admin"
    ? { confirmedBookingsByDay: dailyConfirmedBookings, topAgencies: agencies.slice(0, 5), recentHouses: houses.slice(0, 6), agencyCount: agencies.length, newHouseCount: houses.length }
    : { ...emptyOverview(query.month), confirmedBookingsByDay: dailyConfirmedBookings };
  const bookingAgency = scope.kind === "admin" && query.view === "bookings" ? query.agency : "";
  const bookings = paginate(rows.filter(row => (query.status === "all" || dashboardStatus(row.status) === query.status)
    && (!bookingAgency || (row.agentId ?? "unassigned") === bookingAgency)
    && matchesText(row, query.search)).map(row => publicBooking(row, scope.kind === "admin")), query.page);
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
    const agencyBookings = rows.filter(row => (query.agency === "unassigned" ? row.agentId === null : row.agentId === query.agency) && dashboardStatus(row.status) === "confirmed");
    const visibleAgencyBookings = sortAgencyBookings(
      agencyBookings.filter(row => matchesText(row, options.agencyBookingsSearch ?? "")),
      options.agencyBookingsSort ?? "date-asc",
    );
    detail = {
      kind: "agency",
      agency,
      sharePercent: dashboardShare(agency.amountCents, sales.amountCents),
      bookings: paginate(visibleAgencyBookings.map(row => publicBooking(row, true)), options.agencyBookingsPage ?? 1),
    };
  }
  if (query.view === "house") {
    const house = houses.find(row => row.id === query.houseId);
    if (!house) throw new DashboardItemNotFound();
    detail = { kind: "house", house };
  }
  const selectedAgency = bookingAgency ? agencies.find(row => (row.id ?? "unassigned") === bookingAgency) : null;
  return {
    scope,
    month: query.month,
    bookingCount: rows.length,
    waitingCount: statusCounts.waiting,
    statusCounts,
    sales,
    overview,
    bookings,
    admin: scope.kind === "admin" ? {
      agencies: paginate(agencyRows, query.agenciesPage),
      houses: paginate(houseRows, query.housesPage),
      selectedAgency: selectedAgency ? { id: selectedAgency.id, name: selectedAgency.name } : null,
    } : null,
    detail,
  };
}

export async function loadDashboardBookings(repository: DashboardRepository, actorId: string, query: DashboardBookingsQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "bookings",
    status: query.status,
    search: query.search,
    agency: query.agency,
    page: String(query.page),
  });
}

export async function loadDashboardOverview(repository: DashboardRepository, actorId: string, query: DashboardOverviewQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "overview" });
}

export async function loadDashboardAgencies(repository: DashboardRepository, actorId: string, query: DashboardListQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "agencies", agencySearch: query.search, agenciesPage: String(query.page) });
}

export async function loadDashboardHouses(repository: DashboardRepository, actorId: string, query: DashboardListQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "houses", houseSearch: query.search, housesPage: String(query.page) });
}

export async function loadDashboardBooking(repository: DashboardRepository, actorId: string, query: DashboardBookingsQuery, bookingId: string): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "booking",
    bookingId,
    status: query.status,
    search: query.search,
    agency: query.agency,
    page: String(query.page),
  });
}

export async function loadDashboardAgency(repository: DashboardRepository, actorId: string, query: DashboardListQuery, agencyId: string, bookingsPage = 1, bookingsSearch = "", bookingsSort: DashboardAgencySort = "date-asc"): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "agency",
    agency: agencyId,
    agencySearch: query.search,
    agenciesPage: String(query.page),
  }, { agencyBookingsPage: bookingsPage, agencyBookingsSearch: bookingsSearch, agencyBookingsSort: bookingsSort });
}

export async function loadDashboardHouse(repository: DashboardRepository, actorId: string, query: DashboardListQuery, houseId: string): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "house",
    houseId,
    houseSearch: query.search,
    housesPage: String(query.page),
  });
}
