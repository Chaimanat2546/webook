"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { AnalyticsDateRange, WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { previousAnalyticsRange, websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import { scopeSearchParams, type WebsiteDatasetSelection, type WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { Button } from "../../../ui/button";
import { ReportDateRangePicker } from "../report-date-range-picker";
import type { WebsiteOption } from "./filters";

import { parseAnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { WebsiteTimeRangeFilter } from "./website-time-range-filter";

interface WebsiteDatasetControlsProps {
  range: AnalyticsDateRange;
  today: string;
  sites: WebsiteOption[];
  comparison?: WebsiteDatasetSelection;
  query?: WebsiteAnalyticsQuery;
  scope?: WebsiteScopeSelection;
}

/** Only adds/edits the optional comparison. Primary dates and the chart legend stay in their original positions. */
export function WebsiteDatasetControls({ range, today, sites, comparison, query, scope }: WebsiteDatasetControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selectedSites = scope?.sites ?? (query ? [query.site] : sites.map(site => site.key));
  const time = comparison ? parseAnalyticsTimeRange(comparison.timeFrom, comparison.timeTo, comparison) : undefined;
  function navigate(next?: AnalyticsDateRange) {
    const selection: WebsiteScopeSelection = { sites: selectedSites, ...(next ? { comparison: { ...next, sites: selectedSites } } : {}) };
    const href = query ? websitePeriodHref(query, { granularity: "day" }, Boolean(next), selection) : `/admin/dashboard?${scopeSearchParams(new URLSearchParams(window.location.search), selection)}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }
  return <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 sm:w-auto" aria-busy={pending}>
    {comparison ? <div className="w-full min-w-0 space-y-2 sm:w-80"><div className="flex w-full min-w-0 items-center gap-1">
      <span className="shrink-0 text-xs text-muted-foreground">เทียบ</span>
      <ReportDateRangePicker range={comparison} month={comparison.to.slice(0, 7)} today={today} pastOnly showShortcuts={false} loading={pending} className="min-w-0 flex-1 shrink text-xs" label="ช่วงวันที่ชุดเปรียบเทียบ" onChange={draft => navigate({ ...draft, ...(draft.from === draft.to ? time : {}) })} />
      <Button type="button" variant="ghost" disabled={pending} size="icon" aria-label="เอาชุดเปรียบเทียบออก" onClick={() => navigate()}><X aria-hidden className="size-4" /></Button>
    </div>{time && <WebsiteTimeRangeFilter key={`${comparison.from}:${time.timeFrom}:${time.timeTo}`} idPrefix="analytics-comparison" value={time} pending={pending} onApply={next => navigate({ ...comparison, ...next })} />}</div> : <Button type="button" variant="outline" disabled={pending || !previousAnalyticsRange(range)} className="max-w-full text-xs" onClick={() => { const previous = previousAnalyticsRange(range); if (previous) navigate(previous); }}><Plus aria-hidden className="size-4" />เพิ่มชุดเปรียบเทียบ</Button>}
    {pending && <span role="status" className="text-xs text-muted-foreground">กำลังโหลดกราฟ…</span>}
  </div>;
}
