"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DashboardDateFilter } from "../../../lib/dashboard";
import { dashboardPeriodParams } from "../../../lib/dashboard-routes";
import { ReportDateRangePicker } from "./report-date-range-picker";

export function DashboardDateRangePicker({ action, month, dateFrom, dateTo }: DashboardDateFilter & { action: string; month: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="w-full min-w-0 max-w-full sm:w-auto" aria-busy={pending}><ReportDateRangePicker month={month} range={dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined} loading={pending} onChange={range => {
    const comparePrevious = action === "/admin/dashboard" && new URLSearchParams(window.location.search).get("analyticsCompare") === "previous";
    const params = dashboardPeriodParams({ month: range.to.slice(0, 7), dateFrom: range.from, dateTo: range.to }, comparePrevious);
    const scope = action === "/admin/dashboard" ? new URLSearchParams(window.location.search).get("analyticsScope") : null;
    if (scope) params.set("analyticsScope", scope);
    startTransition(() => router.push(`${action}?${params}`, { scroll: false }));
  }} /></div>;
}
