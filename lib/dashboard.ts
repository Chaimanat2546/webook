export type DashboardScope = { kind: "admin" } | { kind: "owner"; propertyId: string };

export interface DashboardMonth {
  month: string;
  start: string;
  end: string;
}

export const DASHBOARD_VIEWS = ["overview", "bookings", "agencies", "houses", "booking", "agency", "house"] as const;
export type DashboardViewName = typeof DASHBOARD_VIEWS[number];
export const DASHBOARD_SOURCE_VIEWS = ["overview", "bookings", "agencies", "houses"] as const;
export type DashboardSourceView = typeof DASHBOARD_SOURCE_VIEWS[number];

export interface DashboardQuery extends DashboardMonth {
  view: DashboardViewName;
  from: DashboardSourceView;
  page: number;
  housesPage: number;
  agenciesPage: number;
  status: string;
  search: string;
  agency: string;
  agencySearch: string;
  houseSearch: string;
  bookingId: string;
  houseId: string;
}

export interface DashboardBookingsQuery {
  month: string;
  status: string;
  search: string;
  agency: string;
  page: number;
}

export interface DashboardOverviewQuery {
  month: string;
}

export interface DashboardListQuery {
  month: string;
  search: string;
  page: number;
}

export const DASHBOARD_AGENCY_SORTS = [
  { value: "date-asc", label: "วันเข้าพักใกล้สุด" },
  { value: "date-desc", label: "วันเข้าพักไกลสุด" },
  { value: "price-desc", label: "ราคาสูงสุด" },
  { value: "price-asc", label: "ราคาต่ำสุด" },
] as const;
export type DashboardAgencySort = typeof DASHBOARD_AGENCY_SORTS[number]["value"];

export const DASHBOARD_STATUSES = [
  { value: "confirmed", label: "ติดจอง" },
  { value: "waiting", label: "รอโอน" },
  { value: "cancelled", label: "ยกเลิก" },
  { value: "repair", label: "ปิดซ่อม/ปรับปรุง" },
  { value: "unknown", label: "ไม่ทราบสถานะ" },
] as const;
export type DashboardStatus = typeof DASHBOARD_STATUSES[number]["value"];
export function dashboardStatus(value: string | null): DashboardStatus {
  return DASHBOARD_STATUSES.find(item => item.value === value)?.value ?? "unknown";
}

export function dashboardAgencyChartLabel(value: string): string {
  const name = value.replace(/^\[DEMO(?:\s+(?:LARGE|Dashboard))?\s+\d{4}-\d{2}\]\s*/i, "");
  return name.length > 24 ? `${name.slice(0, 23)}…` : name;
}

export interface DashboardBooking {
  id: string;
  code: string;
  propertyId: string;
  houseTitle: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  status: string | null;
  priceCents: number | null;
  agency?: { id: string | null; name: string };
}

export interface DashboardBookingSource extends DashboardBooking {
  agentId: string | null;
  agentName: string | null;
}

export interface DashboardHouse {
  id: string;
  propertyId: string | null;
  title: string;
  createdAt: string;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  locationZone: string | null;
  propertyType: string | null;
  isActive: boolean | null;
  checkinTime: string | null;
  checkoutTime: string | null;
}

export interface DashboardSales {
  count: number;
  amountCents: number;
  missingPrices: number;
}

export interface DashboardAgency extends DashboardSales {
  id: string | null;
  name: string;
}

export interface DashboardDailyBookingCount {
  date: string;
  count: number;
}

export interface DashboardOverview {
  confirmedBookingsByDay: DashboardDailyBookingCount[];
  topAgencies: DashboardAgency[];
  recentHouses: DashboardHouse[];
  agencyCount: number;
  newHouseCount: number;
}

export interface DashboardBookingDetail {
  kind: "booking";
  booking: DashboardBooking;
  agency?: { id: string | null; name: string };
}

export interface DashboardAgencyDetail {
  kind: "agency";
  agency: DashboardAgency;
  sharePercent: number | null;
  bookings: DashboardPage<DashboardBooking>;
}

export interface DashboardHouseDetail {
  kind: "house";
  house: DashboardHouse;
}

export type DashboardDetail = DashboardBookingDetail | DashboardAgencyDetail | DashboardHouseDetail;

export interface DashboardPage<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
}

export interface DashboardReport {
  scope: DashboardScope;
  month: string;
  bookingCount: number;
  waitingCount: number;
  statusCounts: Record<DashboardStatus, number>;
  sales: DashboardSales;
  overview: DashboardOverview;
  bookings: DashboardPage<DashboardBooking>;
  admin: { agencies: DashboardPage<DashboardAgency>; houses: DashboardPage<DashboardHouse>; selectedAgency: { id: string | null; name: string } | null } | null;
  detail: DashboardDetail | null;
}

export function dashboardPropertyId(value: unknown): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const id = String(value);
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > BigInt("9223372036854775807")) return null;
  return id;
}

export function dashboardScope(identity: { role_id: unknown; dv_id: unknown } | null): DashboardScope | null {
  if (!identity) return null;
  if (identity.role_id === 1) return { kind: "admin" };
  const propertyId = dashboardPropertyId(identity.dv_id);
  return propertyId ? { kind: "owner", propertyId } : null;
}

export function parseDashboardQuery(raw: Record<string, unknown>, now = new Date()): DashboardQuery {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const month = raw.month === undefined ? bangkok.toISOString().slice(0, 7) : raw.month;
  if (typeof month !== "string" || !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("กรุณาเลือกเดือนที่ถูกต้อง (ค.ศ. 1900–2199)");
  }
  const [year, number] = month.split("-").map(Number);
  const status = raw.status ?? "all";
  if (typeof status !== "string" || (status !== "all" && !DASHBOARD_STATUSES.some(item => item.value === status))) throw new Error("สถานะไม่ถูกต้อง");
  function text(value: unknown): string {
    if (value === undefined) return "";
    if (typeof value !== "string" || value.length > 200) throw new Error("ตัวกรองไม่ถูกต้อง");
    return value.trim();
  }
  function page(value: unknown): number {
    if (value === undefined) return 1;
    if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw new Error("เลขหน้าไม่ถูกต้อง");
    return Number(value);
  }
  function view(value: unknown): DashboardViewName | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !DASHBOARD_VIEWS.includes(value as DashboardViewName)) throw new Error("มุมมอง Dashboard ไม่ถูกต้อง");
    return value as DashboardViewName;
  }
  function from(value: unknown): DashboardSourceView {
    if (value === undefined) return "overview";
    if (typeof value !== "string" || !DASHBOARD_SOURCE_VIEWS.includes(value as DashboardSourceView)) throw new Error("ต้นทาง Dashboard ไม่ถูกต้อง");
    return value as DashboardSourceView;
  }
  const requestedView = view(raw.view);
  const resolvedView = requestedView
    ?? (raw.housesPage !== undefined || raw.houseSearch !== undefined ? "houses"
      : raw.agenciesPage !== undefined || raw.agencySearch !== undefined ? "agencies"
        : raw.status !== undefined || raw.search !== undefined || raw.agency !== undefined || raw.page !== undefined ? "bookings"
          : "overview");
  const bookingId = text(raw.bookingId);
  const agency = text(raw.agency);
  const houseId = text(raw.houseId);
  if (resolvedView === "booking" && !bookingId) throw new Error("ไม่พบรหัสการจอง");
  if (resolvedView === "agency" && !agency) throw new Error("ไม่พบเอเจนซี่");
  if (resolvedView === "house" && !houseId) throw new Error("ไม่พบรหัสบ้าน");
  return {
    month,
    start: new Date(Date.UTC(year, number - 1, 1) - 7 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.UTC(year, number, 1) - 7 * 60 * 60 * 1000).toISOString(),
    view: resolvedView,
    from: from(raw.from),
    page: page(raw.page),
    housesPage: page(raw.housesPage),
    agenciesPage: page(raw.agenciesPage),
    status, search: text(raw.search), agency,
    agencySearch: text(raw.agencySearch), houseSearch: text(raw.houseSearch),
    bookingId, houseId,
  };
}

export function dashboardMoney(cents: number): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(cents / 100);
}

export function dashboardDate(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(new Date(value));
}
