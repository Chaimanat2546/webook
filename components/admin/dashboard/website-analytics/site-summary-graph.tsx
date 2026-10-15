"use client";

import { useState } from "react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { Button } from "../../../ui/button";
import { WebsiteSiteSummaryChart } from "./site-summary-chart";
import { WebsiteSiteTrendChart } from "./site-trend-chart";

interface WebsiteSiteSummaryGraphProps {
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
}

export function WebsiteSiteSummaryGraph({ sites, month, range }: WebsiteSiteSummaryGraphProps) {
  const [view, setView] = useState<"daily" | "total">("daily");
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const [hiddenSites, setHiddenSites] = useState<string[]>([]);

  return <div className="min-w-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="มุมมองกราฟเว็บไซต์" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={view === "daily" ? "default" : "ghost"} className="min-h-11" aria-pressed={view === "daily"} onClick={() => setView("daily")}>แนวโน้มรายวัน</Button>
        <Button type="button" variant={view === "total" ? "default" : "ghost"} className="min-h-11" aria-pressed={view === "total"} onClick={() => setView("total")}>ยอดรวมแต่ละเว็บ</Button>
      </div>
      {view === "daily" && <div role="group" aria-label="เลือกสถิติรายวัน" className="flex flex-wrap gap-1">
        {([
          ["contact_clicks", "กดติดต่อรวม"],
          ["page_views", "เข้าชม"],
          ["gallery_opens", "เปิดรูป"],
        ] as const).map(([key, label]) => <Button key={key} type="button" variant={metric === key ? "default" : "outline"} className="min-h-11" aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</Button>)}
      </div>}
    </div>
    {view === "total" ? <WebsiteSiteSummaryChart sites={sites} month={month} range={range} /> : <WebsiteSiteTrendChart sites={sites} month={month} range={range} metric={metric} hiddenSites={hiddenSites} onToggleSite={key => setHiddenSites(previous => previous.includes(key) ? previous.filter(site => site !== key) : [...previous, key])} />}
  </div>;
}
