import { notFound } from "next/navigation";
import { parseDashboardQuery } from "../../../../../lib/dashboard";
import { dashboardHouseDetailHref, dashboardHousesHref, parseDashboardHousesQuery } from "../../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardHouse } from "../../../../../server/services/dashboard";
import { DashboardDetails } from "../../../../../components/admin/dashboard/dashboard-details";

export default async function DashboardHouseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const raw = await searchParams;
  const { actorId, repository } = await dashboardSession();
  let routeQuery;
  let report;
  const { from, ...listRaw } = raw;
  try {
    if (from !== undefined && from !== "overview") notFound();
    routeQuery = parseDashboardHousesQuery(listRaw);
    report = await loadDashboardHouse(repository, actorId, routeQuery, id);
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    notFound();
  }
  const query = parseDashboardQuery({ month: routeQuery.month, view: "house", from: "houses", houseId: id, houseSearch: routeQuery.search, housesPage: String(routeQuery.page) });
  return <DashboardDetails backHref={from === "overview" ? `/admin/dashboard?month=${encodeURIComponent(routeQuery.month)}` : dashboardHousesHref(routeQuery)} backLabel={from === "overview" ? "กลับไปภาพรวม" : "กลับไปบ้านใหม่"} houseDetailReturnTo={dashboardHouseDetailHref(routeQuery, id, from === "overview" ? "overview" : undefined)} query={query} report={report} />;
}
