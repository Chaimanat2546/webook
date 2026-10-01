import { LayoutDashboard } from "lucide-react";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { DashboardOverviewView } from "./dashboard-overview";

export function DashboardHeader({ month, scope, action = "/admin/dashboard", title = "ภาพรวมธุรกิจ", description, showMonth = true }: { month: string; scope?: string; action?: string; title?: string; description?: string; showMonth?: boolean }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}{scope && <p className="mt-1 text-sm text-muted-foreground">{scope}</p>}</div>{showMonth && <form action={action} method="get" className="flex items-end gap-2"><label htmlFor="dashboard-month" className="grid gap-1 text-sm">เดือน<Input id="dashboard-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} required /></label><Button type="submit">ดูข้อมูล</Button></form>}</div>;
}

export function DashboardView({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5"><DashboardHeader month={report.month} scope={report.scope.kind === "owner" ? `บ้าน DV-${report.scope.propertyId}` : undefined} /><DashboardOverviewView report={report} query={query} /></div>;
}
