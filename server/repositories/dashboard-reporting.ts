import "server-only";
import { dashboardPropertyId, type DashboardAgency, type DashboardBookingSource, type DashboardPage, type DashboardReportingResult, type DashboardSales } from "../../lib/dashboard.ts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("dashboard_invalid_data");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("dashboard_invalid_data");
  return value;
}
function nullableText(value: unknown): string | null { return value == null ? null : text(value); }
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("dashboard_invalid_number");
  return value;
}
function money(value: unknown): number | null { return value == null ? null : integer(value); }
function rows<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error("dashboard_invalid_page");
  return value.map(parse);
}
function page<T>(value: unknown, maximum: number, parse: (item: unknown) => T): DashboardPage<T> {
  const r = object(value);
  const result = { rows: rows(r.rows, maximum, parse), total: integer(r.total), page: integer(r.page), pages: integer(r.pages) };
  if (!result.page || result.page > result.pages || result.rows.length > result.total) throw new Error("dashboard_invalid_page");
  return result;
}
function sales(value: unknown): DashboardSales {
  const r = object(value);
  return { count: integer(r.count), amountCents: integer(r.amountCents), missingPrices: integer(r.missingPrices) };
}
function agency(value: unknown): DashboardAgency {
  const r = object(value);
  return { ...sales(r), id: nullableText(r.id), name: text(r.name) };
}
function booking(value: unknown): DashboardBookingSource {
  const r = object(value), propertyId = dashboardPropertyId(r.propertyId);
  if (!propertyId) throw new Error("dashboard_invalid_property");
  return {
    id: text(r.id), code: text(r.code), propertyId, houseTitle: text(r.houseTitle),
    checkIn: text(r.checkIn), checkOut: text(r.checkOut), createdAt: text(r.createdAt), updatedAt: text(r.updatedAt),
    status: nullableText(r.status), priceCents: money(r.priceCents), agentId: nullableText(r.agentId), agentName: nullableText(r.agentName),
    customerId: null, customerFirstName: null, customerLastName: null,
    ...(Object.hasOwn(r, "note") ? {
      note: nullableText(r.note), depositCents: money(r.depositCents), extraChargeCents: money(r.extraChargeCents), insuranceCents: money(r.insuranceCents),
      paymentExpiresAt: nullableText(r.paymentExpiresAt), checkInTime: nullableText(r.checkInTime), checkOutTime: nullableText(r.checkOutTime), createdById: nullableText(r.createdById),
    } : {}),
  };
}

export function parseDashboardReportingResult(value: unknown): DashboardReportingResult {
  const r = object(value), counts = object(r.statusCounts);
  return {
    bookingCount: integer(r.bookingCount), sales: sales(r.sales), totalSalesCents: integer(r.totalSalesCents),
    statusCounts: { confirmed: integer(counts.confirmed), waiting: integer(counts.waiting), cancelled: integer(counts.cancelled), repair: integer(counts.repair), unknown: integer(counts.unknown) },
    daily: rows(r.daily, 367, value => { const day = object(value); return { date: text(day.date), count: integer(day.count) }; }),
    bookings: page(r.bookings, 100, booking), bookingDetail: r.bookingDetail === null ? null : booking(r.bookingDetail),
    agencies: page(r.agencies, 10, agency), selectedAgency: r.selectedAgency === null ? null : agency(r.selectedAgency),
    agencyCount: integer(r.agencyCount), topAgencies: rows(r.topAgencies, 5, agency),
  };
}
