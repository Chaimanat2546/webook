"use client";

import { useWebsiteAnalyticsTransition } from "./analytics-loading";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { AnalyticsDateRange, WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { previousAnalyticsRange, websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import { scopeSearchParams, type WebsiteDatasetSelection, type WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { Button } from "../../../ui/button";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import type { WebsiteOption } from "./filters";
import { useWebsiteMobileFilterDraft } from "./mobile-filter-draft";


interface WebsiteDatasetControlsProps {
  granularity: "hour" | "day";
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
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const filterDraft = useWebsiteMobileFilterDraft();
  const selectedRange = filterDraft?.range ?? range;
  const selectedComparison = filterDraft ? filterDraft.comparison : comparison;
  const selectedSites = scope?.sites ?? (query && query.site !== "all" ? [query.site] : sites.map(site => site.key));
  const initialComparison = previousAnalyticsRange(selectedRange) ?? selectedRange;
  function navigate(next?: AnalyticsDateRange) {
    const nextComparison = next ? { ...next, sites: scope?.comparison?.sites ?? selectedComparison?.sites ?? comparison?.sites ?? selectedSites } : undefined;
    if (filterDraft) { filterDraft.onComparisonChange(nextComparison); return; }
    const selection: WebsiteScopeSelection = { sites: selectedSites, ...(nextComparison ? { comparison: nextComparison } : {}) };
    const href = query ? websitePeriodHref(query, { granularity: "day" }, Boolean(next), selection) : `/admin/dashboard?${scopeSearchParams(new URLSearchParams(window.location.search), selection)}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }
  return <div className="flex w-fit min-w-0 max-w-full flex-wrap items-center gap-1" aria-busy={pending}>
    {selectedComparison ? <div className="flex w-fit min-w-0 max-w-full items-center gap-1">
      <span className="shrink-0 text-xs text-muted-foreground">ชุดเทียบ</span>
      <WebsiteDateRangePicker range={selectedComparison} matchPrimary={selectedRange} month={selectedComparison.to.slice(0, 7)} today={today} pastOnly showShortcuts={false} loading={pending} className="w-fit min-w-0 max-w-full shrink text-xs" label="ช่วงวันที่ชุดเปรียบเทียบ" onChange={navigate} />
      <Button type="button" variant="ghost" disabled={pending} size="icon" aria-label="เอาชุดเปรียบเทียบออก" onClick={() => navigate()}><X aria-hidden className="size-4" /></Button>
    </div> : <WebsiteDateRangePicker range={initialComparison} matchPrimary={selectedRange} month={initialComparison.to.slice(0, 7)} today={today} pastOnly showShortcuts={false} loading={pending} className="w-fit max-w-full text-xs" label="เพิ่มชุดเปรียบเทียบ" triggerContent={<><Plus aria-hidden className="size-4" />เพิ่มชุดเปรียบเทียบ</>} onChange={navigate} />}
  </div>;
}
