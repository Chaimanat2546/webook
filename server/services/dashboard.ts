import "server-only";
import { dashboardStatus, parseDashboardQuery, type DashboardReport, type DashboardPage, type DashboardSales, type DashboardAgency, type DashboardBooking } from "../../lib/dashboard.ts";
import type { DashboardRepository } from "../repositories/dashboard.ts";

export class DashboardForbidden extends Error {}

function paginate<T>(rows: T[], requestedPage: number): DashboardPage<T> {
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(requestedPage, pages);
  return { rows: rows.slice((page - 1) * 20, page * 20), total: rows.length, page, pages };
}

function addSale(total: DashboardSales, priceCents: number | null) {
  total.count++;
  if (priceCents === null) total.missingPrices++;
  else {
    total.amountCents += priceCents;
    if (!Number.isSafeInteger(total.amountCents)) throw new Error("dashboard_amount_overflow");
  }
}

export async function loadDashboard(repository: DashboardRepository, actorId: string, raw: Record<string, unknown>, now = new Date()): Promise<DashboardReport> {
  // Only the authenticated actor resolves scope. URL role, dv_id and house IDs are ignored.
  const scope = await repository.access(actorId);
  if (!scope) throw new DashboardForbidden();
  const query = parseDashboardQuery(raw, now);
  const [source, houses] = await Promise.all([
    repository.bookings(scope, query),
    scope.kind === "admin" ? repository.newHouses(query) : Promise.resolve([]),
  ]);
  const bookings = source.filter(row => (scope.kind === "admin" || row.propertyId === scope.propertyId)
    && Date.parse(row.createdAt) >= Date.parse(query.start) && Date.parse(row.createdAt) < Date.parse(query.end));
  const sales: DashboardSales = { count: 0, amountCents: 0, missingPrices: 0 };
  const agencies = new Map<string | null, DashboardAgency>();
  const statusCounts: DashboardReport["statusCounts"] = { confirmed: 0, waiting: 0, cancelled: 0, repair: 0, unknown: 0 };
  for (const booking of bookings) {
    statusCounts[dashboardStatus(booking.status)]++;
    if (booking.status !== "confirmed") continue;
    addSale(sales, booking.priceCents);
    if (scope.kind === "admin") {
      const group = agencies.get(booking.agentId) ?? { id: booking.agentId, name: booking.agentName ?? (booking.agentId ? "เอเจนซี่ที่ไม่มีชื่อในระบบ" : "ไม่ระบุเอเจนซี่"), count: 0, amountCents: 0, missingPrices: 0 };
      addSale(group, booking.priceCents);
      agencies.set(booking.agentId, group);
    }
  }
  // Project safe booking fields; owner responses never include agency details.
  const visibleBookings: DashboardBooking[] = bookings.filter(row =>
    (query.status === "all" || dashboardStatus(row.status) === query.status)
    && (scope.kind !== "admin" || !query.agency || (row.agentId ?? "unassigned") === query.agency)
    && (!query.search || [row.code, row.houseTitle, row.propertyId, `DV-${row.propertyId}`].some(value => value.toLocaleLowerCase("th").includes(query.search.toLocaleLowerCase("th"))))
  ).map(row => ({ id: row.id, code: row.code, propertyId: row.propertyId, houseTitle: row.houseTitle, checkIn: row.checkIn, checkOut: row.checkOut, createdAt: row.createdAt, status: row.status, priceCents: row.priceCents }));
  return {
    scope, month: query.month, bookingCount: bookings.length, statusCounts,
    waitingCount: bookings.filter(row => row.status === "waiting").length,
    sales, bookings: paginate(visibleBookings, query.page),
    admin: scope.kind === "admin" ? {
      agencies: [...agencies.values()].sort((a, b) => b.amountCents - a.amountCents || b.count - a.count || a.name.localeCompare(b.name, "th")),
      houses: paginate(houses, query.housesPage),
    } : null,
  };
}
