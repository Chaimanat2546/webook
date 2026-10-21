import { CalendarDays, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { dashboardDateFilter, type DashboardDateFilter, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { DashboardDateRangePicker } from "./dashboard-date-range-picker";
import { DashboardOverviewView } from "./dashboard-overview";
import { DashboardMobileOverview, DashboardMobileSectionTitle } from "./dashboard-mobile-overview";

export function DashboardHeader({ month, dateFrom, dateTo, timeFrom, timeTo, scope, action = "/admin/dashboard", title = "ภาพรวมธุรกิจ", description, showMonth = true }: DashboardDateFilter & { month: string; scope?: string; action?: string; title?: string; description?: string; showMonth?: boolean }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}{scope && <p className="mt-1 text-sm text-muted-foreground">{scope}</p>}</div>{showMonth && <DashboardDateRangePicker action={action} month={month} dateFrom={dateFrom} dateTo={dateTo} timeFrom={timeFrom} timeTo={timeTo} />}</div>;
}

export function DashboardView({ report, query, websiteSummary }: { report: DashboardReport; query: DashboardQuery; websiteSummary?: ReactNode }) {
  const websites = report.scope.kind === "admin" && Boolean(websiteSummary);
  const date = (value: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(value));
  const from = query.dateFrom ? `${query.dateFrom}T00:00:00+07:00` : query.start;
  const to = query.dateTo ? `${query.dateTo}T00:00:00+07:00` : new Date(Date.parse(query.end) - 1).toISOString();
  return <div className="dashboard-overview mx-auto min-w-0 max-w-7xl space-y-5">
    <div className="hidden md:block"><DashboardHeader {...dashboardDateFilter(query)} month={report.month} scope={report.scope.kind === "owner" ? `บ้าน DV-${report.scope.propertyId}` : undefined} /></div>
    <div className="-mx-4 -mt-5 flex items-center gap-2 border-b bg-background px-4 py-3 md:hidden"><CalendarDays aria-hidden className="size-5 shrink-0 text-teal-600" /><div className="min-w-0 flex-1"><h1 className="text-xs font-semibold">{date(from)} – {date(to)}</h1><p className="text-[10px] text-muted-foreground">เวลาไทย (ICT) · {query.timeFrom ?? "00:00"}–{query.timeTo ?? "24:00"} น.{report.scope.kind === "owner" && ` · DV-${report.scope.propertyId}`}</p></div><DashboardDateRangePicker compact {...dashboardDateFilter(query)} month={report.month} action="/admin/dashboard" /></div>
    <div className="hidden md:block"><DashboardOverviewView report={report} query={query} /></div>
    <DashboardMobileOverview report={report} query={query} websites={websites} />
    {websites && <section id="dashboard-websites" data-dashboard-section className="scroll-mt-4"><div className="md:hidden"><DashboardMobileSectionTitle title="แนวโน้มประสิทธิภาพเว็บไซต์" step="4/4" /></div>{websiteSummary}</section>}
    <p className="px-3 pt-4 pb-8 text-center text-[11px] leading-relaxed text-muted-foreground md:hidden">ระบบ WeBooks · ข้อมูลตามช่วงเวลาที่เลือก<br />แสดงเฉพาะข้อมูลที่มีในระบบ</p>
  </div>;
}
