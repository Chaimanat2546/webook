export type DashboardScope = { kind: "admin" } | { kind: "owner"; propertyId: string };

export interface DashboardMonth {
  month: string;
  start: string;
  end: string;
}

export interface DashboardQuery extends DashboardMonth {
  page: number;
  housesPage: number;
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
  sales: DashboardSales;
  bookings: DashboardPage<DashboardBooking>;
  admin: { agencies: DashboardAgency[]; houses: DashboardPage<DashboardHouse> } | null;
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
  function page(value: unknown): number {
    if (value === undefined) return 1;
    if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw new Error("เลขหน้าไม่ถูกต้อง");
    return Number(value);
  }
  return {
    month,
    start: new Date(Date.UTC(year, number - 1, 1) - 7 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.UTC(year, number, 1) - 7 * 60 * 60 * 1000).toISOString(),
    page: page(raw.page),
    housesPage: page(raw.housesPage),
  };
}

export function dashboardMoney(cents: number): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(cents / 100);
}

export function dashboardDate(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(new Date(value));
}
