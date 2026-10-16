"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { pairWebsitePeriods, type WebsitePeriodPoint } from "../../../../lib/website-analytics-comparison";
import type { WebsiteAggregatePeriod } from "../../../../lib/website-analytics-aggregate";
import { hourLabel } from "../../../../lib/website-analytics-time";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../ui/chart";
import { periodPointLabel, periodValueLabel } from "./period-comparison-summary";

const config = { current: { label: "ช่วงหลัก", color: "var(--chart-2)" }, previous: { label: "ชุดเทียบ", color: "var(--chart-4)" } } satisfies ChartConfig;

function PeriodTooltip({ active, payload, current, previous, currentLabel }: TooltipContentProps<TooltipValueType, string | number> & { current: WebsiteAggregatePeriod; previous?: WebsiteAggregatePeriod; currentLabel: string }) {
  const point: WebsitePeriodPoint | undefined = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="grid max-w-64 gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
    <p className="font-medium">รวมทุกเว็บไซต์{point.hour && ` · ${point.hour}`}</p>
    {([[currentLabel, current, point.date, point.current], ["ชุดเทียบ", previous, point.previousDate, point.previous]] as const).map(([label, series, date, value]) => series && <div key={label}>
      <p>{label} · {periodPointLabel(date, series.asOf, series.range)}</p>
      <p className="font-mono tabular-nums">{value === null ? "ไม่มีข้อมูล" : `${periodValueLabel(value)} ครั้ง`}</p>
      {date && <p className="text-muted-foreground">มีข้อมูล {series.pointSiteCounts[date] ?? 0}/{series.selectedSites} เว็บ</p>}
    </div>)}
  </div>;
}

export function SitePeriodTrendChart({ current, previous, currentLabel = "ช่วงหลัก" }: { current: WebsiteAggregatePeriod; previous?: WebsiteAggregatePeriod; currentLabel?: string }) {
  const comparisonOnly = currentLabel === "ชุดเทียบ";
  const currentColor = comparisonOnly ? config.previous.color : config.current.color;
  const points = previous ? pairWebsitePeriods(current, previous) : current.daily.map(point => ({ date: point.date, previousDate: "", current: point.value, previous: null, ...(current.granularity === "hour" ? { hour: hourLabel(point.date) } : {}) }));
  const data = points.map((point, index) => ({ ...point, ordinal: index + 1 }));
  const hasData = data.some(point => point.current !== null || point.previous !== null);
  if (!hasData) return <p role="status" className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูลสำหรับแนวโน้มรวมทุกเว็บไซต์</p>;
  return <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72">
    <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="ordinal" axisLine={false} tickLine={false} minTickGap={32} tickMargin={10} interval="preserveStartEnd" tickFormatter={(day: number) => current.granularity === "hour" ? data[day - 1]?.hour ?? "" : previous ? `วันที่ ${day}` : `${data[day - 1]?.date.slice(8)}/${data[day - 1]?.date.slice(5, 7)}`} />
      <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
      <ChartTooltip isAnimationActive={false} filterNull={false} wrapperStyle={{ maxWidth: "calc(100% - 3.5rem)" }} content={props => <PeriodTooltip {...props} current={current} previous={previous} currentLabel={currentLabel} />} />
      {previous && <Line dataKey="previous" type="linear" stroke={config.previous.color} strokeWidth={4} strokeDasharray="6 4" dot={{ r: data.length <= 45 ? 4 : 3, fill: "var(--background)", stroke: config.previous.color, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />}
      <Line dataKey="current" type="linear" stroke={currentColor} strokeWidth={comparisonOnly ? 4 : 2} strokeDasharray={comparisonOnly ? "6 4" : undefined} dot={{ r: comparisonOnly ? 4 : data.length <= 45 ? 2 : 1, fill: comparisonOnly ? "var(--background)" : currentColor, stroke: currentColor, strokeWidth: comparisonOnly ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
    </LineChart>
  </ChartContainer>;
}
