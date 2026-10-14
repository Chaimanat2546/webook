import { Suspense } from "react";
import { WebsiteSiteSummaryLoader } from "../../../components/admin/dashboard/website-analytics/site-summary-loader";
import { WebsiteSiteSummarySkeleton } from "../../../components/admin/dashboard/website-analytics/site-summary-skeleton";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { dashboardSession } from "../../../server/auth/dashboard";
import { DashboardForbidden, DashboardItemNotFound, loadDashboardOverview } from "../../../server/services/dashboard";
import { dashboardDateFilter, parseDashboardQuery } from "../../../lib/dashboard";
import { dashboardOverviewHref, legacyDashboardHref } from "../../../lib/dashboard-routes";
import { DashboardHeader, DashboardView } from "../../../components/admin/dashboard/dashboard-view";
import { parseAnalyticsDateRange } from "../../../lib/website-analytics";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actorId, repository } = await dashboardSession();
  const raw = await searchParams;
  const access = await repository.access(actorId);
  if (!access) notFound();
  let query;
  let analyticsRange;
  try { query = parseDashboardQuery(raw); analyticsRange = parseAnalyticsDateRange(raw.analyticsFrom, raw.analyticsTo); }
  catch {
    return <div className="space-y-4"><DashboardHeader month={parseDashboardQuery({}).month} /><p role="alert">ช่วงวันที่ไม่ถูกต้อง กรุณาตรวจสอบวันเริ่มต้นและวันสิ้นสุด (สถิติเข้าเว็บไซต์เลือกได้ถึงวันนี้)</p><Link href="/admin/dashboard">กลับ Dashboard</Link></div>;
  }
  if (raw.view !== undefined || raw.status !== undefined || raw.search !== undefined || raw.agency !== undefined || raw.agencySearch !== undefined || raw.houseSearch !== undefined || raw.page !== undefined || raw.agenciesPage !== undefined || raw.housesPage !== undefined || raw.bookingId !== undefined || raw.houseId !== undefined) redirect(legacyDashboardHref(query));
  let report;
  try {
    report = await loadDashboardOverview(repository, actorId, { month: query.month, ...dashboardDateFilter(query) });
  } catch (error) {
    if (error instanceof DashboardForbidden || error instanceof DashboardItemNotFound) notFound();
    return <div className="space-y-4"><DashboardHeader {...dashboardDateFilter(query)} month={query.month} /><div role="alert" className="rounded-lg border p-6">โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองอีกครั้ง <Link className="underline" href={dashboardOverviewHref(query)}>โหลดใหม่</Link></div></div>;
  }
  const today = new Date(new Date().getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const summaryRange = analyticsRange ?? (query.dateFrom && query.dateTo && query.dateFrom <= today ? { from: query.dateFrom, to: query.dateTo > today ? today : query.dateTo } : undefined);
  return <DashboardView report={report} query={query} websiteSummary={report.scope.kind === "admin" ? <Suspense key={`${query.month}:${query.dateFrom}:${query.dateTo}:${summaryRange?.from}:${summaryRange?.to}`} fallback={<WebsiteSiteSummarySkeleton />}><WebsiteSiteSummaryLoader month={!analyticsRange && query.dateFrom && query.dateFrom > today ? query.dateFrom.slice(0, 7) : query.month} range={summaryRange} /></Suspense> : undefined} />;
}
