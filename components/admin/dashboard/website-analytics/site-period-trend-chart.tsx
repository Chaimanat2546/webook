"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { pairWebsitePeriods, type WebsitePeriodPoint, type WebsitePeriodSeries } from "../../../../lib/website-analytics-comparison";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../ui/chart";
import { periodDateLabel, periodValueLabel } from "./period-comparison-summary";

const config = { current: { label: "ช่วงที่เลือก", color: "var(--chart-2)" }, previous: { label: "ช่วงก่อนหน้า", color: "var(--chart-2)" } } satisfies ChartConfig;

function PeriodTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const point: WebsitePeriodPoint | undefined = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="grid max-w-64 gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
    <p className="font-medium">วันที่จับคู่กัน</p>
    <p>ช่วงหลัก · {point.date ? periodDateLabel(point.date) : "นอกช่วงที่เลือก"}<span className="block font-mono tabular-nums">{point.current === null ? "ไม่มีข้อมูล" : `${periodValueLabel(point.current)} ครั้ง`}</span></p>
    <p>ชุดเทียบ · {point.previousDate ? periodDateLabel(point.previousDate) : "นอกช่วงที่เลือก"}<span className="block font-mono tabular-nums">{point.previous === null ? "ไม่มีข้อมูล" : `${periodValueLabel(point.previous)} ครั้ง`}</span></p>
  </div>;
}

export function SitePeriodTrendChart({ current, previous }: { current: WebsitePeriodSeries; previous: WebsitePeriodSeries }) {
  const data = pairWebsitePeriods(current, previous).map((point, index) => ({ ...point, ordinal: index + 1 }));
  const hasData = data.some(point => point.current !== null || point.previous !== null);
  if (!hasData) return <p role="status" className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูลรายวันทั้งสองช่วง</p>;
  return <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72">
    <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="ordinal" axisLine={false} tickLine={false} minTickGap={32} tickMargin={10} interval="preserveStartEnd" tickFormatter={(day: number) => `วัน ${day}`} />
      <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
      <ChartTooltip isAnimationActive={false} content={PeriodTooltip} />
      <Line dataKey="current" type="linear" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
      <Line dataKey="previous" type="linear" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.6} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
    </LineChart>
  </ChartContainer>;
}
