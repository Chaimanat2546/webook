"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { websiteMultiPeriodPoints, type WebsiteMultiPeriodPoint, type WebsitePeriodRow } from "../../../../lib/website-analytics-comparison";
import { WebsiteChartLegend } from "./website-chart-legend";
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../ui/chart";
import { periodDateLabel, periodValueLabel } from "./period-comparison-summary";

interface MultiSitePeriodTrendChartProps {
  rows: WebsitePeriodRow[];
  hiddenSites: string[];
  onToggleSite: (key: string) => void;
  showLegend?: boolean;
  colorKeys?: string[];
}

function MultiPeriodTooltip({ active, payload, rows, colors }: TooltipContentProps<TooltipValueType, string | number> & { rows: WebsitePeriodRow[]; colors: ChartConfig }) {
  const point: WebsiteMultiPeriodPoint | undefined = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="w-full space-y-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
    <div className="text-muted-foreground"><p>ช่วงหลัก · {point.date ? periodDateLabel(point.date) : "นอกช่วงที่เลือก"}</p><p>ชุดเทียบ · {point.previousDate ? periodDateLabel(point.previousDate) : "นอกช่วงที่เลือก"}</p></div>
    <table aria-label="ค่ารายวันแต่ละเว็บไซต์" className="w-full table-fixed">
      <colgroup><col className="w-1/2" /><col className="w-1/4" /><col className="w-1/4" /></colgroup>
      <thead><tr className="text-muted-foreground"><th className="text-left font-normal">เว็บไซต์</th><th className="text-right font-normal">หลัก</th><th className="text-right font-normal">เทียบ</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}>
        <th className="break-words py-1 pr-2 text-left font-normal"><span aria-hidden className="mr-1 inline-block size-2 rounded-full" style={{ background: colors[row.key].color }} />{row.displayName}</th>
        <td className="py-1 text-right font-mono tabular-nums">{row.currentSelected ? periodValueLabel(point.values[row.key]?.current ?? null) : <span aria-label="ไม่อยู่ในชุดหลัก">·</span>}</td>
        <td className="py-1 text-right font-mono tabular-nums">{row.previousSelected ? periodValueLabel(point.values[row.key]?.previous ?? null) : <span aria-label="ไม่อยู่ในชุดเทียบ">·</span>}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function MultiSitePeriodTrendChart({ rows, hiddenSites, onToggleSite, showLegend = true, colorKeys = rows.map(row => row.key) }: MultiSitePeriodTrendChartProps) {
  const data = websiteMultiPeriodPoints(rows).map((point, index) => ({ ...point, ordinal: index + 1 }));
  const config: ChartConfig = Object.fromEntries(rows.map(row => [row.key, { label: row.displayName, color: `var(--chart-${Math.max(0, colorKeys.indexOf(row.key)) % 5 + 1})` }]));
  const available = rows.filter(row => data.some(point => point.values[row.key].current !== null || point.values[row.key].previous !== null));
  const visibleRows = rows.filter(row => !hiddenSites.includes(row.key));
  return <div className="min-w-0">
    {showLegend && <WebsiteChartLegend sites={rows} availableSites={available.map(row => row.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} colorKeys={colorKeys} lineStyles={false} label="เว็บไซต์ในกราฟเปรียบเทียบ" />}
    {!available.length ? <p role="status" className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูลรายวันทั้งสองช่วง</p> : <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72">
      <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="ordinal" axisLine={false} tickLine={false} minTickGap={32} tickMargin={10} interval="preserveStartEnd" tickFormatter={(day: number) => `วัน ${day}`} />
        <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
        <ChartTooltip isAnimationActive={false} position={{ x: 0 }} wrapperStyle={{ width: "min(20rem, 100%)" }} content={props => <MultiPeriodTooltip {...props} rows={visibleRows} colors={config} />} />
        {rows.flatMap(row => [
          <Line key={`${row.key}-current`} name={`${row.key}-current`} dataKey={`values.${row.key}.current`} hide={hiddenSites.includes(row.key)} type="linear" stroke={config[row.key].color} strokeWidth={2} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />,
          <Line key={`${row.key}-previous`} name={`${row.key}-previous`} dataKey={`values.${row.key}.previous`} hide={hiddenSites.includes(row.key)} type="linear" stroke={config[row.key].color} strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity={0.55} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />,
        ])}
      </LineChart>
    </ChartContainer>}
  </div>;
}
