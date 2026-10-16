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
  function navigate(next?: AnalyticsDateRange) {
    const selection: WebsiteScopeSelection = { sites: selectedSites, ...(next ? { comparison: { ...next, sites: selectedSites } } : {}) };
    const href = query ? websitePeriodHref(query, { granularity: "day" }, Boolean(next), selection) : `/admin/dashboard?${scopeSearchParams(new URLSearchParams(window.location.search), selection)}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }
  return <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 sm:w-auto" aria-busy={pending}>
    {comparison ? <div className="flex w-full min-w-0 items-center gap-1 sm:w-80">
      <span className="shrink-0 text-xs text-muted-foreground">เทียบ</span>
      <ReportDateRangePicker range={comparison} month={comparison.to.slice(0, 7)} today={today} pastOnly showShortcuts={false} loading={pending} className="min-w-0 flex-1 shrink text-xs" label="ช่วงวันที่ชุดเปรียบเทียบ" onChange={navigate} />
      <Button type="button" variant="ghost" disabled={pending} size="icon" aria-label="เอาชุดเปรียบเทียบออก" onClick={() => navigate()}><X aria-hidden className="size-4" /></Button>
    </div> : <Button type="button" variant="outline" disabled={pending || !previousAnalyticsRange(range)} className="max-w-full text-xs" onClick={() => { const previous = previousAnalyticsRange(range); if (previous) navigate(previous); }}><Plus aria-hidden className="size-4" />เพิ่มชุดเปรียบเทียบ</Button>}
    {pending && <span role="status" className="text-xs text-muted-foreground">กำลังโหลดกราฟ…</span>}
  </div>;
}
