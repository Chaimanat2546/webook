"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type AnalyticsDateRange, type AnalyticsMonth, type WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Button } from "../../../ui/button";
import { ChartPeriodToggle } from "./chart-period-toggle";
import { WebsiteChartLoading, useWebsiteAnalyticsTransition } from "./analytics-loading";
import { periodPointLabel, shortRange } from "./period-comparison-summary";
import { analyticsTimeRangeLabel } from "../../../../lib/website-analytics-time";

interface WebsiteDailyChartPoint {
  date: string;
  page_views: number | null;
  contact_clicks: number | null;
}

interface WebsiteDailyChartProps {
  points: WebsiteDailyChartPoint[];
  monthly?: AnalyticsMonth[];
  query: WebsiteAnalyticsQuery;
  available: boolean;
  hidden?: boolean;
  onShow?: () => void;
  comparisonControl?: ReactNode;
  scope?: WebsiteScopeSelection;
  range?: AnalyticsDateRange;
  asOf?: string;
}
const config = {
  page_views: { label: "เข้าชม", color: "var(--chart-2)" },
  contact_clicks: { label: "กดติดต่อ", color: "var(--primary)" },
} satisfies ChartConfig;
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00+07:00`).toLocaleDateString("th-TH", { month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
export function WebsiteDailyChart({ points, monthly, query, available, hidden = false, onShow, comparisonControl, scope, range, asOf }: WebsiteDailyChartProps) {
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const [selected, setSelected] = useState<"views" | "contacts" | null>(null);
  const views = selected !== "contacts", contacts = selected !== "views";
  const isMonthly = query.granularity === "month" && !query.from;
  const data: { date: string; page_views: number | null; contact_clicks: number | null }[] = isMonthly ? monthly ?? [] : points;
  const hasData = !hidden && (isMonthly ? monthly?.some(point => point.page_views !== null) : available && points.some(point => point.page_views !== null || point.contact_clicks !== null));
  const failed = monthly?.filter(point => point.status === "unavailable") ?? [];
  return <Card><CardHeader className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle><h2>แนวโน้ม{isMonthly ? "รายเดือน" : "รายวัน"}</h2></CardTitle><p className="mt-1 text-xs text-muted-foreground">{isMonthly ? "ย้อนหลัง 6 เดือน · การ์ดและตารางแสดงเฉพาะเดือนที่เลือก" : range ? `${shortRange(range, true)} · เวลาไทย` : `จำนวนครั้งในเดือนที่เลือก · ${analyticsTimeRangeLabel()} · เวลาไทย`}</p></div>
    <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-1"><ChartPeriodToggle disabled={pending || Boolean(query.from)} value={isMonthly ? "month" : "day"} onChange={value => startTransition(() => router.push(websitePeriodHref(query, { granularity: value }, false, scope), { scroll: false }))} />{comparisonControl}</div>
  </CardHeader><CardContent><WebsiteChartLoading>
    {isMonthly && failed.length > 0 && <p className="mb-4 text-xs text-amber-700">โหลดกราฟไม่ได้ในเดือน {failed.map(point => monthLabel(point.date)).join(" · ")} กรุณาลองใหม่</p>}
    {hasData ? <figure aria-label={`กราฟเข้าชมและกดติดต่อ${isMonthly ? "รายเดือน" : "รายวัน"}`} className="min-w-0">
      <div className="mb-2 flex flex-wrap justify-end gap-2"><Button variant="outline" aria-pressed={views} onClick={() => setSelected(value => value === "views" ? null : "views")}><span className="size-2 rounded-full bg-chart-2" />เข้าชม</Button><Button variant="outline" aria-pressed={contacts} onClick={() => setSelected(value => value === "contacts" ? null : "contacts")}><span className="size-2 rounded-full bg-primary" />กดติดต่อ</Button></div>
      <ChartContainer config={config} className="h-40 w-full md:h-64"><AreaChart data={data} accessibilityLayer margin={{ left: -15, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(date: string) => isMonthly ? monthLabel(date) : query.from ? `${date.slice(8)}/${date.slice(5, 7)}` : date.slice(8)} interval="preserveStartEnd" minTickGap={25} axisLine={false} tickLine={false} />
        <YAxis includeHidden allowDecimals={false} width={50} axisLine={false} tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={label => isMonthly ? monthLabel(String(label)) : periodPointLabel(String(label), asOf, range)} />} />
        <Area hide={!views} type="monotone" dataKey="page_views" stroke="var(--color-page_views)" fill="var(--color-page_views)" fillOpacity={0.08} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Area hide={!contacts} type="monotone" dataKey="contact_clicks" stroke="var(--color-contact_clicks)" fill="var(--color-contact_clicks)" fillOpacity={0.03} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </AreaChart></ChartContainer>
    </figure> : <div className="space-y-2 py-12 text-center text-sm text-muted-foreground"><p>{hidden ? "เว็บไซต์นี้ถูกซ่อนในกราฟ" : isMonthly && monthly?.every(point => point.status === "no_data") ? "ไม่มีข้อมูลที่เก็บไว้ในช่วงนี้" : "ยังโหลดข้อมูลกราฟไม่ได้"}</p>{hidden && onShow && <Button type="button" variant="outline" className="h-8" onClick={onShow}>แสดงเว็บไซต์นี้</Button>}</div>}
  </WebsiteChartLoading></CardContent></Card>;
}
