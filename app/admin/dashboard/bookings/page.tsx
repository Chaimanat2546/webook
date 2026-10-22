import { dashboardOverviewHref } from "../../../../lib/dashboard-routes";
import { notFound } from "next/navigation";
import { parseDashboardBookingsQuery } from "../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardBookings } from "../../../../server/services/dashboard";
import { BookingsList } from "../../../../components/admin/dashboard/bookings-list";
import { DashboardTaskHeader } from "../../../../components/admin/dashboard/dashboard-task-header";

export default async function DashboardBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  let routeQuery;
  try { routeQuery = parseDashboardBookingsQuery(raw); }
  catch { notFound(); }
  let report;
  try {
    report = await loadDashboardBookings(repository, actorId, routeQuery);
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    notFound();
  }
  return (
    <div data-dashboard-bookings-mobile className="mx-auto w-full max-w-7xl">
      <div className="hidden md:block"><DashboardTaskHeader backHref={dashboardOverviewHref(routeQuery)} backLabel="กลับไปภาพรวม" description="ตรวจสอบและจัดการรายการจอง" title="รายการจอง" /></div>
      <BookingsList mobileRedesign report={report} query={routeQuery} />
    </div>
  );
}
