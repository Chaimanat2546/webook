"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyticsDateRange, analyticsPeriodGranularity, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { Button } from "../../../ui/button";
import { Card, CardContent } from "../../../ui/card";
import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { ChartPeriodToggle } from "./chart-period-toggle";
import { useWebsiteAnalyticsTransition, WebsiteChartLoading } from "./analytics-loading";
import { WebsiteDatasetControls } from "./dataset-controls";

export function WebsiteMobileOverviewTrend({ report, query, scope }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery; scope?: WebsiteScopeSelection }) {
  const [metric, setMetric] = useState<WebsiteChartMetric>("contact_clicks");
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const granularity = analyticsPeriodGranularity(report.period);
  return <Card className="rounded-3xl py-4 shadow-none"><CardContent className="space-y-4 px-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="เลือกสถิติแนวโน้มบนมือถือ" className="flex gap-1">
        {([["contact_clicks", "ติดต่อ"], ["page_views", "เข้าชม"], ["gallery_opens", "เปิดรูป"]] as const).map(([key, label]) => <Button key={key} type="button" disabled={pending} variant={metric === key ? "default" : "outline"} aria-pressed={metric === key} className="h-8 rounded-full px-3 text-xs" onClick={() => setMetric(key)}>{label}</Button>)}
      </div>
      <span className="text-[11px] text-muted-foreground">ครั้ง/{granularity === "hour" ? "ชั่วโมง" : "วัน"}</span>
    </div>
    <WebsiteChartLoading><WebsiteSiteTrendChart compact granularity={granularity} sites={report.websites} month={query.month} range={analyticsDateRange(report.period)} asOf={report.period.as_of} metric={metric} hiddenSites={[]} onToggleSite={() => {}} showLegend={report.websites.length > 1} /></WebsiteChartLoading>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <WebsiteDatasetControls granularity={granularity} range={analyticsDateRange(report.period)} today={new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 10)} sites={report.websites} query={query} scope={scope} />
      {report.period.contract_version === "1.0" && !query.from && <ChartPeriodToggle value="day" disabled={pending} onChange={granularity => startTransition(() => router.replace(websitePeriodHref(query, { granularity }, false, scope), { scroll: false }))} />}
    </div>
  </CardContent></Card>;
}
