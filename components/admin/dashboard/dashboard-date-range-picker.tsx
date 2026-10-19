"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DashboardDateFilter } from "../../../lib/dashboard";
import { dashboardPeriodParams } from "../../../lib/dashboard-routes";
import { WebsiteDateRangePicker } from "./website-analytics/website-date-range-picker";

export function DashboardDateRangePicker({ action, month, dateFrom, dateTo, timeFrom, timeTo }: DashboardDateFilter & { action: string; month: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="w-full min-w-0 max-w-full sm:w-auto" aria-busy={pending}><WebsiteDateRangePicker month={month} range={dateFrom && dateTo ? { from: dateFrom, to: dateTo, timeFrom, timeTo } : undefined} loading={pending} onChange={range => {
    const comparePrevious = action === "/admin/dashboard" && new URLSearchParams(window.location.search).get("analyticsCompare") === "previous";
    const params = dashboardPeriodParams({ month: range.to.slice(0, 7), dateFrom: range.from, dateTo: range.to, timeFrom: range.timeFrom, timeTo: range.timeTo }, comparePrevious, action === "/admin/dashboard" ? new URLSearchParams(window.location.search) : undefined);
    startTransition(() => router.push(`${action}?${params}`, { scroll: false }));
  }} /></div>;
}
