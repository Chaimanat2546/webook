"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type DashboardDailyBookingCount, dashboardDate } from "../../../lib/dashboard";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/chart";

const config = {
  count: { label: "จำนวนการจองติดจอง", color: "var(--primary)" },
} satisfies ChartConfig;

export function ConfirmedBookingsChart({ points }: { points: DashboardDailyBookingCount[] }) {
  return <figure aria-label="กราฟจำนวนการจองติดจองรายวัน" className="w-full">
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={points} margin={{ left: -20, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} interval={4} tickFormatter={(value: string) => value.slice(8)} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => dashboardDate(`${String(value)}T00:00:00.000Z`)} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  </figure>;
}
