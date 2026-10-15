"use client";

import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { visibleWebsitePeriodRows, websitePeriodRows, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { PeriodLegend, periodDateLabel, periodMetricLabels } from "./period-comparison-summary";
import { MultiSitePeriodTrendChart } from "./multi-site-period-trend-chart";
import { PeriodComparisonIssues } from "./period-comparison-issues";
import { SitePeriodTotalChart } from "./site-period-total-chart";
import { WebsiteChartLegend } from "./website-chart-legend";

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
  const unequal = allRows[0].current.expectedDays !== allRows[0].previous.expectedDays;
  return <figure aria-label={view === "daily" ? "กราฟรายวันเทียบชุดข้อมูล" : "กราฟยอดรวมเทียบชุดข้อมูล"} className="mb-6 min-w-0 space-y-2 border-b pb-4">
    <figcaption className="sr-only">
      {periodMetricLabels[metric]} · {view === "daily" ? "ครั้งต่อวัน" : "ครั้งทั้งช่วง"} · เวลาไทย · ช่วงที่เลือก {periodDateLabel(range.from)} – {periodDateLabel(range.to)} เทียบกับ {periodDateLabel(previous.range.from)} – {periodDateLabel(previous.range.to)}
    </figcaption>
    <div className="flex flex-wrap items-center justify-between gap-2"><PeriodLegend bars={view === "total"} neutral={view === "daily"} currentRange={range} previousRange={previous.range} /><div className="flex flex-wrap items-center gap-2">{view === "daily" && <PeriodComparisonIssues rows={rows} />}<span className="text-xs text-muted-foreground">{view === "daily" ? "ครั้ง/วัน" : "ครั้ง"}</span></div></div>
    {unequal && <p className="text-xs text-amber-700">ช่วงหลัก {allRows[0].current.expectedDays} วัน · ชุดเทียบ {allRows[0].previous.expectedDays} วัน · งด % ยอดรวม</p>}
    {view === "daily" ? <MultiSitePeriodTrendChart rows={allRows} colorKeys={sites.map(site => site.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} showLegend={showLegend} /> : <>
      {showLegend && <WebsiteChartLegend sites={allRows} availableSites={allRows.filter(row => row.current.total !== null || row.previous.total !== null).map(row => row.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} colorKeys={sites.map(site => site.key)} lineStyles={false} label="เว็บไซต์ในกราฟเปรียบเทียบ" />}
      <SitePeriodTotalChart rows={rows} />
    </>}
  </figure>;
}
