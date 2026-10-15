"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import { websiteChartData, type WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { Button } from "../../../ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

interface WebsiteSiteTrendChartProps {
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
  metric: WebsiteChartMetric;
  hiddenSites: string[];
  onToggleSite: (key: string) => void;
}

const metricLabels: Record<WebsiteChartMetric, string> = { page_views: "เข้าชม", contact_clicks: "กดติดต่อรวม", gallery_opens: "เปิดรูป" };
const lineStyles = [undefined, "6 3", "2 3", "8 3 2 3", "10 4"] as const;
const fullDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

export function WebsiteSiteTrendChart({ sites, month, range, metric, hiddenSites, onToggleSite }: WebsiteSiteTrendChartProps) {
  const data = websiteChartData(sites, month, metric, "day", range);
  const config: ChartConfig = Object.fromEntries(sites.map((site, index) => [site.key, { label: site.displayName, color: `var(--chart-${index % 5 + 1})` }]));
  const available = sites.filter(site => data.some(point => point.values[site.key] !== null));
  const missing = sites.filter(site => !available.includes(site));
  const visibleCount = available.filter(site => !hiddenSites.includes(site.key)).length;
  const periodLabel = range ? `${range.from} ถึง ${range.to}` : new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${month}-01T00:00:00+07:00`));

  return <figure aria-label="กราฟแนวโน้มรายวันแต่ละเว็บไซต์" className="mb-6 min-w-0 border-b pb-6">
    <p className="mb-3 text-xs text-muted-foreground">{metricLabels[metric]} · ครั้งต่อวัน · {periodLabel} · เวลาไทย</p>
    {available.length ? <>
      <div role="group" aria-label="เว็บไซต์ในกราฟรายวัน" className="mb-3 flex flex-wrap gap-x-2 gap-y-1">
        {sites.map((site, index) => {
          const hasData = available.includes(site);
          const visible = !hiddenSites.includes(site.key);
          return <Button key={site.key} type="button" variant="ghost" className="h-auto min-h-11 min-w-0 max-w-full justify-start gap-2 whitespace-normal px-2 text-left text-xs" aria-pressed={hasData && visible} disabled={!hasData || (visible && visibleCount === 1)} onClick={() => onToggleSite(site.key)}>
            <svg aria-hidden="true" className="h-3 w-6 shrink-0" viewBox="0 0 24 12"><line x1="1" y1="6" x2="23" y2="6" stroke={config[site.key].color} strokeWidth="2" strokeDasharray={lineStyles[index % 5]} /></svg>
            <span className={`min-w-0 break-words ${hasData && !visible ? "line-through opacity-50" : ""}`}>{site.displayName}{!hasData && " (ไม่มีข้อมูล)"}</span>
          </Button>;
        })}
      </div>
      <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72">
        <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} minTickGap={32} interval="preserveStartEnd" tickFormatter={(date: string) => `${date.slice(8)}/${date.slice(5, 7)}`} />
          <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
          <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent className="max-w-60" labelFormatter={label => fullDate.format(new Date(`${String(label)}T00:00:00+07:00`))} />} />
          {sites.map((site, index) => <Line key={site.key} name={site.key} dataKey={`values.${site.key}`} hide={hiddenSites.includes(site.key)} type="linear" stroke={config[site.key].color} strokeDasharray={lineStyles[index % 5]} strokeWidth={2} dot={{ r: data.length <= 45 ? 2 : 1 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
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
