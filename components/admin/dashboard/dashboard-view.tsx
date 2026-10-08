import { LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { DashboardMonthPicker } from "./dashboard-month-picker";
import { DashboardOverviewView } from "./dashboard-overview";

export function DashboardHeader({ month, scope, action = "/admin/dashboard", title = "ภาพรวมธุรกิจ", description, showMonth = true }: { month: string; scope?: string; action?: string; title?: string; description?: string; showMonth?: boolean }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}{scope && <p className="mt-1 text-sm text-muted-foreground">{scope}</p>}</div>{showMonth && <DashboardMonthPicker action={action} month={month} />}</div>;
}

export function DashboardView({ report, query, websiteSummary }: { report: DashboardReport; query: DashboardQuery; websiteSummary?: ReactNode }) {
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5"><DashboardHeader month={report.month} scope={report.scope.kind === "owner" ? `บ้าน DV-${report.scope.propertyId}` : undefined} /><DashboardOverviewView report={report} query={query} />{report.scope.kind === "admin" && websiteSummary}</div>;
}
