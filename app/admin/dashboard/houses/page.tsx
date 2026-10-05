import { notFound } from "next/navigation";
import { parseDashboardHousesQuery } from "../../../../lib/dashboard-routes";
import { dashboardSession } from "../../../../server/auth/dashboard";
import { DashboardForbidden, loadDashboardHouses } from "../../../../server/services/dashboard";
import { NewHousesList } from "../../../../components/admin/dashboard/new-houses-list";
import { DashboardDetailLayout } from "../../../../components/admin/dashboard/dashboard-detail-layout";
import { DashboardTaskHeader } from "../../../../components/admin/dashboard/dashboard-task-header";

export default async function DashboardHousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  let routeQuery;
  try { routeQuery = parseDashboardHousesQuery(raw); }
  catch { notFound(); }
  let report;
  try {
    report = await loadDashboardHouses(repository, actorId, routeQuery);
  } catch (error) {
    if (error instanceof DashboardForbidden) notFound();
    notFound();
  }
  return <DashboardDetailLayout>
    <DashboardTaskHeader backHref={`/admin/dashboard?month=${routeQuery.month}`} backLabel="กลับไปภาพรวม" description="ตรวจสอบบ้านที่เพิ่มเข้าระบบ" title="บ้านใหม่" />
    <NewHousesList report={report} query={routeQuery} />
  </DashboardDetailLayout>;
}
