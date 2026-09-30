import { notFound } from "next/navigation";
import Link from "next/link";
import { dashboardSession } from "../../../server/auth/dashboard";
import { DashboardForbidden, loadDashboard } from "../../../server/services/dashboard";
import { parseDashboardQuery } from "../../../lib/dashboard";
import { DashboardHeader, DashboardView } from "../../../components/admin/dashboard/dashboard-view";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  const access = await repository.access(actorId);
  if (!access) notFound();
  let query;
  try { query = parseDashboardQuery(raw); }
  catch {
    return <div className="space-y-4"><DashboardHeader month={parseDashboardQuery({}).month} /><p role="alert">เดือนหรือเลขหน้าไม่ถูกต้อง กรุณาเลือกเดือนอีกครั้ง</p></div>;
  }
  let report;
  try {
    report = await loadDashboard(repository, actorId, raw);
  } catch (error) {
    if (error instanceof DashboardForbidden) notFound();
    return <div className="space-y-4"><DashboardHeader month={query.month} /><div role="alert" className="rounded-lg border p-6">โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองอีกครั้ง <Link className="underline" href={`/admin/dashboard?month=${query.month}`}>โหลดใหม่</Link></div></div>;
  }
  return <DashboardView report={report} query={query} />;
}
