"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { websiteAnalyticsHref, type AnalyticsDay, type AnalyticsMonth, type WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Button } from "../../../ui/button";
const config = {
  page_views: { label: "เข้าชม", color: "var(--chart-2)" },
  contact_clicks: { label: "กดติดต่อ", color: "var(--primary)" },
} satisfies ChartConfig;
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00+07:00`).toLocaleDateString("th-TH", { month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
export function WebsiteDailyChart({ points, monthly, query, available }: { points: AnalyticsDay[]; monthly?: AnalyticsMonth[]; query: WebsiteAnalyticsQuery; available: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<"views" | "contacts" | null>(null);
  const views = selected !== "contacts", contacts = selected !== "views";
  const isMonthly = query.granularity === "month";
  const data: { date: string; page_views: number | null; contact_clicks: number | null }[] = isMonthly ? monthly ?? [] : points;
  const hasData = isMonthly ? monthly?.some(point => point.page_views !== null) : available;
  const failed = monthly?.filter(point => point.status === "unavailable") ?? [];
  return <Card><CardHeader className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle><h2>แนวโน้ม{isMonthly ? "รายเดือน" : "รายวัน"}</h2></CardTitle><p className="mt-1 hidden text-xs text-muted-foreground md:block">{isMonthly ? "ย้อนหลัง 6 เดือน · การ์ดและตารางแสดงเฉพาะเดือนที่เลือก" : "จำนวนครั้งในเดือนที่เลือก"}</p></div>
    <div className="flex gap-1 rounded-lg bg-muted p-1" aria-label="ช่วงกราฟ">{(["day", "month"] as const).map(value => <Button key={value} variant={(query.granularity ?? "day") === value ? "default" : "ghost"} aria-pressed={(query.granularity ?? "day") === value} onClick={() => router.push(websiteAnalyticsHref(query, { granularity: value }), { scroll: false })}>{value === "day" ? "รายวัน" : "รายเดือน"}</Button>)}</div>
  </CardHeader><CardContent>
    {isMonthly && failed.length > 0 && <p className="mb-4 text-xs text-amber-700">โหลดกราฟไม่ได้ในเดือน {failed.map(point => monthLabel(point.date)).join(" · ")} กรุณาลองใหม่</p>}
    {hasData ? <figure aria-label={`กราฟเข้าชมและกดติดต่อ${isMonthly ? "รายเดือน" : "รายวัน"}`} className="min-w-0">
      <div className="mb-2 flex flex-wrap justify-end gap-2"><Button variant="outline" aria-pressed={views} onClick={() => setSelected(value => value === "views" ? null : "views")}><span className="size-2 rounded-full bg-chart-2" />เข้าชม</Button><Button variant="outline" aria-pressed={contacts} onClick={() => setSelected(value => value === "contacts" ? null : "contacts")}><span className="size-2 rounded-full bg-primary" />กดติดต่อ</Button></div>
      <ChartContainer config={config} className="h-40 w-full md:h-64"><AreaChart data={data} accessibilityLayer margin={{ left: -15, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(date: string) => isMonthly ? monthLabel(date) : date.slice(8)} interval="preserveStartEnd" minTickGap={25} axisLine={false} tickLine={false} />
        <YAxis includeHidden allowDecimals={false} width={50} axisLine={false} tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={label => isMonthly ? monthLabel(String(label)) : String(label)} />} />
        <Area hide={!views} type="monotone" dataKey="page_views" stroke="var(--color-page_views)" fill="var(--color-page_views)" fillOpacity={0.08} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Area hide={!contacts} type="monotone" dataKey="contact_clicks" stroke="var(--color-contact_clicks)" fill="var(--color-contact_clicks)" fillOpacity={0.03} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </AreaChart></ChartContainer>
    </figure> : <p className="py-12 text-center text-sm text-muted-foreground">{isMonthly && monthly?.every(point => point.status === "no_data") ? "ไม่มีข้อมูลที่เก็บไว้ในช่วงนี้" : "ยังโหลดข้อมูลกราฟไม่ได้"}</p>}
  </CardContent></Card>;
}
