"use client";

import { useState } from "react";
import type { WebsiteAnalyticsQuery, WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { visibleWebsitePeriodRows, websitePeriodRows, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { WebsiteDatasetControls } from "./dataset-controls";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import type { WebsiteOption } from "./filters";
import { MultiSitePeriodTrendChart } from "./multi-site-period-trend-chart";
import { PeriodComparisonIssues } from "./period-comparison-issues";
import { PeriodComparisonSummary, PeriodLegend, periodMetricLabels } from "./period-comparison-summary";
import { useDatasetVisibility } from "./use-dataset-visibility";
import { WebsiteDailyChart } from "./daily-chart";

interface WebsitePeriodDetailChartProps {
  report: WebsiteAnalyticsReport;
  query: WebsiteAnalyticsQuery;
  compare: boolean;
  previous?: WebsitePreviousPeriod;
  sites?: WebsiteOption[];
  scope?: WebsiteScopeSelection;
}

export function WebsitePeriodDetailChart({ report, query, compare, previous, sites, scope }: WebsitePeriodDetailChartProps) {
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const range = { from: report.period.from_date, to: report.period.to_date };
  const options = sites ?? [...report.websites, ...(previous?.sites ?? []).filter(site => !report.websites.some(current => current.key === site.key))].map(({ key, displayName }) => ({ key, displayName }));
  const visibility = useDatasetVisibility(options, [], scope ?? { sites: report.websites.map(site => site.key) }, query.site);
  const toggle = <WebsiteDatasetControls range={range} today={new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 10)} sites={options} query={query} scope={scope} comparison={compare && previous ? { ...previous.range, sites: previous.sites.map(site => site.key) } : undefined} />;
  const allRows = previous ? websitePeriodRows(report.websites, range, previous, report.period.as_of, metric) : [];
  const rows = visibleWebsitePeriodRows(allRows, visibility.hidden);
  const row = rows[0];
  if (!compare || !previous || !row) return <div className="space-y-2">
    {compare && <p role="status" className="text-xs text-amber-700">ช่วงก่อนหน้าอยู่นอกวันที่ที่ระบบรองรับ</p>}
    <WebsiteDailyChart points={report.daily} monthly={report.monthly} query={query} available={report.totals !== null} hidden={visibility.hidden.includes(query.site)} onShow={() => visibility.toggle(query.site)} comparisonControl={toggle} scope={scope} />
  </div>;
  return <Card><CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
    <CardTitle><h2>แนวโน้มรายวัน</h2></CardTitle>{toggle}
  </CardHeader><CardContent>
    <figure aria-label="กราฟรายวันเทียบชุดข้อมูลรายเว็บไซต์" className="min-w-0 space-y-2">
      <figcaption className="sr-only">{row.displayName} · {periodMetricLabels[metric]} · ชุดหลักเส้นทึบ ชุดเทียบเส้นประ · เวลาไทย</figcaption>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div role="group" aria-label="เลือกสถิติเปรียบเทียบเว็บไซต์" className="flex flex-wrap gap-1">
          {(["page_views", "contact_clicks", "gallery_opens"] as const).map(key => <Button key={key} type="button" variant={metric === key ? "default" : "outline"} className="min-h-11" aria-pressed={metric === key} onClick={() => setMetric(key)}>{periodMetricLabels[key]}</Button>)}
        </div>
        {rows.length === 1 && <PeriodComparisonSummary {...row} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><PeriodLegend neutral currentRange={range} previousRange={previous.range} /><span className="text-xs text-muted-foreground">ครั้ง/วัน</span></div>
      {rows.length > 1 && <div className="space-y-1">{rows.map(site => <div key={site.key} className="flex flex-wrap items-center justify-between gap-x-3"><span className="text-xs">{site.displayName}</span><PeriodComparisonSummary {...site} /></div>)}<PeriodComparisonIssues rows={rows} /></div>}
      {row.current.expectedDays !== row.previous.expectedDays && <p className="text-xs text-amber-700">ช่วงหลัก {row.current.expectedDays} วัน · ชุดเทียบ {row.previous.expectedDays} วัน · งด % ยอดรวม</p>}
      <MultiSitePeriodTrendChart rows={allRows} colorKeys={options.map(site => site.key)} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} showLegend={options.length > 1} />
    </figure>
  </CardContent></Card>;
}
