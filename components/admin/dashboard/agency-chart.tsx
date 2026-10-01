"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/chart";
import { dashboardAgencyChartLabel, dashboardMoney, type DashboardAgency } from "../../../lib/dashboard";

const config = { amountCents: { label: "มูลค่าการจอง", color: "var(--primary)" } } satisfies ChartConfig;

export function AgencyChart({ agencies }: { agencies: DashboardAgency[] }) {
  const data = agencies.slice(0, 5).map((row, index) => ({ ...row, rank: String(index + 1) }));
  return <figure aria-label="กราฟยอดขายเอเจนซี่ 5 อันดับแรก" className="w-full">
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="name" type="category" width={152} axisLine={false} tickLine={false} tickFormatter={dashboardAgencyChartLabel} />
        <XAxis type="number" domain={[0, "auto"]} axisLine={false} tickLine={false}
          tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value / 100)} />
        <ChartTooltip content={<ChartTooltipContent
          labelFormatter={(_label, payload) => {
            const rank = payload[0]?.payload?.rank;
            return data.find(row => row.rank === rank)?.name ?? "เอเจนซี่";
          }}
          formatter={value => typeof value === "number" ? dashboardMoney(value) : "ไม่ระบุ"}
        />} />
        <Bar dataKey="amountCents" fill="var(--color-amountCents)" radius={[0, 4, 4, 0]} maxBarSize={32} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  </figure>;
}
