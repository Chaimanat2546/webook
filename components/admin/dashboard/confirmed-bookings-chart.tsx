"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type DashboardDailyBookingCount, dashboardDate } from "../../../lib/dashboard";
import { hourLabel, hourlyRangeLabel } from "../../../lib/website-analytics-time";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/chart";

const config = {
  count: { label: "จำนวนการจองติดจอง", color: "var(--primary)" },
} satisfies ChartConfig;

export function ConfirmedBookingsChart({ points, granularity = "day" }: { points: DashboardDailyBookingCount[]; granularity?: "hour" | "day" }) {
  const hourly = granularity === "hour";
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
