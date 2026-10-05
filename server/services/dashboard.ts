import "server-only";
import { parseDashboardQuery, type DashboardAgenciesQuery, type DashboardAgencyListSort, type DashboardBooking, type DashboardBookingSort, type DashboardBookingSource, type DashboardBookingsQuery, type DashboardCustomer, type DashboardDetail, type DashboardListQuery, type DashboardMonth, type DashboardOverviewQuery, type DashboardPage, type DashboardReport } from "../../lib/dashboard.ts";
import type { DashboardAgencyDetailQuery } from "../../lib/dashboard-routes.ts";
import { dashboardShare } from "../../lib/dashboard-calculations.ts";
import type { DashboardRepository } from "../repositories/dashboard.ts";

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
  bookingDateRange?: DashboardMonth;
  bookingListSort?: DashboardBookingSort;
  bookingAgencyId?: string | null;
  bookingAmountFromCents?: number;
  bookingAmountToCents?: number;
  agencyListSort?: DashboardAgencyListSort;
}
function paginate<T>(rows: T[], requestedPage: number): DashboardPage<T> {
  const pages = Math.max(1, Math.ceil(rows.length / 10)), page = Math.min(requestedPage, pages);
  return { rows: rows.slice((page - 1) * 10, page * 10), total: rows.length, page, pages };
}
function agencyLabel(row: DashboardBookingSource): string {
  return row.agentName ?? (row.agentId ? "เอเจนซี่ที่ไม่มีชื่อในระบบ" : "ไม่ระบุเอเจนซี่");
}
function publicBooking(row: DashboardBookingSource, includeAgency = false): DashboardBooking {
  return {
    id: row.id, code: row.code, propertyId: row.propertyId, houseTitle: row.houseTitle,
    checkIn: row.checkIn, checkOut: row.checkOut, createdAt: row.createdAt, updatedAt: row.updatedAt,
    status: row.status, priceCents: row.priceCents,
    ...(includeAgency ? { agency: { id: row.agentId, name: agencyLabel(row) } } : {}),
  };
}
export async function loadDashboard(repository: DashboardRepository, actorId: string, raw: Record<string, unknown>, options: DashboardLoadOptions = {}): Promise<DashboardReport> {
  const scope = await repository.access(actorId);
  if (!scope) throw new DashboardForbidden();
  const query = parseDashboardQuery(raw, options.now);
  if (scope.kind === "owner" && ["agencies", "houses", "agency", "house"].includes(query.view)) throw new DashboardForbidden();
  const agency = scope.kind === "admin"
    ? options.bookingAgencyId !== undefined ? options.bookingAgencyId ?? "unassigned" : query.view === "agency" ? query.agency : undefined
    : undefined;
  const range = options.bookingDateRange;
  const [result, sourceHouses] = await Promise.all([
    repository.report(actorId, {
      month: query.month, view: query.view, status: query.status, search: query.search,
      page: query.page, pageSize: 9, sort: options.bookingListSort ?? "updated-desc",
      agency, agencySearch: query.agencySearch, agenciesPage: query.agenciesPage, agencySort: options.agencyListSort,
      bookingId: query.view === "booking" ? query.bookingId : undefined,
      amountFromCents: options.bookingAmountFromCents, amountToCents: options.bookingAmountToCents,
      ...(range ? { checkInFrom: range.start, checkInTo: previousDay(range.end) } : {}),
    }),
    scope.kind === "admin" ? repository.newHouses(query) : Promise.resolve([]),
  ]);
  const houses = [...sourceHouses].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, "en", { numeric: true }));
  const bookings = { ...result.bookings, rows: result.bookings.rows.map(row => publicBooking(row, scope.kind === "admin")) };
  const houseRows = houses.filter(row => !query.houseSearch || `${row.title} DV-${row.propertyId ?? ""}`.toLocaleLowerCase("th-TH").includes(query.houseSearch.toLocaleLowerCase("th-TH")));
  let detail: DashboardDetail | null = null;
  if (query.view === "booking") {
    const booking = result.bookingDetail;
    if (!booking || (scope.kind === "owner" && booking.propertyId !== scope.propertyId)) throw new DashboardItemNotFound();
    const [coverImageUrl, createdByName] = await Promise.all([
      repository.coverImageUrl(scope, booking.propertyId),
      booking.createdById ? repository.creatorName(booking.createdById) : Promise.resolve(null),
    ]);
    detail = { kind: "booking", booking: publicBooking(booking), note: booking.note ?? null, coverImageUrl, createdByName, customer: null,
      costs: { fullPriceCents: booking.priceCents, depositCents: booking.depositCents ?? null, extraChargeCents: booking.extraChargeCents ?? null, insuranceCents: booking.insuranceCents ?? null, paymentExpiresAt: booking.paymentExpiresAt ?? null },
      checkInTime: booking.checkInTime ?? null, checkOutTime: booking.checkOutTime ?? null,
      ...(scope.kind === "admin" ? { agency: { id: booking.agentId, name: agencyLabel(booking) } } : {}),
    };
  }
  if (query.view === "agency") {
    if (!result.selectedAgency) throw new DashboardItemNotFound();
    detail = { kind: "agency", agency: result.selectedAgency, sharePercent: dashboardShare(result.selectedAgency.amountCents, result.totalSalesCents), bookings };
  }
  if (query.view === "house") {
    const house = houses.find(row => row.id === query.houseId);
    if (!house) throw new DashboardItemNotFound();
    if (!house.propertyId) throw new DashboardItemNotFound();
    const data = await repository.houseDetail(house.propertyId);
    if (!data) throw new DashboardItemNotFound();
    detail = { kind: "house", house, data };
  }
  return {
    scope, month: query.month, bookingCount: result.bookingCount, waitingCount: result.statusCounts.waiting,
    statusCounts: result.statusCounts, sales: result.sales, bookings, detail,
    overview: { confirmedBookingsByDay: result.daily, topAgencies: scope.kind === "admin" ? result.topAgencies : [], recentHouses: houses.slice(0, 6), agencyCount: scope.kind === "admin" ? result.agencyCount : 0, newHouseCount: houses.length },
    admin: scope.kind === "admin" ? { agencies: result.agencies, houses: paginate(houseRows, query.housesPage), selectedAgency: null } : null,
  };
}
function previousDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
export async function loadDashboardBookings(repository: DashboardRepository, actorId: string, query: DashboardBookingsQuery): Promise<DashboardReport> {
  const bookingDateRange = query.checkInFrom && query.checkInTo ? { month: query.month, start: query.checkInFrom, end: nextDay(query.checkInTo) } : undefined;
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "bookings",
    status: query.status,
    search: query.search,
    page: String(query.page),
  }, { bookingDateRange, bookingListSort: query.sort, bookingAmountFromCents: query.amountFromCents, bookingAmountToCents: query.amountToCents });
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function loadDashboardOverview(repository: DashboardRepository, actorId: string, query: DashboardOverviewQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "overview" });
}

export async function loadDashboardAgencies(repository: DashboardRepository, actorId: string, query: DashboardAgenciesQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "agencies", agencySearch: query.search, agenciesPage: String(query.page) }, { agencyListSort: query.agencySort });
}

export async function loadDashboardHouses(repository: DashboardRepository, actorId: string, query: DashboardListQuery): Promise<DashboardReport> {
  return loadDashboard(repository, actorId, { month: query.month, view: "houses", houseSearch: query.search, housesPage: String(query.page) });
}

export async function loadDashboardBooking(repository: DashboardRepository, actorId: string, query: DashboardBookingsQuery, bookingId: string): Promise<DashboardReport> {
  const bookingDateRange = query.checkInFrom && query.checkInTo ? { month: query.month, start: query.checkInFrom, end: nextDay(query.checkInTo) } : undefined;
  return loadDashboard(repository, actorId, {
    month: query.month,
    view: "booking",
    bookingId,
    status: query.status,
    search: query.search,
    page: String(query.page),
  }, { bookingDateRange, bookingListSort: query.sort, bookingAmountFromCents: query.amountFromCents, bookingAmountToCents: query.amountToCents });
}

export async function loadDashboardAgency(repository: DashboardRepository, actorId: string, query: DashboardAgencyDetailQuery, agencyId: string): Promise<DashboardReport> {
  const bookingDateRange = query.checkInFrom && query.checkInTo ? { month: query.month, start: query.checkInFrom, end: nextDay(query.checkInTo) } : undefined;
  return loadDashboard(repository, actorId, {
    month: query.month, view: "agency", agency: agencyId,
    status: query.status, search: query.bookingSearch, page: String(query.bookingsPage),
    agencySearch: query.search, agenciesPage: String(query.page),
  }, {
    bookingDateRange, bookingListSort: query.sort,
    bookingAgencyId: agencyId === "unassigned" ? null : agencyId,
    bookingAmountFromCents: query.amountFromCents, bookingAmountToCents: query.amountToCents,
  });
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
