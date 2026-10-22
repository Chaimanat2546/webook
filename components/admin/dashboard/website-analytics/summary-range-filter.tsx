"use client";

import { useWebsiteAnalyticsTransition } from "./analytics-loading";
import { useRouter } from "next/navigation";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import { dashboardAnalyticsFilterParams } from "../../../../lib/website-analytics-scope";
import { useWebsiteMobileFilterDraft } from "./mobile-filter-draft";

export function SummaryRangeFilter({ month, range, today, availableFrom }: { month: string; range: AnalyticsDateRange; today: string; availableFrom?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const filterDraft = useWebsiteMobileFilterDraft();
  function navigate(draft: AnalyticsDateRange) {
    if (filterDraft) { filterDraft.onRangeChange(draft); return; }
    const params = dashboardAnalyticsFilterParams(new URLSearchParams(window.location.search), month, draft);
    startTransition(() => router.push(`/admin/dashboard?${params}`, { scroll: false }));
  }
  return <div className="w-fit min-w-0 max-w-full space-y-2" aria-busy={pending}>
    <WebsiteDateRangePicker month={month} range={filterDraft?.range ?? range} today={today} availableFrom={availableFrom} pastOnly compactShortcuts loading={pending} className="w-fit max-w-full text-xs" label="ช่วงวันที่สถิติเข้าเว็บไซต์" onChange={navigate} />
  </div>;
}
