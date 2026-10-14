"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { ReportDateRangePicker } from "../report-date-range-picker";

export function SummaryRangeFilter({ month, range, today, availableFrom }: { month: string; range: AnalyticsDateRange; today: string; availableFrom?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="w-full min-w-0 max-w-full space-y-2 sm:w-auto" aria-busy={pending}>
    <ReportDateRangePicker month={month} range={range} today={today} availableFrom={availableFrom} pastOnly loading={pending} label="ช่วงวันที่สถิติเข้าเว็บไซต์" onChange={draft => {
      if (draft.from === range.from && draft.to === range.to) return;
      const params = new URLSearchParams(window.location.search);
      params.set("month", month);
      params.set("analyticsFrom", draft.from);
      params.set("analyticsTo", draft.to);
      startTransition(() => router.push(`/admin/dashboard?${params}`, { scroll: false }));
    }} />
    {pending && <p role="status" className="text-xs text-muted-foreground">กำลังโหลด…</p>}
  </div>;
}
