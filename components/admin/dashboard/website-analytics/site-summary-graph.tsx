"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { Button } from "../../../ui/button";
import { WebsiteSiteSummaryChart } from "./site-summary-chart";
import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { SitePeriodComparison } from "./site-period-comparison";
import type { WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { WebsiteChartLegend } from "./website-chart-legend";
import { useDatasetVisibility } from "./use-dataset-visibility";
import { AllSitesTrend } from "./all-sites-trend";
import { WebsiteChartLoading, useWebsiteAnalyticsPending } from "./analytics-loading";

interface WebsiteSiteSummaryGraphProps {
  granularity: "hour" | "day";
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
  asOf?: string;
  compare?: boolean;
  previous?: WebsitePreviousPeriod;
  today?: string;
  scope?: WebsiteScopeSelection;
  mobileControls?: ReactNode;
  mobileOverview?: boolean;
}

export function WebsiteSiteSummaryGraph({ granularity, sites, month, range, asOf, compare = false, previous, scope, mobileControls, mobileOverview = false }: WebsiteSiteSummaryGraphProps) {
  const [view, setView] = useState<"daily" | "total" | "combined">("daily");
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const pending = useWebsiteAnalyticsPending();
  const visibility = useDatasetVisibility(sites, previous?.sites ?? [], scope);

  const controls = <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="มุมมองกราฟเว็บไซต์" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Button type="button" disabled={pending} variant={view === "daily" ? "default" : "ghost"} aria-pressed={view === "daily"} onClick={() => setView("daily")}>{granularity === "hour" ? "แนวโน้มรายชั่วโมง" : "แนวโน้มรายวัน"}</Button>
        <Button type="button" disabled={pending} variant={view === "total" ? "default" : "ghost"} aria-pressed={view === "total"} onClick={() => setView("total")}>ยอดรวมแต่ละเว็บ</Button>
        <Button type="button" variant={view === "combined" ? "default" : "ghost"} aria-pressed={view === "combined"} disabled={pending || !range || !asOf} onClick={() => setView("combined")}>แนวโน้มรวมทุกเว็บ</Button>
      </div>
      {(view !== "total" || compare) && <div role="group" aria-label={compare ? "เลือกสถิติเปรียบเทียบ" : granularity === "hour" ? "เลือกสถิติรายชั่วโมง" : "เลือกสถิติรายวัน"} className="flex flex-wrap gap-1">
        {([
          ["contact_clicks", "กดติดต่อรวม"],
          ["page_views", "เข้าชม"],
          ["gallery_opens", "เปิดรูป"],
        ] as const).map(([key, label]) => <Button key={key} type="button" disabled={pending} variant={metric === key ? "default" : "outline"} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</Button>)}
      </div>}
    </div>;
  return <div className="min-w-0" data-dashboard-website-graph={mobileOverview || undefined}>
    {mobileOverview ? <><details className="group mb-4 md:hidden"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-teal-600/25 bg-teal-600/5 px-4 text-sm font-semibold text-teal-600 focus-visible:outline-2 [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden className="size-4" /><span className="flex-1">ตัวกรองและเปรียบเทียบ</span><ChevronDown aria-hidden className="size-4 group-open:rotate-180" /></summary><div className="space-y-4 pt-4">{mobileControls}{controls}</div></details><p className="mb-4 text-xs text-muted-foreground md:hidden">กราฟ{granularity === "hour" ? "รายชั่วโมง" : "รายวัน"} · {metric === "page_views" ? "เข้าชม" : metric === "contact_clicks" ? "กดติดต่อรวม" : "เปิดรูป"} · {sites.length} เว็บไซต์ · {compare ? "กำลังเปรียบเทียบ" : "ยังไม่เปรียบเทียบ"}</p><div className="hidden md:block">{controls}</div></> : controls}
    <WebsiteChartLoading>{view === "combined" && range && asOf ? <AllSitesTrend granularity={granularity} sites={sites} range={range} asOf={asOf} metric={metric} previous={compare ? previous : undefined} /> : compare && range && asOf && previous ? <SitePeriodComparison granularity={granularity} sites={sites} range={range} asOf={asOf} previous={previous} view={view === "total" ? "total" : "daily"} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} /> : <>
      {compare && <p role="status" className="mb-3 text-sm text-amber-700">ช่วงก่อนหน้าอยู่นอกวันที่ที่ระบบรองรับ ยังแสดงกราฟช่วงที่เลือกได้ตามปกติ</p>}
      {view === "total" ? <WebsiteSiteSummaryChart sites={sites.filter(site => !visibility.hidden.includes(site.key))} month={month} range={range} legend={<WebsiteChartLegend sites={sites} availableSites={sites.filter(site => site.totals !== null).map(site => site.key)} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />} /> : <WebsiteSiteTrendChart granularity={granularity} asOf={asOf} sites={sites} month={month} range={range} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />}
    </>}</WebsiteChartLoading>
  </div>;
}
