"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyticsPeriodGranularity, analyticsDateRange, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { visibleWebsitePeriodRows, websitePeriodHref, websitePeriodRows, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { WebsiteDatasetControls } from "./dataset-controls";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import type { WebsiteOption } from "./filters";
import { SitePeriodComparison } from "./site-period-comparison";
import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { PeriodComparisonSummary, periodMetricLabels } from "./period-comparison-summary";
import { useDatasetVisibility } from "./use-dataset-visibility";
import { WebsiteDailyChart } from "./daily-chart";
import { WebsiteChartLoading, useWebsiteAnalyticsTransition } from "./analytics-loading";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import { ChartPeriodToggle } from "./chart-period-toggle";

interface WebsitePeriodDetailChartProps {
  report: WebsiteAnalyticsReport;
  query: WebsiteAnalyticsQuery;
  compare: boolean;
  previous?: WebsitePreviousPeriod;
  sites?: WebsiteOption[];
  scope?: WebsiteScopeSelection;
}

export function WebsitePeriodDetailChart({ report, query, compare, previous, sites, scope }: WebsitePeriodDetailChartProps) {
  const router = useRouter();
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const range = analyticsDateRange(report.period);
  const options = sites ?? [...report.websites, ...(previous?.sites ?? []).filter(site => !report.websites.some(current => current.key === site.key))].map(({ key, displayName }) => ({ key, displayName }));
  const visibility = useDatasetVisibility(options, [], scope ?? { sites: report.websites.map(site => site.key) }, query.site);
  const granularity = analyticsPeriodGranularity(report.period);
  const today = new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 10);
  const selection = scope ?? (compare && previous ? { sites: report.websites.map(site => site.key), comparison: { ...previous.range, sites: previous.sites.map(site => site.key) } } : undefined);
  const navigate = (changes: Partial<WebsiteAnalyticsQuery>) => startTransition(() => router.replace(websitePeriodHref(query, changes, compare, selection), { scroll: false }));
  const controls = <div className="ml-auto flex w-fit min-w-0 max-w-full flex-wrap items-start justify-end gap-x-3 gap-y-2">
    <div className="flex min-w-0 max-w-full items-center gap-1"><span className="shrink-0 text-xs text-muted-foreground">ช่วงหลัก</span><WebsiteDateRangePicker range={range} month={range.to.slice(0, 7)} today={today} pastOnly loading={pending} className="w-auto min-w-0 max-w-full" onChange={selected => navigate({ ...selected, month: selected.to.slice(0, 7), granularity: "day" })} /></div>
    <WebsiteDatasetControls granularity={granularity} range={range} today={today} sites={options} query={query} scope={selection} comparison={compare && previous ? { ...previous.range, sites: previous.sites.map(site => site.key) } : undefined} />
  </div>;
  const comparing = compare && previous !== undefined;
  const allRows = comparing ? websitePeriodRows(report.websites, range, previous, report.period.as_of, metric, granularity) : [];
  const rows = visibleWebsitePeriodRows(allRows, visibility.hidden);
  const row = rows[0];
  const legacyMonthly = !compare && report.period.contract_version === "1.0" && !query.from;
  if (legacyMonthly && query.granularity === "month") {
    return <WebsiteDailyChart points={[]} monthly={report.monthly} query={query} range={range} asOf={report.period.as_of} available={report.totals !== null} hidden={visibility.hidden.includes(query.site)} onShow={() => visibility.toggle(query.site)} comparisonControl={controls} scope={scope} />;
  }
  return <Card><CardHeader className="flex flex-wrap items-start justify-between gap-3">
    <CardTitle><h2>{granularity === "hour" ? "แนวโน้มรายชั่วโมง" : "แนวโน้มรายวัน"}</h2></CardTitle>
    {legacyMonthly && <ChartPeriodToggle disabled={pending} value="day" onChange={value => navigate({ granularity: value })} />}
    {controls}
  </CardHeader><CardContent>
    <section aria-label={comparing ? granularity === "hour" ? "กราฟรายชั่วโมงเทียบชุดข้อมูลรายเว็บไซต์" : "กราฟรายวันเทียบชุดข้อมูลรายเว็บไซต์" : undefined} className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div role="group" aria-label={comparing ? "เลือกสถิติเปรียบเทียบเว็บไซต์" : granularity === "hour" ? "เลือกสถิติรายชั่วโมง" : "เลือกสถิติรายวัน"} className="flex flex-wrap gap-1">
          {(["page_views", "contact_clicks", "gallery_opens"] as const).map(key => <Button key={key} type="button" disabled={pending} variant={metric === key ? "default" : "outline"} className="h-8" aria-pressed={metric === key} onClick={() => setMetric(key)}>{periodMetricLabels[key]}</Button>)}
        </div>
      </div>
      <WebsiteChartLoading>
        {comparing ? <>
          {row && <p className="sr-only">{row.displayName} · {periodMetricLabels[metric]} · ชุดหลักเส้นทึบ ชุดเทียบเส้นประ · เวลาไทย</p>}
          {rows.length === 1 && row && <PeriodComparisonSummary current={row.current} previous={row.previous} currentSelected={row.currentSelected} previousSelected={row.previousSelected} />}
          <SitePeriodComparison granularity={granularity} sites={report.websites} range={range} asOf={report.period.as_of} previous={previous} view="daily" metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} showLegend={options.length > 1} />
        </> : <>
          {compare && <p role="status" className="text-xs text-amber-700">ช่วงก่อนหน้าอยู่นอกวันที่ที่ระบบรองรับ</p>}
          {report.websites.every(site => visibility.hidden.includes(site.key)) ? <div className="space-y-2 py-12 text-center text-sm text-muted-foreground"><p>เว็บไซต์นี้ถูกซ่อนในกราฟ</p><Button type="button" variant="outline" onClick={() => visibility.toggle(query.site)}>แสดงเว็บไซต์นี้</Button></div> : <WebsiteSiteTrendChart granularity={granularity} sites={report.websites} month={query.month} range={range} asOf={report.period.as_of} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />}
        </>}
      </WebsiteChartLoading>
    </section>
  </CardContent></Card>;
}
