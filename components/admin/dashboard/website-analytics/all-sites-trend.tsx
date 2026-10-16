"use client";

import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { aggregateWebsitePeriod, type WebsiteAggregatePeriod } from "../../../../lib/website-analytics-aggregate";
import { comparePeriodConditions, describeComparisonPeriod } from "../../../../lib/website-analytics-comparison-policy";
import type { WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";
import { PeriodLegend, periodMetricLabels, shortRange } from "./period-comparison-summary";
import { SitePeriodTrendChart } from "./site-period-trend-chart";

function Coverage({ label, series }: { label: string; series: WebsiteAggregatePeriod }) {
  return <p className={series.coverageComplete ? "text-xs text-muted-foreground" : "text-xs text-amber-700"} role={series.coverageComplete ? undefined : "status"}>
    {label}: {series.availableSites < series.selectedSites ? "รวมเฉพาะเว็บที่มีข้อมูล" : "รวม"} {series.availableSites}/{series.selectedSites} เว็บ
    {!series.coverageComplete && series.availableSites > 0 && " · บางชั่วโมง/วันมีข้อมูลไม่ครบ รวมเฉพาะค่าที่มีข้อมูล"}
    {series.status === "ongoing" && " · ยังไม่สิ้นสุดช่วงเวลา"}
    {isFutureAnalyticsRange(series.range, series.asOf) && " · ยังไม่ถึงช่วงเวลาที่เลือก"}
  </p>;
}

export function AllSitesTrend({ sites, range, asOf, granularity, metric, previous }: { sites: WebsiteSummary[]; range: AnalyticsDateRange; asOf: string; granularity: "hour" | "day"; metric: WebsiteChartMetric; previous?: WebsitePreviousPeriod }) {
  const current = aggregateWebsitePeriod(sites, range, asOf, metric, granularity);
  const prior = previous && aggregateWebsitePeriod(previous.sites, previous.range, asOf, metric, previous.granularity);
  const separate = prior && comparePeriodConditions(describeComparisonPeriod(range, granularity), describeComparisonPeriod(prior.range, prior.granularity ?? "day")).layout === "separate";
  const unit = (series: WebsiteAggregatePeriod) => series.granularity === "hour" ? "ครั้งต่อชั่วโมง" : "ครั้งต่อวัน";
  return <figure aria-label="กราฟแนวโน้มรวมทุกเว็บไซต์" className="mb-6 min-w-0 space-y-2 border-b pb-4">
    <figcaption className="text-xs text-muted-foreground">{periodMetricLabels[metric]} · รวมทุกเว็บไซต์ · {unit(current)} · เวลาไทย</figcaption>
    {prior ? <PeriodLegend distinctColors currentRange={range} previousRange={prior.range} /> : <p className="text-xs text-muted-foreground">{shortRange(range, true)}</p>}
    <Coverage label="ช่วงหลัก" series={current} />
    {prior && <Coverage label="ชุดเทียบ" series={prior} />}
    {separate && prior ? <>
      <p role="status" className="text-xs text-amber-700">ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน</p>
      <p className="text-xs font-medium">ช่วงหลัก · {unit(current)}</p><SitePeriodTrendChart current={current} />
      <p className="text-xs font-medium">ชุดเทียบ · {unit(prior)}</p><SitePeriodTrendChart current={prior} currentLabel="ชุดเทียบ" />
    </> : <SitePeriodTrendChart current={current} previous={prior} />}
  </figure>;
}
