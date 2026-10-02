import { notFound } from "next/navigation";
import { parseDashboardQuery } from "../../../../../lib/dashboard";
import { dashboardBookingsHref, parseDashboardBookingsQuery } from "../../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardBooking } from "../../../../../server/services/dashboard";
import { DashboardDetails } from "../../../../../components/admin/dashboard/dashboard-details";

export default async function DashboardBookingDetailPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { bookingId } = await params;
  const raw = await searchParams;
  const { actorId, repository } = await dashboardSession();
  let routeQuery;
  let report;
  try {
    routeQuery = parseDashboardBookingsQuery(raw);
    report = await loadDashboardBooking(repository, actorId, routeQuery, bookingId);
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    notFound();
  }
  const query = parseDashboardQuery({ month: routeQuery.month, view: "booking", from: "bookings", bookingId, status: routeQuery.status, search: routeQuery.search, page: String(routeQuery.page) });
  return <DashboardDetails backHref={dashboardBookingsHref(routeQuery)} backLabel="กลับไปการจอง" query={query} report={report} />;
}
