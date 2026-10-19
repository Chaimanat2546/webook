"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import { websiteComparisonData } from "../../../../lib/website-analytics-chart";
import { analyticsTimeRangeLabel } from "../../../../lib/website-analytics-time";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

const config = {
  page_views: { label: "เข้าชม", color: "var(--chart-2)" },
  contact_clicks: { label: "กดติดต่อรวม", color: "var(--chart-1)" },
  gallery_opens: { label: "เปิดรูป", color: "var(--chart-3)" },
} satisfies ChartConfig;
const metrics = ["page_views", "contact_clicks", "gallery_opens"] as const;

function ScrollingTooltip({ viewport, ...props }: TooltipContentProps<TooltipValueType, string | number> & { viewport: HTMLDivElement | null }) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!viewport || !props.active) return;
    function align() {
      const element = content.current;
      if (!element || !viewport) return;
      element.style.transform = "";
      element.style.maxWidth = `${viewport.clientWidth}px`;
      const bounds = element.getBoundingClientRect();
      const visible = viewport.getBoundingClientRect();
      const left = Math.max(visible.left, Math.min(bounds.left, visible.left + viewport.clientWidth - bounds.width));
      element.style.transform = `translateX(${left - bounds.left}px)`;
    }
    align();
    viewport.addEventListener("scroll", align, { passive: true });
    window.addEventListener("resize", align);
    return () => {
      viewport.removeEventListener("scroll", align);
      window.removeEventListener("resize", align);
    };
  }, [viewport, props.active, props.coordinate?.x, props.coordinate?.y, props.label]);
  return <div ref={content} className="w-60"><ChartTooltipContent active={props.active} payload={props.payload} label={props.label} className="w-full min-w-0" /></div>;
}

export function WebsiteSiteSummaryChart({ sites, month, range, legend }: { sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange; legend?: ReactNode }) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const points = websiteComparisonData(sites);
  const data = points.filter(point => point.page_views !== null);
  const missing = points.filter(point => point.page_views === null);
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${month}-01T00:00:00+07:00`));

  return <figure aria-label="กราฟเปรียบเทียบสถิติทุกเว็บไซต์" className="mb-6 min-w-0 border-b pb-6">
    <p className="mb-3 text-xs text-muted-foreground">เปรียบเทียบผลรวมแต่ละเว็บไซต์ · {range ? `${range.from} ถึง ${range.to}` : monthLabel} · {analyticsTimeRangeLabel(range)} · เวลาไทย</p>
    {legend}
    {data.length > 0 ? <>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="คำอธิบายสีกราฟ">
        {metrics.map(metric => <li key={metric} className="flex items-center gap-2"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: config[metric].color }} />{config[metric].label}</li>)}
      </ul>
      <div className="relative">
        <div ref={setViewport} role="region" aria-label="เลื่อนดูกราฟแท่งเว็บไซต์" tabIndex={0} className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-primary">
          <ChartContainer config={config} className="h-60 w-full aspect-auto sm:h-72" style={{ minWidth: data.length * 144 + 54 }}>
            <BarChart accessibilityLayer data={data} barSize={28} barGap={4} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="displayName" axisLine={false} tickLine={false} interval={0} tickMargin={10} tickFormatter={(name: string) => name.length > 18 ? `${name.slice(0, 18)}…` : name} />
              <YAxis width={42} allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("th-TH", { notation: "compact" }).format(value)} />
              <ChartTooltip isAnimationActive={false} content={props => <ScrollingTooltip {...props} viewport={viewport} />} />
              {metrics.map(metric => <Bar key={metric} dataKey={metric} fill={config[metric].color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />)}
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </> : <Empty className="min-h-60 border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ChartNoAxesColumnIncreasing aria-hidden /></EmptyMedia>
        <EmptyTitle>ยังไม่มีข้อมูลสถิติ</EmptyTitle>
        <EmptyDescription>สถิติจากเว็บไซต์จะแสดงที่นี่เมื่อเชื่อมต่อสำเร็จ</EmptyDescription>
      </EmptyHeader>
    </Empty>}
    {missing.length > 0 && <p className="mt-3 text-xs text-muted-foreground">ไม่แสดงแท่งของเว็บไซต์ที่ไม่มีข้อมูล: {missing.map(site => site.displayName).join(" · ")}</p>}
  </figure>;
}
