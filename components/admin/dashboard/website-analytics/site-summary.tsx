import Link from "next/link";
import { ChartNoAxesColumnIncreasing, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Badge } from "../../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";
import { columns, MetricCells } from "./table-metrics";
import { WebsiteSiteSummaryChart } from "./site-summary-chart";
import { websiteAnalyticsHref, type AnalyticsDateRange, type WebsiteSummary } from "../../../../lib/website-analytics";

import { SummaryRangeFilter } from "./summary-range-filter";

function displayDomain(origin: string): string {
  return `www.${new URL(origin).hostname.replace(/^www\./, "")}`;
}

function SiteStatus({ site }: { site: WebsiteSummary }) {
  const loaded = site.status === "complete" || site.status === "partial";
  const unconfigured = site.status === "not_configured";
  return <Badge variant="outline" className={loaded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : unconfigured ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}>{loaded ? "โหลดสำเร็จ" : unconfigured ? "ยังไม่ได้ตั้งค่า" : "โหลดไม่ได้"}</Badge>;
}

function MobileSiteSummary({ sites, month, range }: { sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange }) {
  return <ul className="divide-y md:hidden" aria-label="สถิติแยกเว็บไซต์บนมือถือ">{sites.map(site => <li key={site.key} className="min-w-0 py-3 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <Link href={websiteAnalyticsHref({ month: range?.to.slice(0, 7) ?? month, ...range, site: site.key, page: 1 }, {})} className="flex min-w-0 flex-1 items-center gap-1 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block break-words text-sm font-medium">{site.displayName}</span><span className="mt-0.5 block break-all text-[11px] text-muted-foreground">{displayDomain(site.origin)}</span></span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <SiteStatus site={site} />
    </div>
    <dl className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2">{columns.filter(column => ["page_views", "contact_clicks", "gallery_opens"].includes(column.key)).map(column => <div key={column.key} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{column.label}</dt><dd className={`break-all text-base font-semibold tabular-nums ${column.key === "contact_clicks" ? "text-primary" : ""}`}>{site.totals?.[column.key].toLocaleString("th-TH") ?? "—"}</dd></div>)}</dl>
    <details className="group mt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">ช่องทางติดต่อ<span className="sr-only"> {site.displayName}</span><ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" /></summary>
      <dl className="grid grid-cols-3 gap-2 pb-2">{columns.filter(column => ["phone_clicks", "line_clicks", "chat_clicks"].includes(column.key)).map(column => <div key={column.key} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{column.key === "chat_clicks" ? "แชท" : column.label}</dt><dd className="break-all text-sm font-medium tabular-nums">{site.totals?.[column.key].toLocaleString("th-TH") ?? "—"}</dd></div>)}</dl>
    </details>
  </li>)}</ul>;
}

export function WebsiteSiteSummary({ sites, month, range, today }: { sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange; today?: string }) {
  const availableFrom = sites.flatMap(site => {
    if (!site.coverage) return [];
    const time = Date.parse(site.coverage.data_available_from);
    return Number.isFinite(time) ? [new Date(time + 7 * 3600000).toISOString().slice(0, 10)] : [];
  }).sort()[0];
  return <Card>
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 w-full items-start gap-3 sm:w-auto sm:flex-1">
        <span className="shrink-0 rounded-lg bg-muted p-2 text-primary"><ChartNoAxesColumnIncreasing aria-hidden className="size-5" /></span>
        <div className="min-w-0"><CardTitle><h2>แนวโน้มประสิทธิภาพเว็บไซต์</h2></CardTitle><p className="mt-1 text-xs text-muted-foreground">เปรียบเทียบจำนวนเข้าชม การกดติดต่อ และการเปิดรูป ของแต่ละเว็บไซต์</p></div>
      </div>
      <span className="text-xs text-muted-foreground">{sites.length} โดเมนที่ผูกในระบบ</span>
      {range && today && <SummaryRangeFilter key={`${range.from}:${range.to}`} month={month} range={range} today={today} availableFrom={availableFrom} />}
    </CardHeader>
    <CardContent>
      {range && sites.some(site => site.status === "partial") && <p role="status" className="mb-3 text-sm text-amber-700">บางเว็บไซต์มีข้อมูลไม่ครบช่วงวันที่ที่เลือก ยอดที่แสดงรวมเฉพาะข้อมูลที่มี</p>}
      {!sites.length ? <p className="text-sm text-muted-foreground">ยังไม่มีเว็บไซต์ในระบบ</p> : <><WebsiteSiteSummaryChart key={`${month}:${range?.from}:${range?.to}`} sites={sites} month={month} range={range} /><MobileSiteSummary sites={sites} month={month} range={range} /><div className="hidden md:block"><Table aria-label="สถิติแยกเว็บไซต์">
        <TableHeader><TableRow><TableHead className="min-w-48">เว็บไซต์ / โดเมน</TableHead><TableHead className="min-w-32">สถานะข้อมูล</TableHead>{columns.map(column => <TableHead key={column.key} className="text-right">{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{sites.map(site => {
          return <TableRow key={site.key}>
            <TableCell><Link href={websiteAnalyticsHref({ month: range?.to.slice(0, 7) ?? month, ...range, site: site.key, page: 1 }, {})} className="block rounded-sm py-1 hover:underline focus-visible:outline-2"><span className="font-medium">{site.displayName}</span><span className="mt-1 block text-xs text-muted-foreground">{displayDomain(site.origin)}</span></Link></TableCell>
            <TableCell><SiteStatus site={site} /></TableCell>
            <MetricCells metrics={site.totals} />
          </TableRow>;
        })}</TableBody>
      </Table></div></>}
    </CardContent>
  </Card>;
}
