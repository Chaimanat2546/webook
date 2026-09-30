import { LayoutDashboard } from "lucide-react";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { DashboardOverviewView } from "./dashboard-overview";

export function DashboardHeader({ month, scope }: { month: string; scope?: string }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />ภาพรวมธุรกิจ</h1><p className="mt-1 text-sm text-muted-foreground">{scope ? `สรุปรายเดือน · ${scope}` : "สรุปรายเดือน"}</p></div><form action="/admin/dashboard" method="get" className="flex items-end gap-2"><label htmlFor="dashboard-month" className="grid gap-1 text-sm">เดือน<Input id="dashboard-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} required /></label><Button type="submit">ดูข้อมูล</Button></form></div>;
}

export function DashboardView({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  return <div className="mx-auto max-w-7xl space-y-5"><DashboardHeader month={report.month} scope={report.scope.kind === "admin" ? "ทุกบ้าน" : `บ้าน DV-${report.scope.propertyId}`} />{query.view === "overview" ? <DashboardOverviewView report={report} query={query} /> : <DashboardOverviewView report={report} query={query} />}</div>;
}
