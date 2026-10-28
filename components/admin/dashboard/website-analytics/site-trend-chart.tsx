"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import { websiteChartData, type WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { WebsiteChartLegend } from "./website-chart-legend";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

import { analyticsTimeRangeLabel, hourLabel, isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";
import { periodPointLabel } from "./period-comparison-summary";

interface WebsiteSiteTrendChartProps {
  compact?: boolean;
  colorKeys?: string[];
  granularity: "hour" | "day";
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
  metric: WebsiteChartMetric;
  hiddenSites: string[];
  onToggleSite: (key: string) => void;
  showLegend?: boolean;
  comparison?: boolean;
  asOf?: string;
}

const metricLabels: Record<WebsiteChartMetric, string> = { page_views: "เข้าชม", contact_clicks: "กดติดต่อรวม", gallery_opens: "เปิดรูป" };

export function WebsiteSiteTrendChart({ compact = false, granularity, sites, month, range, metric, hiddenSites, onToggleSite, showLegend = true, comparison = false, asOf, colorKeys = sites.map(site => site.key) }: WebsiteSiteTrendChartProps) {
  const hourly = granularity === "hour";
  const data = websiteChartData(sites, month, metric, hourly ? "hour" : "day", range, asOf);
  const future = isFutureAnalyticsRange(range, asOf);
  const config: ChartConfig = Object.fromEntries(sites.map(site => [site.key, { label: site.displayName, color: compact && sites.length === 1 ? "var(--chart-2)" : `var(--chart-${Math.max(0, colorKeys.indexOf(site.key)) % 5 + 1})` }]));
  const available = sites.filter(site => data.some(point => point.values[site.key] !== null));
  const missing = sites.filter(site => !available.includes(site));
  const periodLabel = range ? `${range.from} ถึง ${range.to}` : new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${month}-01T00:00:00+07:00`));

  return <figure aria-label={hourly ? "กราฟแนวโน้มรายชั่วโมงแต่ละเว็บไซต์" : "กราฟแนวโน้มรายวันแต่ละเว็บไซต์"} className={compact ? "min-w-0" : "mb-6 min-w-0 border-b pb-6"}>
    <p className={compact ? "sr-only" : "mb-3 text-xs text-muted-foreground"}>{metricLabels[metric]} · {hourly ? "ครั้งต่อชั่วโมง" : "ครั้งต่อวัน"} · {periodLabel} · {analyticsTimeRangeLabel(range)} · เวลาไทย</p>
    {available.length ? <>
      {showLegend && <WebsiteChartLegend comparison={comparison} colorKeys={colorKeys} sites={sites} availableSites={available.map(site => site.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} />}
      <ChartContainer config={config} className={compact ? "h-48 w-full aspect-auto" : "h-60 w-full aspect-auto sm:h-72"}>
        <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} minTickGap={32} interval="preserveStartEnd" tickFormatter={(date: string) => hourly ? hourLabel(date) : compact ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T00:00:00+07:00`)) : `${date.slice(8)}/${date.slice(5, 7)}`} />
          <YAxis hide={compact} width={compact ? 0 : 42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
          <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent className="max-w-60" labelFormatter={label => periodPointLabel(String(label), asOf, range)} />} />
          {sites.map(site => <Line key={site.key} name={site.key} dataKey={`values.${site.key}`} hide={hiddenSites.includes(site.key)} type={compact ? "monotone" : "linear"} stroke={config[site.key].color} strokeDasharray={comparison ? "6 4" : undefined} strokeWidth={2} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ChartContainer>
    </> : <Empty className="min-h-60 border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ChartNoAxesColumnIncreasing aria-hidden /></EmptyMedia>
        <EmptyTitle>{future ? "ยังไม่ถึงช่วงเวลาที่เลือก" : hourly ? "ยังไม่มีข้อมูลสถิติรายชั่วโมง" : "ยังไม่มีข้อมูลสถิติรายวัน"}</EmptyTitle>
        <EmptyDescription>เลือกดูยอดรวมแต่ละเว็บได้ หรือเลือกช่วงวันที่อื่นเพื่อดูแนวโน้ม</EmptyDescription>
      </EmptyHeader>
    </Empty>}
    {missing.length > 0 && <p className="mt-3 text-xs text-muted-foreground">ไม่แสดงเส้นของเว็บไซต์ที่ไม่มีข้อมูล: {missing.map(site => site.displayName).join(" · ")}</p>}
  </figure>;
}
