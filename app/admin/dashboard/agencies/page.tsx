import { dashboardOverviewHref } from "../../../../lib/dashboard-routes";
import { notFound } from "next/navigation";
import { parseDashboardAgenciesQuery } from "../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../server/auth/dashboard";
import { DashboardForbidden, loadDashboardAgencies } from "../../../../server/services/dashboard";
import { AgenciesList } from "../../../../components/admin/dashboard/agencies-list";
import { DashboardDetailLayout } from "../../../../components/admin/dashboard/dashboard-detail-layout";
import { DashboardTaskHeader } from "../../../../components/admin/dashboard/dashboard-task-header";

export default async function DashboardAgenciesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  let routeQuery;
  try { routeQuery = parseDashboardAgenciesQuery(raw); }
  catch { notFound(); }
  let report;
  try {
    report = await loadDashboardAgencies(repository, actorId, routeQuery);
  } catch (error) {
    if (error instanceof DashboardForbidden) notFound();
    notFound();
  }
  return <DashboardDetailLayout><div className="hidden md:block"><DashboardTaskHeader backHref={dashboardOverviewHref(routeQuery)} backLabel="กลับไปภาพรวม" description="ตรวจสอบยอดขายตามเอเจนซี่" title="ยอดขายเอเจนซี่" /></div><AgenciesList mobileRedesign report={report} query={routeQuery} /></DashboardDetailLayout>;
}
