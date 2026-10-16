"use client";

import { useState } from "react";
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
}

export function WebsiteSiteSummaryGraph({ granularity, sites, month, range, asOf, compare = false, previous, scope }: WebsiteSiteSummaryGraphProps) {
  const [view, setView] = useState<"daily" | "total">("daily");
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const visibility = useDatasetVisibility(sites, previous?.sites ?? [], scope);

  return <div className="min-w-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="มุมมองกราฟเว็บไซต์" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={view === "daily" ? "default" : "ghost"} aria-pressed={view === "daily"} onClick={() => setView("daily")}>{granularity === "hour" ? "แนวโน้มรายชั่วโมง" : "แนวโน้มรายวัน"}</Button>
        <Button type="button" variant={view === "total" ? "default" : "ghost"} aria-pressed={view === "total"} onClick={() => setView("total")}>ยอดรวมแต่ละเว็บ</Button>
      </div>
      {(view === "daily" || compare) && <div role="group" aria-label={compare ? "เลือกสถิติเปรียบเทียบ" : "เลือกสถิติรายวัน"} className="flex flex-wrap gap-1">
        {([
          ["contact_clicks", "กดติดต่อรวม"],
          ["page_views", "เข้าชม"],
          ["gallery_opens", "เปิดรูป"],
        ] as const).map(([key, label]) => <Button key={key} type="button" variant={metric === key ? "default" : "outline"} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</Button>)}
      </div>}
    </div>
    {compare && range && asOf && previous ? <SitePeriodComparison granularity={granularity} sites={sites} range={range} asOf={asOf} previous={previous} view={view} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} /> : <>
      {compare && <p role="status" className="mb-3 text-sm text-amber-700">ช่วงก่อนหน้าอยู่นอกวันที่ที่ระบบรองรับ ยังแสดงกราฟช่วงที่เลือกได้ตามปกติ</p>}
      {view === "total" ? <WebsiteSiteSummaryChart sites={sites.filter(site => !visibility.hidden.includes(site.key))} month={month} range={range} legend={<WebsiteChartLegend sites={sites} availableSites={sites.filter(site => site.totals !== null).map(site => site.key)} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />} /> : <WebsiteSiteTrendChart granularity={granularity} asOf={asOf} sites={sites} month={month} range={range} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />}
    </>}
  </div>;
}
