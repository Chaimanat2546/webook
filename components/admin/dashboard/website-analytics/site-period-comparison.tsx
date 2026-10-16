"use client";

import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { sameDailyTimeWindow, visibleWebsitePeriodRows, websitePeriodRows, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { PeriodLegend, periodDateLabel, periodMetricLabels } from "./period-comparison-summary";
import { MultiSitePeriodTrendChart } from "./multi-site-period-trend-chart";
import { PeriodComparisonIssues } from "./period-comparison-issues";
import { SitePeriodTotalChart } from "./site-period-total-chart";
import { WebsiteChartLegend } from "./website-chart-legend";

import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";

interface SitePeriodComparisonProps {
  sites: WebsiteSummary[];
  range: AnalyticsDateRange;
  asOf: string;
  previous: WebsitePreviousPeriod;
  view: "daily" | "total";
  metric: WebsiteChartMetric;
  hiddenSites: string[];
  showLegend?: boolean;
  onToggleSite: (key: string) => void;
}

export function SitePeriodComparison({ sites, range, asOf, previous, view, metric, hiddenSites, onToggleSite, showLegend = true }: SitePeriodComparisonProps) {
  const allRows = websitePeriodRows(sites, range, previous, asOf, metric);
  const rows = visibleWebsitePeriodRows(allRows, hiddenSites);
  if (!allRows.length) return null;
  const hourly = Boolean(range.from === range.to && range.timeFrom);
  const previousHourly = Boolean(previous.range.from === previous.range.to && previous.range.timeFrom);
  const mixed = hourly !== previousHourly;
  const unequal = allRows[0].current.expectedDays !== allRows[0].previous.expectedDays;
  return <figure aria-label={view === "daily" ? hourly ? "กราฟรายชั่วโมงเทียบชุดข้อมูล" : "กราฟรายวันเทียบชุดข้อมูล" : "กราฟยอดรวมเทียบชุดข้อมูล"} className="mb-6 min-w-0 space-y-2 border-b pb-4">
    {isFutureAnalyticsRange(previous.range, asOf) && <p role="status" className="text-xs text-amber-700">ชุดเทียบ: ยังไม่ถึงช่วงเวลาที่เลือก</p>}
    <figcaption className="sr-only">
      {periodMetricLabels[metric]} · {view === "daily" ? hourly ? "ครั้งต่อชั่วโมง" : "ครั้งต่อวัน" : "ครั้งทั้งช่วง"} · เวลาไทย · ช่วงที่เลือก {periodDateLabel(range.from)} – {periodDateLabel(range.to)} เทียบกับ {periodDateLabel(previous.range.from)} – {periodDateLabel(previous.range.to)}
    </figcaption>
    <div className="flex flex-wrap items-center justify-between gap-2"><PeriodLegend bars={view === "total"} neutral={view === "daily"} currentRange={range} previousRange={previous.range} /><div className="flex flex-wrap items-center gap-2">{view === "daily" && <PeriodComparisonIssues rows={rows} />}<span className="text-xs text-muted-foreground">{view === "daily" ? hourly ? "ครั้ง/ชั่วโมง" : "ครั้ง/วัน" : "ครั้ง"}</span></div></div>
    {unequal && <p className="text-xs text-amber-700">ช่วงหลัก {allRows[0].current.expectedDays} {hourly ? "ชั่วโมง" : "วัน"} · ชุดเทียบ {allRows[0].previous.expectedDays} {previousHourly ? "ชั่วโมง" : "วัน"} · งด % ยอดรวม</p>}
    {!mixed && !hourly && !sameDailyTimeWindow(range, previous.range) && <p className="text-xs text-amber-700">ช่วงเวลารายวันต่างกัน · งด % ยอดรวม</p>}
    {view === "daily" && mixed ? <>
      <p role="status" className="text-xs text-amber-700">ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน</p>
      <p className="text-xs font-medium">ช่วงหลัก</p><WebsiteSiteTrendChart sites={sites} month={range.from.slice(0, 7)} range={range} asOf={asOf} metric={metric} hiddenSites={hiddenSites} onToggleSite={onToggleSite} />
      <p className="text-xs font-medium">ชุดเทียบ</p><WebsiteSiteTrendChart sites={previous.sites} month={previous.range.from.slice(0, 7)} range={previous.range} asOf={asOf} metric={metric} hiddenSites={hiddenSites} onToggleSite={onToggleSite} showLegend={false} />
    </> : view === "daily" ? <MultiSitePeriodTrendChart rows={allRows} colorKeys={sites.map(site => site.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} showLegend={showLegend} /> : <>
      {showLegend && <WebsiteChartLegend sites={allRows} availableSites={allRows.filter(row => row.current.total !== null || row.previous.total !== null).map(row => row.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} colorKeys={sites.map(site => site.key)} lineStyles={false} label="เว็บไซต์ในกราฟเปรียบเทียบ" />}
      <SitePeriodTotalChart rows={rows} />
    </>}
  </figure>;
}
