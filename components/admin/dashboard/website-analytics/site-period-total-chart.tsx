"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import type { WebsitePeriodRow } from "../../../../lib/website-analytics-comparison";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { PeriodComparisonSummary, periodValueLabel } from "./period-comparison-summary";

const config = { value: { label: "ครั้ง", color: "var(--chart-2)" } } satisfies ChartConfig;

export function SitePeriodTotalChart({ rows }: { rows: WebsitePeriodRow[] }) {
  const maximum = Math.max(1, ...rows.flatMap(row => [row.current.total ?? 0, row.previous.total ?? 0]));
  return <div className="divide-y">{rows.map(row => <section key={row.key} aria-label={row.displayName} className="min-w-0 space-y-0.5 py-3 first:pt-0">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3">
      <h3 className="break-words text-sm font-medium">{row.displayName}</h3>
      <PeriodComparisonSummary current={row.current} previous={row.previous} currentSelected={row.currentSelected} previousSelected={row.previousSelected} />
    </div>
    <ChartContainer config={config} className="h-10 w-full aspect-auto">
      <BarChart accessibilityLayer layout="vertical" data={[...(row.currentSelected ? [{ period: "ช่วงหลัก", value: row.current.total, opacity: 1 }] : []), ...(row.previousSelected ? [{ period: "ชุดเทียบ", value: row.previous.total, opacity: 0.4 }] : [])]} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, maximum]} hide />
        <YAxis dataKey="period" type="category" hide />
        <ChartTooltip isAnimationActive={false} cursor={false} content={<ChartTooltipContent formatter={value => `${periodValueLabel(typeof value === "number" ? value : null)} ครั้ง`} />} />
        <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 3, 3, 0]} barSize={9} isAnimationActive={false}>
          {row.currentSelected && <Cell fillOpacity={1} />}{row.previousSelected && <Cell fillOpacity={0.4} />}
        </Bar>
      </BarChart>
    </ChartContainer>
  </section>)}</div>;
}
