"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import { websiteChartData, type WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { WebsiteChartLegend, websiteLineStyles as lineStyles } from "./website-chart-legend";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

interface WebsiteSiteTrendChartProps {
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
  metric: WebsiteChartMetric;
  hiddenSites: string[];
  onToggleSite: (key: string) => void;
  showLegend?: boolean;
}

const metricLabels: Record<WebsiteChartMetric, string> = { page_views: "เข้าชม", contact_clicks: "กดติดต่อรวม", gallery_opens: "เปิดรูป" };
const fullDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

export function WebsiteSiteTrendChart({ sites, month, range, metric, hiddenSites, onToggleSite, showLegend = true }: WebsiteSiteTrendChartProps) {
  const data = websiteChartData(sites, month, metric, "day", range);
  const config: ChartConfig = Object.fromEntries(sites.map((site, index) => [site.key, { label: site.displayName, color: `var(--chart-${index % 5 + 1})` }]));
  const available = sites.filter(site => data.some(point => point.values[site.key] !== null));
  const missing = sites.filter(site => !available.includes(site));
  const periodLabel = range ? `${range.from} ถึง ${range.to}` : new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${month}-01T00:00:00+07:00`));

  return <figure aria-label="กราฟแนวโน้มรายวันแต่ละเว็บไซต์" className="mb-6 min-w-0 border-b pb-6">
    <p className="mb-3 text-xs text-muted-foreground">{metricLabels[metric]} · ครั้งต่อวัน · {periodLabel} · เวลาไทย</p>
    {available.length ? <>
      {showLegend && <WebsiteChartLegend sites={sites} availableSites={available.map(site => site.key)} hiddenSites={hiddenSites} onToggleSite={onToggleSite} />}
      <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72">
        <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} minTickGap={32} interval="preserveStartEnd" tickFormatter={(date: string) => `${date.slice(8)}/${date.slice(5, 7)}`} />
          <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
          <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent className="max-w-60" labelFormatter={label => fullDate.format(new Date(`${String(label)}T00:00:00+07:00`))} />} />
          {sites.map((site, index) => <Line key={site.key} name={site.key} dataKey={`values.${site.key}`} hide={hiddenSites.includes(site.key)} type="linear" stroke={config[site.key].color} strokeDasharray={showLegend ? lineStyles[index % 5] : undefined} strokeWidth={2} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ChartContainer>
    </> : <Empty className="min-h-60 border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ChartNoAxesColumnIncreasing aria-hidden /></EmptyMedia>
        <EmptyTitle>ยังไม่มีข้อมูลสถิติรายวัน</EmptyTitle>
        <EmptyDescription>เลือกดูยอดรวมแต่ละเว็บได้ หรือเลือกช่วงวันที่อื่นเพื่อดูแนวโน้ม</EmptyDescription>
      </EmptyHeader>
    </Empty>}
    {missing.length > 0 && <p className="mt-3 text-xs text-muted-foreground">ไม่แสดงเส้นของเว็บไซต์ที่ไม่มีข้อมูล: {missing.map(site => site.displayName).join(" · ")}</p>}
  </figure>;
}
