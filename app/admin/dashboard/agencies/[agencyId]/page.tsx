import { notFound } from "next/navigation";
import { parseDashboardQuery } from "../../../../../lib/dashboard";
import { dashboardAgenciesHref, parseDashboardAgencyDetailQuery } from "../../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardAgency } from "../../../../../server/services/dashboard";
import { DashboardDetails } from "../../../../../components/admin/dashboard/dashboard-details";

export default async function DashboardAgencyDetailPage({ params, searchParams }: { params: Promise<{ agencyId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { agencyId } = await params;
  const raw = await searchParams;
  const { actorId, repository } = await dashboardSession();
  let routeQuery;
  let report;
  try {
    routeQuery = parseDashboardAgencyDetailQuery(raw);
    report = await loadDashboardAgency(repository, actorId, routeQuery, agencyId, routeQuery.bookingsPage, routeQuery.bookingSearch, routeQuery.sort);
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    notFound();
  }
  const query = parseDashboardQuery({ month: routeQuery.month, view: "agency", from: "agencies", agency: agencyId, agencySearch: routeQuery.search, agenciesPage: String(routeQuery.page) });
  return <DashboardDetails agencyQuery={routeQuery} backHref={dashboardAgenciesHref(routeQuery)} backLabel="กลับไปเอเจนซี่" query={query} report={report} />;
}
