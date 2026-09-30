import type { DashboardQuery, DashboardSourceView, DashboardViewName } from "./dashboard";

type DashboardHrefChanges = Partial<Pick<DashboardQuery, "month" | "view" | "from" | "page" | "housesPage" | "agenciesPage" | "status" | "search" | "agency" | "agencySearch" | "houseSearch" | "bookingId" | "houseId">>;

const detailViews = new Set<DashboardViewName>(["booking", "agency", "house"]);

function sourceView(query: DashboardQuery): DashboardSourceView {
  return query.from;
}

function addIfNonDefault(params: URLSearchParams, key: string, value: string | number, defaultValue: string | number) {
  if (value !== defaultValue && value !== "") params.set(key, String(value));
}

export function dashboardHref(query: DashboardQuery, changes: DashboardHrefChanges = {}): string {
  const merged: DashboardQuery = { ...query, ...changes };
  const changesMonth = changes.month !== undefined && changes.month !== query.month;
  const changesBookingFilter = (changes.status !== undefined && changes.status !== query.status) || (changes.search !== undefined && changes.search !== query.search) || (changes.agency !== undefined && changes.agency !== query.agency);
  const changesAgencyFilter = changes.agencySearch !== undefined && changes.agencySearch !== query.agencySearch;
  const changesHouseFilter = changes.houseSearch !== undefined && changes.houseSearch !== query.houseSearch;
  if (changesMonth) {
    merged.view = "overview";
    merged.from = "overview";
    merged.status = "all";
    merged.search = "";
    merged.agency = "";
    merged.agencySearch = "";
    merged.houseSearch = "";
    merged.bookingId = "";
    merged.houseId = "";
    merged.page = 1;
    merged.agenciesPage = 1;
    merged.housesPage = 1;
  } else {
    if (changesBookingFilter) merged.page = 1;
    if (changesAgencyFilter) merged.agenciesPage = 1;
    if (changesHouseFilter) merged.housesPage = 1;
  }
  const params = new URLSearchParams();
  params.set("month", merged.month);
  addIfNonDefault(params, "view", merged.view, "overview");
  if (detailViews.has(merged.view)) addIfNonDefault(params, "from", merged.from, "overview");
  if (merged.view === "booking") addIfNonDefault(params, "bookingId", merged.bookingId, "");
  if (merged.view === "house") addIfNonDefault(params, "houseId", merged.houseId, "");
  addIfNonDefault(params, "status", merged.status, "all");
  addIfNonDefault(params, "search", merged.search, "");
  addIfNonDefault(params, "agency", merged.agency, "");
  addIfNonDefault(params, "agencySearch", merged.agencySearch, "");
  addIfNonDefault(params, "page", merged.page, 1);
  addIfNonDefault(params, "agenciesPage", merged.agenciesPage, 1);
  addIfNonDefault(params, "houseSearch", merged.houseSearch, "");
  addIfNonDefault(params, "housesPage", merged.housesPage, 1);
  return `/admin/dashboard?${params.toString()}`;
}

export function dashboardBackHref(query: DashboardQuery): string {
  const view = sourceView(query);
  if (view === "overview") return dashboardHref(query, {
    view,
    from: "overview",
    status: "all",
    search: "",
    agency: "",
    agencySearch: "",
    houseSearch: "",
    bookingId: "",
    houseId: "",
    page: 1,
    agenciesPage: 1,
    housesPage: 1,
  });
  return dashboardHref(query, { view, from: "overview", bookingId: "", houseId: "" });
}
