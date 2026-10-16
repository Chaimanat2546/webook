"use client";

import { dailyWindowBounds, hourLabel, hourlyRangeLabel } from "../../../../lib/website-analytics-time";
import { ChevronDown } from "lucide-react";
import { websitePeriodChange, type WebsitePeriodSeries } from "../../../../lib/website-analytics-comparison";
import { assessPeriodComparison, describeComparisonPeriod, type ComparisonReason } from "../../../../lib/website-analytics-comparison-policy";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { Button } from "../../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";

export const periodMetricLabels: Record<WebsiteChartMetric, string> = { page_views: "เข้าชม", contact_clicks: "กดติดต่อรวม", gallery_opens: "เปิดรูป" };
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
export const periodDateLabel = (date: string) => dateFormat.format(new Date(date.length > 10 ? date : `${date}T00:00:00+07:00`));
export const periodValueLabel = (value: number | null) => value?.toLocaleString("th-TH") ?? "—";
const reasonLabels: Record<ComparisonReason, string> = {
  site_not_shared: "เว็บไซต์ไม่อยู่ในทั้งสองชุด",
  granularity_mismatch: "หน่วยเวลาต่างกัน",
  day_count_mismatch: "จำนวนวันต่างกัน",
  time_window_mismatch: "ช่วงเวลารายวันต่างกัน",
  load_failed: "โหลดไม่ได้",
  coverage_incomplete: "ข้อมูลไม่ครบ",
  not_started: "ยังไม่ถึงช่วงเวลา",
  ongoing: "ยังไม่สิ้นสุดช่วงเวลา",
};
export const comparisonReasonLabel = (reason: ComparisonReason): string => reasonLabels[reason];

export function PeriodChangeSummary({ current, previous, compact = false }: { current: WebsitePeriodSeries; previous: WebsitePeriodSeries; compact?: boolean }) {
  const change = websitePeriodChange(current, previous);
  switch (change.kind) {
    case "unavailable": return <span>ยังเทียบไม่ได้</span>;
    case "unchanged": return <span>ไม่เปลี่ยนแปลง (0 → 0)</span>;
    case "zero_baseline": return <span>เพิ่ม {periodValueLabel(change.difference)} ครั้งจากฐาน 0</span>;
    case "percentage": return <span>{change.percentage > 0 ? "+" : ""}{change.percentage.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%{!compact && <> · {change.difference > 0 ? "+" : ""}{periodValueLabel(change.difference)} ครั้ง</>}</span>;
  }
}

export function periodPointLabel(date: string, asOf?: string, range?: AnalyticsDateRange): string {
  if (!date) return "นอกช่วงที่เลือก";
  if (date.length === 10) {
    if (!range?.timeFrom || !range.timeTo) return periodDateLabel(date);
    const bounds = dailyWindowBounds(date, { timeFrom: range.timeFrom, timeTo: range.timeTo });
    const clipped = asOf && Date.parse(bounds.start) < Date.parse(asOf) && Date.parse(asOf) < Date.parse(bounds.end);
    return periodDateLabel(date) + " · ทุกวัน " + range.timeFrom + "–" + range.timeTo + (clipped ? " · ข้อมูลถึง " + hourLabel(asOf) : "");
  }
  const end = new Date(Date.parse(date) + 3600000).toISOString();
  const clipped = asOf && Date.parse(date) < Date.parse(asOf) && Date.parse(asOf) < Date.parse(end);
  return periodDateLabel(date) + " · " + hourlyRangeLabel(date, end) + (clipped ? " · ข้อมูลถึง " + hourLabel(asOf) : "");
}
function PeriodStatus({ series }: { series: WebsitePeriodSeries }) {
  if (series.status === "unavailable") return <>โหลดไม่ได้</>;
  return <>{series.availableDays}/{series.expectedDays} {series.granularity === "hour" ? "ชั่วโมง" : "วัน"}{!series.coverageComplete ? " · ข้อมูลไม่ครบ" : " · ข้อมูลครบ"}{series.status === "ongoing" && <> · {comparisonReasonLabel(assessPeriodComparison(series, series).reasons.includes("not_started") ? "not_started" : "ongoing")}</>}</>;
}

export function PeriodComparisonDetails({ current, previous, currentSelected = true, previousSelected = true }: { current: WebsitePeriodSeries; previous: WebsitePeriodSeries; currentSelected?: boolean; previousSelected?: boolean }) {
  const assessment = assessPeriodComparison(current, previous, { currentSelected, previousSelected });
  return <div className="space-y-2 text-xs" aria-live="polite">
    <dl className="grid min-w-0 grid-cols-2 gap-3">
      {([["ช่วงหลัก", current, currentSelected], ["ชุดเทียบ", previous, previousSelected]] as const).map(([label, series, selected]) => <div key={label} className="min-w-0 space-y-1">
        <dt className="text-muted-foreground">{label}</dt>
        {!selected ? <dd className="text-muted-foreground">ไม่อยู่ในชุดนี้</dd> : <>
        <dd className="text-muted-foreground">{shortRange(series.range, true)}</dd>
        <dd className="text-muted-foreground">ระยะเวลาที่เลือก {describeComparisonPeriod(series.range, series.granularity ?? "day").dayCount} วัน · {describeComparisonPeriod(series.range, series.granularity ?? "day").requestedHours} ชั่วโมง</dd>
        <dd className="break-words text-base font-semibold tabular-nums">{periodValueLabel(series.total)}{series.total !== null && " ครั้ง"}</dd>
        <dd className={series.status === "complete" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}><PeriodStatus series={series} /></dd>
        {series.total !== null && !series.coverageComplete && <dd className="text-muted-foreground">ยอดเท่าที่มีข้อมูล</dd>}
        </>}
      </div>)}
    </dl>
    <p className="break-words font-medium tabular-nums">{!assessment.canCompare ? <>ยังเทียบไม่ได้: {assessment.reasons.map(comparisonReasonLabel).join(" · ")} · งด % ยอดรวม</> : <PeriodChangeSummary current={current} previous={previous} />}</p>
  </div>;
}

export function PeriodComparisonSummary({ current, previous, currentSelected = true, previousSelected = true }: { current: WebsitePeriodSeries; previous: WebsitePeriodSeries; currentSelected?: boolean; previousSelected?: boolean }) {
  const change = websitePeriodChange(current, previous);
  const selected = [currentSelected ? current : undefined, previousSelected ? previous : undefined].filter((series): series is WebsitePeriodSeries => Boolean(series));
  const assessment = assessPeriodComparison(current, previous, { currentSelected, previousSelected });
  const issue = assessment.reasons.map(comparisonReasonLabel);
  const showDetails = currentSelected && previousSelected || selected.some(series => series.status !== "complete") || !assessment.canCompare;
  return <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5 text-xs" aria-live="polite">
    <dl className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums">
      {currentSelected && <div className="flex items-baseline gap-1.5"><dt className="text-muted-foreground">ช่วงหลัก</dt><dd className="font-semibold">{periodValueLabel(current.total)}</dd></div>}
      {previousSelected && <div className="flex items-baseline gap-1.5 text-muted-foreground"><dt>ชุดเทียบ</dt><dd>{periodValueLabel(previous.total)}</dd></div>}
    </dl>
    {showDetails && <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" className={`h-8 max-w-full gap-1 px-1 text-xs tabular-nums ${!assessment.canCompare || change.kind === "unavailable" ? "text-amber-700 dark:text-amber-400" : "font-medium"}`} />}>
        {!assessment.canCompare ? <><span className="min-w-0 truncate">{issue[0]}</span>{issue.length > 1 && <span> (+{issue.length - 1})</span>}</> : <PeriodChangeSummary current={current} previous={previous} compact />}<span className="sr-only"> ดูรายละเอียด</span><ChevronDown aria-hidden className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-1.5rem)] min-w-0"><PeriodComparisonDetails current={current} previous={previous} currentSelected={currentSelected} previousSelected={previousSelected} /></PopoverContent>
    </Popover>}
  </div>;
}

export function shortRange(range: AnalyticsDateRange, showYear = false): string {
  const format = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", ...(showYear || range.from.slice(0, 4) !== range.to.slice(0, 4) ? { year: "numeric" as const } : {}), timeZone: "Asia/Bangkok" });
  const end = format.format(new Date(`${range.to}T00:00:00+07:00`));
  if (range.from === range.to) return end + (range.timeFrom && range.timeTo ? ` · ${range.timeFrom}–${range.timeTo}` : "");
  const start = range.from.slice(0, 7) === range.to.slice(0, 7) ? String(Number(range.from.slice(8))) : format.format(new Date(`${range.from}T00:00:00+07:00`));
  return `${start}–${end}${range.timeFrom && range.timeTo ? ` · ทุกวัน ${range.timeFrom}–${range.timeTo}` : ""}`;
}

export function PeriodLegend({ bars = false, neutral = false, currentRange, previousRange }: { bars?: boolean; neutral?: boolean; currentRange: AnalyticsDateRange; previousRange: AnalyticsDateRange }) {
  const showYear = new Set([currentRange.from, currentRange.to, previousRange.from, previousRange.to].map(date => date.slice(0, 4))).size > 1;
  return <ul aria-label="คำอธิบายช่วงเปรียบเทียบ" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
    <li className="flex items-center gap-2"><span aria-hidden className={bars ? "h-2 w-6 rounded-sm bg-[var(--chart-2)]" : neutral ? "w-6 border-t-2 border-foreground" : "w-6 border-t-2 border-[var(--chart-2)]"} />{shortRange(currentRange, showYear)}</li>
    <li className="flex items-center gap-2"><span aria-hidden className={bars ? "h-2 w-6 rounded-sm bg-[var(--chart-2)] opacity-40" : neutral ? "w-6 border-t-2 border-dashed border-foreground opacity-60" : "w-6 border-t-2 border-dashed border-[var(--chart-2)] opacity-60"} />{shortRange(previousRange, showYear)}</li>
  </ul>;
}
