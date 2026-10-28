"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useId } from "react";
import { type DashboardDailyBookingCount, dashboardDate } from "../../../lib/dashboard";
import { hourLabel, hourlyRangeLabel } from "../../../lib/website-analytics-time";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/chart";

const config = {
  count: { label: "จำนวนการจองติดจอง", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ConfirmedBookingsChart({ points, granularity = "day", presentation = "bar" }: { points: DashboardDailyBookingCount[]; granularity?: "hour" | "day"; presentation?: "bar" | "area" }) {
  const gradientId = useId();
  const hourly = granularity === "hour";
  if (presentation === "area") return <figure aria-label={`กราฟจำนวนการจองติดจอง${hourly ? "รายชั่วโมง" : "รายวัน"}`} className="w-full">
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart accessibilityLayer data={points} margin={{ left: -12, right: 12, top: 12 }}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} tickFormatter={(value: string) => hourly ? hourLabel(value) : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${value}T00:00:00+07:00`))} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => hourly ? `${dashboardDate(String(value))} · ${hourlyRangeLabel(String(value), new Date(Date.parse(String(value)) + 3600000).toISOString())} น.` : dashboardDate(`${String(value)}T00:00:00.000Z`)} />} />
        <Area dataKey="count" type="linear" stroke="var(--color-count)" strokeWidth={2.5} fill={`url(#${gradientId})`} dot={points.length <= 10 ? { r: 3, fill: "var(--background)", strokeWidth: 2 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  </figure>;
  return <figure aria-label={`กราฟจำนวนการจองติดจอง${hourly ? "รายชั่วโมง" : "รายวัน"}`} className="w-full">
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={points} margin={{ left: -20, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={25} tickFormatter={(value: string) => hourly ? hourLabel(value) : `${value.slice(8)}/${value.slice(5, 7)}`} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => hourly ? `${dashboardDate(String(value))} · ${hourlyRangeLabel(String(value), new Date(Date.parse(String(value)) + 3600000).toISOString())} น.` : dashboardDate(`${String(value)}T00:00:00.000Z`)} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  </figure>;
}
