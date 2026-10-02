import { DASHBOARD_AGENCY_LIST_SORTS, DASHBOARD_BOOKING_SORTS, DASHBOARD_STATUSES, parseDashboardQuery, type DashboardAgenciesQuery, type DashboardBookingsQuery, type DashboardBookingSort, type DashboardListQuery, type DashboardQuery } from "./dashboard.ts";

type RouteRawQuery = Record<string, unknown>;

export interface DashboardAgencyDetailQuery extends DashboardAgenciesQuery {
  bookingSearch: string;
  bookingsPage: number;
  status: DashboardBookingsQuery["status"];
  checkInFrom?: string;
  checkInTo?: string;
  amountFromCents?: number;
  amountToCents?: number;
  sort: DashboardBookingSort;
}

function rejectsForeignBookingParameters(raw: RouteRawQuery) {
  if ("view" in raw || "from" in raw || "agency" in raw || "housesPage" in raw || "agenciesPage" in raw || "agencySearch" in raw || "houseSearch" in raw || "bookingId" in raw || "houseId" in raw) {
    throw new Error("ตัวกรองไม่ถูกต้อง");
  }
}

export function parseDashboardBookingsQuery(raw: RouteRawQuery): DashboardBookingsQuery {
  rejectsForeignBookingParameters(raw);
  const query = parseDashboardQuery({ month: raw.month, page: raw.page, search: raw.search });
  const status = raw.status ?? "confirmed";
  if (typeof status !== "string" || (status !== "all" && !DASHBOARD_STATUSES.some(item => item.value === status))) throw new Error("สถานะไม่ถูกต้อง");
  const sort = raw.sort ?? "updated-desc";
  if (typeof sort !== "string" || !DASHBOARD_BOOKING_SORTS.some(item => item.value === sort)) throw new Error("รูปแบบการเรียงลำดับไม่ถูกต้อง");
  const checkInFrom = bookingDate(raw.checkInFrom);
  const checkInTo = bookingDate(raw.checkInTo);
  const amountFromCents = bookingAmount(raw.amountFrom);
  const amountToCents = bookingAmount(raw.amountTo);
  if ((checkInFrom === undefined) !== (checkInTo === undefined) || (checkInFrom && checkInTo && checkInFrom > checkInTo)) throw new Error("ช่วงวันที่เข้าพักไม่ถูกต้อง");
  if (amountFromCents !== undefined && amountToCents !== undefined && amountFromCents > amountToCents) throw new Error("ช่วงยอดจองไม่ถูกต้อง");
  return { month: query.month, status, search: query.search, sort: sort as DashboardBookingSort, page: query.page, ...(checkInFrom && checkInTo ? { checkInFrom, checkInTo } : {}), ...(amountFromCents !== undefined ? { amountFromCents } : {}), ...(amountToCents !== undefined ? { amountToCents } : {}) };
}

function bookingAmount(value: unknown): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("ช่วงยอดจองไม่ถูกต้อง");
  const [baht, satang = ""] = value.split(".");
  const cents = Number(baht) * 100 + Number(satang.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("ช่วงยอดจองไม่ถูกต้อง");
  return cents;
}

function bookingAmountValue(cents: number | undefined): string | undefined {
  if (cents === undefined) return undefined;
  return cents % 100 === 0 ? String(cents / 100) : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function bookingDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("ช่วงวันที่เข้าพักไม่ถูกต้อง");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("ช่วงวันที่เข้าพักไม่ถูกต้อง");
  return value;
}

export function dashboardBookingsHref(query: DashboardBookingsQuery, changes: Partial<DashboardBookingsQuery> = {}): string {
  const merged = { ...query, ...changes };
  if (changes.month !== undefined || changes.status !== undefined || changes.search !== undefined || changes.sort !== undefined || "checkInFrom" in changes || "checkInTo" in changes || "amountFromCents" in changes || "amountToCents" in changes) {
    merged.page = 1;
  }
  const params = new URLSearchParams({ month: merged.month });
  params.set("status", merged.status);
  if (merged.search) params.set("search", merged.search);
  if (merged.checkInFrom && merged.checkInTo) {
    params.set("checkInFrom", merged.checkInFrom);
    params.set("checkInTo", merged.checkInTo);
  }
  const amountFrom = bookingAmountValue(merged.amountFromCents), amountTo = bookingAmountValue(merged.amountToCents);
  if (amountFrom) params.set("amountFrom", amountFrom);
  if (amountTo) params.set("amountTo", amountTo);
  params.set("sort", merged.sort);
  if (merged.page !== 1) params.set("page", String(merged.page));
  return `/admin/dashboard/bookings?${params.toString()}`;
}

export function dashboardBookingDetailHref(query: DashboardBookingsQuery, bookingId: string): string {
  const href = dashboardBookingsHref(query);
  const [path, search = ""] = href.split("?");
  return `${path}/${encodeURIComponent(bookingId)}?${search}`;
}

function parseDashboardListQuery(raw: RouteRawQuery, view: "agencies" | "houses"): DashboardListQuery {
  const foreign = view === "agencies"
    ? ["view", "from", "status", "agency", "housesPage", "agenciesPage", "houseSearch", "bookingId", "houseId", "bookingsPage", "bookingSearch", "section", "sort"]
    : ["view", "from", "status", "agency", "housesPage", "agenciesPage", "agencySearch", "bookingId", "houseId"];
  if (foreign.some(key => key in raw)) throw new Error("ตัวกรองไม่ถูกต้อง");
  const query = parseDashboardQuery({ ...raw, view, ...(view === "agencies" ? { agencySearch: raw.search, agenciesPage: raw.page } : { houseSearch: raw.search, housesPage: raw.page }) });
  return { month: query.month, search: view === "agencies" ? query.agencySearch : query.houseSearch, page: view === "agencies" ? query.agenciesPage : query.housesPage };
}

function dashboardListHref(path: "/admin/dashboard/agencies" | "/admin/dashboard/houses", query: DashboardListQuery, changes: Partial<DashboardListQuery>): string {
  const merged = { ...query, ...changes };
  if (changes.month !== undefined && changes.month !== query.month) {
    merged.search = "";
    merged.page = 1;
  } else if (changes.search !== undefined) merged.page = 1;
  const params = new URLSearchParams({ month: merged.month });
  if (merged.search) params.set("search", merged.search);
  if (merged.page !== 1) params.set("page", String(merged.page));
  return `${path}?${params.toString()}`;
}

export function parseDashboardAgenciesQuery(raw: RouteRawQuery): DashboardAgenciesQuery {
  const list = parseDashboardListQuery(raw, "agencies");
  const agencySort = raw.agencySort;
  if (agencySort === undefined) return list;
  if (typeof agencySort !== "string" || !DASHBOARD_AGENCY_LIST_SORTS.some(item => item.value === agencySort)) throw new Error("การเรียงเอเจนซี่ไม่ถูกต้อง");
  return { ...list, agencySort: agencySort as DashboardAgenciesQuery["agencySort"] };
}

export function parseDashboardHousesQuery(raw: RouteRawQuery): DashboardListQuery {
  return parseDashboardListQuery(raw, "houses");
}

export function dashboardAgenciesHref(query: DashboardAgenciesQuery, changes: Partial<DashboardAgenciesQuery> = {}): string {
  const merged = { ...query, ...changes };
  if (changes.month !== undefined && changes.month !== query.month) {
    merged.search = "";
    merged.page = 1;
  } else if (changes.search !== undefined || changes.agencySort !== undefined) merged.page = 1;
  const params = new URLSearchParams({ month: merged.month });
  if (merged.search) params.set("search", merged.search);
  if (merged.agencySort && merged.agencySort !== "sales-desc") params.set("agencySort", merged.agencySort);
  if (merged.page !== 1) params.set("page", String(merged.page));
  return `/admin/dashboard/agencies?${params.toString()}`;
}

export function dashboardAgencyDetailBookingQuery(query: DashboardAgencyDetailQuery): DashboardBookingsQuery {
  return {
    month: query.month,
    status: query.status,
    search: query.bookingSearch,
    sort: query.sort,
    page: query.bookingsPage,
    ...(query.checkInFrom && query.checkInTo ? { checkInFrom: query.checkInFrom, checkInTo: query.checkInTo } : {}),
    ...(query.amountFromCents !== undefined ? { amountFromCents: query.amountFromCents } : {}),
    ...(query.amountToCents !== undefined ? { amountToCents: query.amountToCents } : {}),
  };
}

function agencyDetailQuery(query: DashboardAgenciesQuery | DashboardAgencyDetailQuery): DashboardAgencyDetailQuery {
  if ("bookingSearch" in query) return query;
  return { ...query, status: "confirmed", bookingSearch: "", bookingsPage: 1, sort: "updated-desc" };
}

export function dashboardAgencyDetailHref(query: DashboardAgenciesQuery | DashboardAgencyDetailQuery, agencyId: string, changes: Partial<DashboardBookingsQuery> = {}): string {
  const detailQuery = agencyDetailQuery(query);
  const current = dashboardAgencyDetailBookingQuery(detailQuery);
  const merged = { ...current, ...changes };
  if (changes.month !== undefined || changes.status !== undefined || changes.search !== undefined || changes.sort !== undefined || "checkInFrom" in changes || "checkInTo" in changes) merged.page = 1;
  const href = dashboardAgenciesHref(detailQuery, changes.month === undefined ? {} : { month: merged.month });
  const [path, search = ""] = href.split("?");
  const detail = new URLSearchParams(search);
  detail.set("status", merged.status);
  if (merged.search) detail.set("bookingSearch", merged.search);
  if (merged.checkInFrom && merged.checkInTo) {
    detail.set("checkInFrom", merged.checkInFrom);
    detail.set("checkInTo", merged.checkInTo);
  }
  const amountFrom = bookingAmountValue(merged.amountFromCents), amountTo = bookingAmountValue(merged.amountToCents);
  if (amountFrom) detail.set("amountFrom", amountFrom);
  if (amountTo) detail.set("amountTo", amountTo);
  detail.set("sort", merged.sort);
  if (merged.page > 1) detail.set("bookingsPage", String(merged.page));
  return `${path}/${encodeURIComponent(agencyId)}?${detail.toString()}`;
}

export function dashboardAgencyBookingDetailHref(query: DashboardAgencyDetailQuery, _agencyId: string, bookingId: string): string {
  const href = dashboardBookingDetailHref(dashboardAgencyDetailBookingQuery(query), bookingId);
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("fromAgency", _agencyId);
  if (query.search) params.set("agencySearch", query.search);
  if (query.agencySort) params.set("agencySort", query.agencySort);
  if (query.page !== 1) params.set("agencyPage", String(query.page));
  params.set("bookingSearch", query.bookingSearch);
  if (query.bookingsPage !== 1) params.set("bookingsPage", String(query.bookingsPage));
  return `${path}?${params.toString()}`;
}

export function parseDashboardBookingOrigin(raw: RouteRawQuery): { agencyId: string; query: DashboardAgencyDetailQuery } | null {
  const fromAgency = raw.fromAgency;
  if (fromAgency === undefined) return null;
  if (typeof fromAgency !== "string" || !/^(unassigned|[a-zA-Z0-9-]{1,128})$/.test(fromAgency)) throw new Error("ต้นทางการจองไม่ถูกต้อง");
  const { fromAgency: _fromAgency, agencySearch, agencySort, agencyPage, bookingSearch, bookingsPage, ...bookingRaw } = raw;
  const bookings = parseDashboardBookingsQuery(bookingRaw);
  const query = parseDashboardAgencyDetailQuery({ ...bookingRaw, search: agencySearch, agencySort, page: agencyPage, bookingSearch: bookingSearch ?? bookings.search, bookingsPage: bookingsPage ?? String(bookings.page) });
  return { agencyId: fromAgency, query };
}

export function parseDashboardAgencyDetailQuery(raw: RouteRawQuery): DashboardAgencyDetailQuery {
  const { bookingSearch: rawBookingSearch, bookingsPage, status, checkInFrom, checkInTo, amountFrom, amountTo, sort, ...listRaw } = raw;
  const list = parseDashboardAgenciesQuery(listRaw);
  const bookings = parseDashboardBookingsQuery({ month: list.month, status, search: rawBookingSearch, checkInFrom, checkInTo, amountFrom, amountTo, sort, page: bookingsPage });
  return {
    ...list,
    status: bookings.status,
    bookingSearch: bookings.search,
    bookingsPage: bookings.page,
    sort: bookings.sort,
    ...(bookings.checkInFrom && bookings.checkInTo ? { checkInFrom: bookings.checkInFrom, checkInTo: bookings.checkInTo } : {}),
    ...(bookings.amountFromCents !== undefined ? { amountFromCents: bookings.amountFromCents } : {}),
    ...(bookings.amountToCents !== undefined ? { amountToCents: bookings.amountToCents } : {}),
  };
}

export function dashboardHousesHref(query: DashboardListQuery, changes: Partial<DashboardListQuery> = {}): string {
  return dashboardListHref("/admin/dashboard/houses", query, changes);
}

export function dashboardHouseDetailHref(query: DashboardListQuery, houseId: string): string {
  const href = dashboardHousesHref(query);
  const [path, search = ""] = href.split("?");
  return `${path}/${encodeURIComponent(houseId)}?${search}`;
}

export function legacyDashboardHref(query: DashboardQuery): string {
  const bookings: DashboardBookingsQuery = { month: query.month, status: query.status, search: query.search, sort: "updated-desc", page: query.page };
  const agencies = { month: query.month, search: query.agencySearch, page: query.agenciesPage };
  const houses = { month: query.month, search: query.houseSearch, page: query.housesPage };
  if (query.view === "bookings") return dashboardBookingsHref(bookings);
  if (query.view === "booking") return dashboardBookingDetailHref(bookings, query.bookingId);
  if (query.view === "agencies") return dashboardAgenciesHref(agencies);
  if (query.view === "agency") return dashboardAgencyDetailHref(agencies, query.agency);
  if (query.view === "houses") return dashboardHousesHref(houses);
  if (query.view === "house") return dashboardHouseDetailHref(houses, query.houseId);
  return `/admin/dashboard?month=${encodeURIComponent(query.month)}`;
}
