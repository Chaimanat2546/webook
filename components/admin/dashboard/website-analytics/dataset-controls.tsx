"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { AnalyticsDateRange, WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { previousAnalyticsRange, websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import { scopeSearchParams, type WebsiteDatasetSelection, type WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { Button } from "../../../ui/button";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import type { WebsiteOption } from "./filters";


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
export function WebsiteDatasetControls({ granularity, range, today, sites, comparison, query, scope }: WebsiteDatasetControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selectedSites = scope?.sites ?? (query && query.site !== "all" ? [query.site] : sites.map(site => site.key));
  const matchDisabledReason = granularity === "day" && range.from === range.to ? "เลือกช่วงหลักจากปฏิทินก่อนปรับเงื่อนไข" : undefined;
  function navigate(next?: AnalyticsDateRange) {
    const selection: WebsiteScopeSelection = { sites: selectedSites, ...(next ? { comparison: { ...next, sites: scope?.comparison?.sites ?? comparison?.sites ?? selectedSites } } : {}) };
    const href = query ? websitePeriodHref(query, { granularity: "day" }, Boolean(next), selection) : `/admin/dashboard?${scopeSearchParams(new URLSearchParams(window.location.search), selection)}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }
  return <div className="flex w-fit min-w-0 max-w-full flex-wrap items-center gap-1" aria-busy={pending}>
    {comparison ? <div className="flex w-fit min-w-0 max-w-full items-center gap-1">
      <span className="shrink-0 text-xs text-muted-foreground">ชุดเทียบ</span>
      <WebsiteDateRangePicker range={comparison} matchPrimary={range} matchDisabledReason={matchDisabledReason} month={comparison.to.slice(0, 7)} today={today} pastOnly showShortcuts={false} loading={pending} className="w-fit min-w-0 max-w-full shrink text-xs" label="ช่วงวันที่ชุดเปรียบเทียบ" onChange={navigate} />
      <Button type="button" variant="ghost" disabled={pending} size="icon" aria-label="เอาชุดเปรียบเทียบออก" onClick={() => navigate()}><X aria-hidden className="size-4" /></Button>
    </div> : <Button type="button" variant="outline" disabled={pending || !previousAnalyticsRange(range)} className="max-w-full text-xs" onClick={() => { const previous = previousAnalyticsRange(range); if (previous) navigate(previous); }}><Plus aria-hidden className="size-4" />เพิ่มชุดเปรียบเทียบ</Button>}
    {pending && <span role="status" className="text-xs text-muted-foreground">กำลังโหลดกราฟ…</span>}
  </div>;
}
