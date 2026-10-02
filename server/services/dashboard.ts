import "server-only";
import { dashboardStatus, parseDashboardQuery, type DashboardAgency, type DashboardAgencySort, type DashboardBooking, type DashboardBookingSort, type DashboardBookingSource, type DashboardBookingsQuery, type DashboardCustomer, type DashboardDailyBookingCount, type DashboardDetail, type DashboardHouse, type DashboardListQuery, type DashboardMonth, type DashboardOverview, type DashboardOverviewQuery, type DashboardPage, type DashboardReport, type DashboardSales } from "../../lib/dashboard.ts";
import { dashboardShare } from "../../lib/dashboard-calculations.ts";
import type { DashboardBookingDateField, DashboardRepository } from "../repositories/dashboard.ts";

const DASHBOARD_PAGE_SIZE = 10;
const DASHBOARD_BOOKINGS_PAGE_SIZE = 9;

export class DashboardForbidden extends Error {}
export class DashboardItemNotFound extends Error {}

export async function loadDashboardBookingCustomer(repository: DashboardRepository, actorId: string, bookingId: string): Promise<DashboardCustomer | null> {
  const scope = await repository.access(actorId);
  if (!scope) throw new DashboardForbidden();
  const booking = await repository.bookingCustomer(scope, bookingId);
  if (!booking) throw new DashboardItemNotFound();
  return booking.customerId ? repository.customerDetail(scope, booking.propertyId, booking.customerId) : null;
}

interface DashboardLoadOptions {
  now?: Date;
  bookingDateField?: DashboardBookingDateField;
  bookingDateRange?: DashboardMonth;
  includeBookingNote?: boolean;
  bookingListSort?: DashboardBookingSort;
  bookingListSearch?: boolean;
  agencyBookingsPage?: number;
  agencyBookingsSearch?: string;
  agencyBookingsSort?: DashboardAgencySort;
}

function paginate<T>(rows: T[], requestedPage: number, pageSize = DASHBOARD_PAGE_SIZE): DashboardPage<T> {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pages);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pages };
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

function sortDashboardBookings(rows: DashboardBookingSource[], sort: DashboardBookingSort): DashboardBookingSource[] {
  return [...rows].sort((left, right) => {
    if (sort === "updated-desc") return right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id, "en", { numeric: true });
    if (sort === "checkin-desc") return right.checkIn.localeCompare(left.checkIn) || right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id, "en", { numeric: true });
    if (left.priceCents === null && right.priceCents !== null) return 1;
    if (left.priceCents !== null && right.priceCents === null) return -1;
    if (left.priceCents !== null && right.priceCents !== null) {
      const direction = sort === "price-desc" ? -1 : 1;
      const comparison = (left.priceCents - right.priceCents) * direction;
      if (comparison) return comparison;
    }
    return right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id, "en", { numeric: true });
  });
}

function sortHouses(rows: DashboardHouse[]): DashboardHouse[] {
  return [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id, "en", { numeric: true }));
}

function publicBooking(row: DashboardBookingSource, includeAgency = false): DashboardBooking {
  return {
    id: row.id, code: row.code, propertyId: row.propertyId, houseTitle: row.houseTitle,
    checkIn: row.checkIn, checkOut: row.checkOut, createdAt: row.createdAt, updatedAt: row.updatedAt,
    status: row.status, priceCents: row.priceCents,
    ...(includeAgency ? { agency: { id: row.agentId, name: agencyLabel(row) } } : {}),
  };
}

function matchesText(row: DashboardBookingSource, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("th-TH");
  return [row.code, row.houseTitle, row.propertyId, `DV-${row.propertyId}`].some(value => value.toLocaleLowerCase("th-TH").includes(needle));
}

function matchesDashboardBookingText(row: DashboardBookingSource, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("th-TH");
  const customerName = [row.customerFirstName, row.customerLastName].filter((value): value is string => Boolean(value)).join(" ");
  return [row.houseTitle, `DV-${row.propertyId}`, customerName, agencyLabel(row)].some(value => value.toLocaleLowerCase("th-TH").includes(needle));
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
  const bookingDateField = options.bookingDateField ?? "created_at";
  const [source, sourceHouses] = await Promise.all([
    repository.bookings(scope, options.bookingDateRange ?? query, bookingDateField, options.includeBookingNote),
    scope.kind === "admin" ? repository.newHouses(query) : Promise.resolve([]),
  ]);
  const rows = sortBookings(source.filter(row => {
    const date = bookingDateField === "updated_at" ? row.updatedAt : bookingDateField === "check_in" ? row.checkIn : row.createdAt;
    const range = options.bookingDateRange ?? query;
    return (scope.kind === "admin" || row.propertyId === scope.propertyId)
      && (bookingDateField === "check_in" ? date >= range.start && date < range.end : Date.parse(date) >= Date.parse(range.start) && Date.parse(date) < Date.parse(range.end));
  }));
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
  const bookingRows = rows.filter(row => (query.status === "all" || dashboardStatus(row.status) === query.status)
    && (options.bookingListSearch ? matchesDashboardBookingText(row, query.search) : matchesText(row, query.search)));
  const bookings = paginate((options.bookingListSort ? sortDashboardBookings(bookingRows, options.bookingListSort) : bookingRows).map(row => publicBooking(row, scope.kind === "admin")), query.page, options.bookingListSort ? DASHBOARD_BOOKINGS_PAGE_SIZE : DASHBOARD_PAGE_SIZE);
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
    const [coverImageUrl, createdByName] = await Promise.all([
      repository.coverImageUrl(scope, booking.propertyId),
      booking.createdById ? repository.creatorName(booking.createdById) : Promise.resolve(null),
    ]);
    detail = { kind: "booking", booking: publicBooking(booking), note: booking.note ?? null, coverImageUrl, createdByName, customer: null, costs: { fullPriceCents: booking.priceCents, depositCents: booking.depositCents ?? null, extraChargeCents: booking.extraChargeCents ?? null, insuranceCents: booking.insuranceCents ?? null, paymentExpiresAt: booking.paymentExpiresAt ?? null }, checkInTime: booking.checkInTime ?? null, checkOutTime: booking.checkOutTime ?? null, ...(scope.kind === "admin" ? { agency: { id: booking.agentId, name: agencyLabel(booking) } } : {}) };
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
      selectedAgency: null,
    } : null,
    detail,
  };
}

export async function loadDashboardBookings(repository: DashboardRepository, actorId: string, query: DashboardBookingsQuery): Promise<DashboardReport> {
  const bookingDateRange = query.checkInFrom && query.checkInTo ? { month: query.month, start: query.checkInFrom, end: nextDay(query.checkInTo) } : undefined;
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "bookings",
    status: query.status,
    search: query.search,
    page: String(query.page),
  }, { bookingDateField: bookingDateRange ? "check_in" : "updated_at", bookingDateRange, bookingListSort: query.sort, bookingListSearch: true });
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
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
    page: String(query.page),
  }, { bookingDateField: "updated_at", bookingListSort: query.sort, bookingListSearch: true, includeBookingNote: true });
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
