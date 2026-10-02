import { notFound } from "next/navigation";
import { parseDashboardQuery } from "../../../../../lib/dashboard";
import { dashboardAgenciesHref, dashboardAgencyDetailHref, dashboardBookingsHref, parseDashboardBookingOrigin, parseDashboardBookingsQuery } from "../../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardBooking } from "../../../../../server/services/dashboard";
import { DashboardDetails } from "../../../../../components/admin/dashboard/dashboard-details";
import { loadDashboardBookingCustomerAction } from "../../actions";

export default async function DashboardBookingDetailPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { bookingId } = await params;
  const raw = await searchParams;
  const { actorId, repository } = await dashboardSession();
  let routeQuery;
  let origin;
  let report;
  try {
    const { fromAgency, agencySearch, agencySort, agencyPage, bookingSearch, bookingsPage, ...bookingRaw } = raw;
    routeQuery = parseDashboardBookingsQuery(bookingRaw);
    origin = parseDashboardBookingOrigin(raw);
    report = await loadDashboardBooking(repository, actorId, routeQuery, bookingId);
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    notFound();
  }
  const query = parseDashboardQuery({ month: routeQuery.month, view: "booking", from: "bookings", bookingId, status: routeQuery.status, search: routeQuery.search, page: String(routeQuery.page) });
  const backHref = origin ? dashboardAgencyDetailHref(origin.query, origin.agencyId) : dashboardBookingsHref(routeQuery);
  return <DashboardDetails backHref={backHref} backLabel={origin ? "กลับไปเอเจนซี่" : "กลับไปการจอง"} loadBookingCustomer={loadDashboardBookingCustomerAction} query={query} report={report} />;
}
