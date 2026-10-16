"use client";

import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { visibleWebsitePeriodRows, websitePeriodRows, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { comparePeriodConditions, describeComparisonPeriod } from "../../../../lib/website-analytics-comparison-policy";
import { PeriodLegend, comparisonReasonLabel, periodDateLabel, periodMetricLabels } from "./period-comparison-summary";
import { MultiSitePeriodTrendChart } from "./multi-site-period-trend-chart";
import { PeriodComparisonIssues } from "./period-comparison-issues";
import { SitePeriodTotalChart } from "./site-period-total-chart";
import { WebsiteChartLegend } from "./website-chart-legend";

import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";

interface SitePeriodComparisonProps {
  granularity: "hour" | "day";
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

export function SitePeriodComparison({ granularity, sites, range, asOf, previous, view, metric, hiddenSites, onToggleSite, showLegend = true }: SitePeriodComparisonProps) {
  const allRows = websitePeriodRows(sites, range, previous, asOf, metric, granularity);
  const rows = visibleWebsitePeriodRows(allRows, hiddenSites);
  if (!allRows.length) return null;
  const hourly = granularity === "hour";
  const previousHourly = previous.granularity === "hour";
  const mixed = hourly !== previousHourly;
  const currentPeriod = describeComparisonPeriod(range, granularity);
  const previousPeriod = describeComparisonPeriod(previous.range, previous.granularity);
  const conditions = comparePeriodConditions(currentPeriod, previousPeriod);
  const colorKeys = allRows.map(row => row.key);
  return <figure aria-label={view === "daily" ? hourly ? "กราฟรายชั่วโมงเทียบชุดข้อมูล" : "กราฟรายวันเทียบชุดข้อมูล" : "กราฟยอดรวมเทียบชุดข้อมูล"} className="mb-6 min-w-0 space-y-2 border-b pb-4">
    {isFutureAnalyticsRange(previous.range, asOf) && <p role="status" className="text-xs text-amber-700">ชุดเทียบ: ยังไม่ถึงช่วงเวลาที่เลือก</p>}
    <figcaption className="sr-only">
      {periodMetricLabels[metric]} · {view === "daily" ? hourly ? "ครั้งต่อชั่วโมง" : "ครั้งต่อวัน" : "ครั้งทั้งช่วง"} · เวลาไทย · ช่วงที่เลือก {periodDateLabel(range.from)} – {periodDateLabel(range.to)} เทียบกับ {periodDateLabel(previous.range.from)} – {periodDateLabel(previous.range.to)}
    </figcaption>
    <div className="flex flex-wrap items-center justify-between gap-2"><PeriodLegend bars={view === "total"} neutral={view === "daily"} currentRange={range} previousRange={previous.range} /><div className="flex flex-wrap items-center gap-2">{view === "daily" && <PeriodComparisonIssues rows={rows} />}<span className="text-xs text-muted-foreground">{view === "daily" ? mixed ? "ครั้ง/ชั่วโมง · ครั้ง/วัน" : hourly ? "ครั้ง/ชั่วโมง" : "ครั้ง/วัน" : "ครั้ง"}</span></div></div>
    {conditions.reasons.length > 0 && <p role="status" className="text-xs text-amber-700">{conditions.reasons.map(comparisonReasonLabel).join(" · ")} · งด % ยอดรวม</p>}
    <p className="text-xs text-muted-foreground">ระยะเวลาที่เลือก: ช่วงหลัก {currentPeriod.dayCount} วัน · {currentPeriod.requestedHours} ชั่วโมง / ชุดเทียบ {previousPeriod.dayCount} วัน · {previousPeriod.requestedHours} ชั่วโมง</p>
    {view === "daily" && conditions.layout === "separate" ? <>
      <p role="status" className="text-xs text-amber-700">ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน</p>
      <p className="text-xs font-medium">ช่วงหลัก</p><WebsiteSiteTrendChart colorKeys={colorKeys} granularity={granularity} sites={sites} month={range.from.slice(0, 7)} range={range} asOf={asOf} metric={metric} hiddenSites={hiddenSites} onToggleSite={onToggleSite} />
      <p className="text-xs font-medium">ชุดเทียบ</p><WebsiteSiteTrendChart colorKeys={colorKeys} granularity={previous.granularity} sites={previous.sites} month={previous.range.from.slice(0, 7)} range={previous.range} asOf={asOf} metric={metric} hiddenSites={hiddenSites} onToggleSite={onToggleSite} />
    </> : view === "daily" ? <MultiSitePeriodTrendChart rows={allRows} colorKeys={colorKeys} hiddenSites={hiddenSites} onToggleSite={onToggleSite} showLegend={showLegend} /> : <>
      {showLegend && <WebsiteChartLegend sites={allRows} availableSites={allRows.filter(row => row.current.total !== null || row.previous.total !== null).map(row => row.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} colorKeys={colorKeys} lineStyles={false} label="เว็บไซต์ในกราฟเปรียบเทียบ" />}
      <SitePeriodTotalChart rows={rows} />
    </>}
  </figure>;
}
