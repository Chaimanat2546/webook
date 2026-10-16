"use client";

import { useWebsiteAnalyticsTransition } from "./analytics-loading";
import { useRouter } from "next/navigation";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import { parseAnalyticsTimeRange } from "../../../../lib/website-analytics-time";

export function SummaryRangeFilter({ month, range, today, availableFrom }: { month: string; range: AnalyticsDateRange; today: string; availableFrom?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  function navigate(draft: AnalyticsDateRange) {
    const params = new URLSearchParams(window.location.search);
    params.set("month", month);
    params.set("analyticsFrom", draft.from);
    params.set("analyticsTo", draft.to);
    const nextTime = parseAnalyticsTimeRange(draft.timeFrom, draft.timeTo, draft);
    if (nextTime) { params.set("analyticsTimeFrom", nextTime.timeFrom); params.set("analyticsTimeTo", nextTime.timeTo); }
    else { params.delete("analyticsTimeFrom"); params.delete("analyticsTimeTo"); }
    startTransition(() => router.push(`/admin/dashboard?${params}`, { scroll: false }));
  }
  return <div className="w-fit min-w-0 max-w-full space-y-2" aria-busy={pending}>
    <WebsiteDateRangePicker month={month} range={range} today={today} availableFrom={availableFrom} pastOnly compactShortcuts loading={pending} className="w-fit max-w-full text-xs" label="ช่วงวันที่สถิติเข้าเว็บไซต์" onChange={navigate} />
  </div>;
}
