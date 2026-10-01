import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { dashboardSession } from "../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardOverview } from "../../../server/services/dashboard";
import { parseDashboardQuery } from "../../../lib/dashboard";
import { legacyDashboardHref } from "../../../lib/dashboard-routes";
import { DashboardHeader, DashboardView } from "../../../components/admin/dashboard/dashboard-view";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  const access = await repository.access(actorId);
  if (!access) notFound();
  let query;
  try { query = parseDashboardQuery(raw); }
  catch {
    return <div className="space-y-4"><DashboardHeader month={parseDashboardQuery({}).month} /><p role="alert">เดือน เลขหน้า หรือตัวกรองไม่ถูกต้อง กรุณาเลือกเดือนอีกครั้ง</p></div>;
  }
  if (raw.view !== undefined || raw.status !== undefined || raw.search !== undefined || raw.agency !== undefined || raw.agencySearch !== undefined || raw.houseSearch !== undefined || raw.page !== undefined || raw.agenciesPage !== undefined || raw.housesPage !== undefined || raw.bookingId !== undefined || raw.houseId !== undefined) redirect(legacyDashboardHref(query));
  let report;
  try {
    report = await loadDashboardOverview(repository, actorId, { month: query.month });
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    return <div className="space-y-4"><DashboardHeader month={query.month} /><div role="alert" className="rounded-lg border p-6">โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองอีกครั้ง <Link className="underline" href={`/admin/dashboard?month=${query.month}`}>โหลดใหม่</Link></div></div>;
  }
  return <DashboardView report={report} query={query} />;
}
