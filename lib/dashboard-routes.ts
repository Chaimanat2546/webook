import { DASHBOARD_AGENCY_SORTS, parseDashboardQuery, type DashboardAgencySort, type DashboardBookingsQuery, type DashboardListQuery, type DashboardQuery } from "./dashboard.ts";

type RouteRawQuery = Record<string, unknown>;

export interface DashboardAgencyDetailQuery extends DashboardListQuery {
  bookingSearch: string;
  bookingsPage: number;
  sort: DashboardAgencySort;
}

function rejectsForeignBookingParameters(raw: RouteRawQuery) {
  if ("view" in raw || "from" in raw || "housesPage" in raw || "agenciesPage" in raw || "agencySearch" in raw || "houseSearch" in raw || "bookingId" in raw || "houseId" in raw) {
    throw new Error("ตัวกรองไม่ถูกต้อง");
  }
}

export function parseDashboardBookingsQuery(raw: RouteRawQuery): DashboardBookingsQuery {
  rejectsForeignBookingParameters(raw);
  const query = parseDashboardQuery({ ...raw, view: "bookings" });
  return { month: query.month, status: query.status, search: query.search, agency: query.agency, page: query.page };
}

export function dashboardBookingsHref(query: DashboardBookingsQuery, changes: Partial<DashboardBookingsQuery> = {}): string {
  const merged = { ...query, ...changes };
  if (changes.month !== undefined && changes.month !== query.month) {
    merged.status = "all";
    merged.search = "";
    merged.agency = "";
    merged.page = 1;
  } else if (changes.status !== undefined || changes.search !== undefined || changes.agency !== undefined) {
    merged.page = 1;
  }
  const params = new URLSearchParams({ month: merged.month });
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.search) params.set("search", merged.search);
  if (merged.agency) params.set("agency", merged.agency);
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

export function parseDashboardAgenciesQuery(raw: RouteRawQuery): DashboardListQuery {
  return parseDashboardListQuery(raw, "agencies");
}

export function parseDashboardHousesQuery(raw: RouteRawQuery): DashboardListQuery {
  return parseDashboardListQuery(raw, "houses");
}

export function dashboardAgenciesHref(query: DashboardListQuery, changes: Partial<DashboardListQuery> = {}): string {
  return dashboardListHref("/admin/dashboard/agencies", query, changes);
}

export function dashboardAgencyDetailHref(query: DashboardListQuery | DashboardAgencyDetailQuery, agencyId: string, options: { bookingsPage?: number } = {}): string {
  const href = dashboardAgenciesHref(query);
  const [path, search = ""] = href.split("?");
  const detail = new URLSearchParams(search);
  const bookingSearch = "bookingSearch" in query && typeof query.bookingSearch === "string" ? query.bookingSearch : "";
  if (bookingSearch) detail.set("bookingSearch", bookingSearch);
  const sort = "sort" in query ? query.sort : "date-asc";
  if (sort !== "date-asc") detail.set("sort", sort);
  if ((options.bookingsPage ?? 1) > 1) detail.set("bookingsPage", String(options.bookingsPage));
  return `${path}/${encodeURIComponent(agencyId)}?${detail.toString()}`;
}

export function parseDashboardAgencyDetailQuery(raw: RouteRawQuery): DashboardAgencyDetailQuery {
  const { bookingSearch: rawBookingSearch, bookingsPage, sort: rawSort, ...listRaw } = raw;
  const list = parseDashboardAgenciesQuery(listRaw);
  const bookingSearch = parseDashboardQuery({ month: list.month, view: "overview", search: rawBookingSearch }).search;
  const page = parseDashboardQuery({ month: list.month, view: "overview", page: bookingsPage }).page;
  const sort = rawSort ?? "date-asc";
  if (typeof sort !== "string" || !DASHBOARD_AGENCY_SORTS.some(item => item.value === sort)) throw new Error("การเรียงรายการไม่ถูกต้อง");
  return { ...list, bookingSearch, bookingsPage: page, sort: sort as DashboardAgencySort };
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
  const bookings = { month: query.month, status: query.status, search: query.search, agency: query.agency, page: query.page };
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
