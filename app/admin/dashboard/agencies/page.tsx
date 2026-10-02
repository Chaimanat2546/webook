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
  return <DashboardDetailLayout><DashboardTaskHeader backHref={`/admin/dashboard?month=${routeQuery.month}`} backLabel="กลับไปภาพรวม" description="ตรวจสอบยอดขายตามเอเจนซี่" title="ยอดขายเอเจนซี่" /><AgenciesList report={report} query={routeQuery} /></DashboardDetailLayout>;
}
