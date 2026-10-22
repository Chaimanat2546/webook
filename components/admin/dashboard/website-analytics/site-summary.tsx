import Link from "next/link";
import { ChartNoAxesColumnIncreasing, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Badge } from "../../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";
import { columns, MetricCells, labels } from "./table-metrics";
import { WebsiteSiteSummaryGraph } from "./site-summary-graph";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";

import { websitePeriodHref, type WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import type { WebsiteOption } from "./filters";
import { SummaryRangeFilter } from "./summary-range-filter";
import { WebsiteDatasetControls } from "./dataset-controls";
import { isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";
import { WebsiteAnalyticsLoadingProvider } from "./analytics-loading";

function displayDomain(origin: string): string {
  return `www.${new URL(origin).hostname.replace(/^www\./, "")}`;
}

function SiteStatus({ site, showCoverage = false }: { site: WebsiteSummary; showCoverage?: boolean }) {
  const loaded = site.status === "complete" || site.status === "partial";
  const unconfigured = site.status === "not_configured";
  const partial = showCoverage && site.status === "partial";
  return <Badge variant="outline" className={partial || unconfigured ? "border-amber-200 bg-amber-50 text-amber-700" : loaded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>{partial ? "ข้อมูลไม่ครบ" : loaded ? "โหลดสำเร็จ" : unconfigured ? "ยังไม่ได้ตั้งค่า" : (site.status === "hourly_unavailable" || site.status === "time_range_unavailable") ? labels[site.status] : "โหลดไม่ได้"}</Badge>;
}

function CompactMobileSiteSummary({ sites, month, range, compare, scope }: { sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange; compare: boolean; scope?: WebsiteScopeSelection }) {
  return <div className="md:hidden"><h3 className="text-sm font-semibold">สถิติแยกเว็บไซต์</h3><p className="mb-2 text-xs text-muted-foreground">แสดงข้อมูล {sites.length} โดเมนในระบบ พร้อมรายละเอียดตัวชี้วัด</p><ul className="divide-y border-y" aria-label="สถิติแยกเว็บไซต์บนมือถือ">{sites.map((site, index) => <li key={site.key}>
    <Link href={websitePeriodHref({ month: range?.to.slice(0, 7) ?? month, ...range, site: site.key, page: 1 }, {}, compare, scope)} className="flex min-h-16 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-primary">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `var(--chart-${index % 5 + 1})` }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{site.displayName}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{displayDomain(site.origin)}</span></span><span className="shrink-0 font-mono text-sm font-semibold tabular-nums" aria-label="จำนวนเข้าชม">{site.totals?.page_views.toLocaleString("th-TH") ?? "—"}</span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
    {site.status !== "complete" && site.status !== "partial" && <div className="pb-2 pl-5"><SiteStatus site={site} showCoverage /></div>}
  </li>)}</ul></div>;
}

function MobileSiteSummary({ sites, month, range, showCoverage = false, scope }: { sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange; showCoverage?: boolean; scope?: WebsiteScopeSelection }) {
  return <ul className="divide-y md:hidden" aria-label="สถิติแยกเว็บไซต์บนมือถือ">{sites.map(site => <li key={site.key} className="min-w-0 py-3 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <Link href={websitePeriodHref({ month: range?.to.slice(0, 7) ?? month, ...range, site: site.key, page: 1 }, {}, showCoverage, scope)} className="flex min-w-0 flex-1 items-center gap-1 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block break-words text-sm font-medium">{site.displayName}</span><span className="mt-0.5 block break-all text-[11px] text-muted-foreground">{displayDomain(site.origin)}</span></span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <SiteStatus site={site} showCoverage={showCoverage} />
    </div>
    <dl className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2">{columns.filter(column => ["page_views", "contact_clicks", "gallery_opens"].includes(column.key)).map(column => <div key={column.key} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{column.label}</dt><dd className={`break-all text-base font-semibold tabular-nums ${column.key === "contact_clicks" ? "text-primary" : ""}`}>{site.totals?.[column.key].toLocaleString("th-TH") ?? "—"}</dd></div>)}</dl>
    <details className="group mt-1">
      <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">ช่องทางติดต่อ<span className="sr-only"> {site.displayName}</span><ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" /></summary>
      <dl className="grid grid-cols-3 gap-2 pb-2">{columns.filter(column => ["phone_clicks", "line_clicks", "chat_clicks"].includes(column.key)).map(column => <div key={column.key} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{column.key === "chat_clicks" ? "แชท" : column.label}</dt><dd className="break-all text-sm font-medium tabular-nums">{site.totals?.[column.key].toLocaleString("th-TH") ?? "—"}</dd></div>)}</dl>
    </details>
  </li>)}</ul>;
}

export function WebsiteSiteSummary({ granularity, sites, month, range, today, asOf, compare = false, previous, scope, mobileOverview = false }: { granularity: "hour" | "day"; sites: WebsiteSummary[]; month: string; range?: AnalyticsDateRange; today?: string; asOf?: string; compare?: boolean; previous?: WebsitePreviousPeriod; scope?: WebsiteScopeSelection; options?: WebsiteOption[]; mobileOverview?: boolean }) {
  const availableFrom = sites.flatMap(site => {
    const time = site.coverage ? Date.parse(site.coverage.data_available_from) : NaN;
    return Number.isFinite(time) ? [new Date(time + 7 * 3600000).toISOString().slice(0, 10)] : [];
  }).sort()[0];
  const periodControls = range && today ? <>
    <div className="flex min-w-0 max-w-full items-center gap-1"><span className="shrink-0 text-xs text-muted-foreground">ช่วงหลัก</span><SummaryRangeFilter key={`${range.from}:${range.to}`} month={month} range={range} today={today} availableFrom={availableFrom} /></div>
    <WebsiteDatasetControls granularity={granularity} range={range} today={today} sites={sites} scope={scope} comparison={compare && previous ? { ...previous.range, sites: previous.sites.map(site => site.key) } : undefined} />
  </> : undefined;
  return <WebsiteAnalyticsLoadingProvider><Card data-dashboard-website-card={mobileOverview || undefined}>
    <CardHeader className="flex flex-col items-start gap-3 lg:flex-row">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="shrink-0 rounded-lg bg-muted p-2 text-primary"><ChartNoAxesColumnIncreasing aria-hidden className="size-5" /></span>
        <div className="min-w-0"><CardTitle><h2>แนวโน้มประสิทธิภาพเว็บไซต์</h2></CardTitle><p className="mt-1 text-xs text-muted-foreground">เปรียบเทียบจำนวนเข้าชม การกดติดต่อ และการเปิดรูป ของแต่ละเว็บไซต์</p><p className="mt-1 text-xs text-muted-foreground">{sites.length} โดเมนที่ผูกในระบบ</p></div>
      </div>
      {periodControls && <div className="ml-auto flex w-fit min-w-0 max-w-full flex-wrap items-start justify-end gap-x-3 gap-y-2">{periodControls}</div>}
    </CardHeader>
    <CardContent>
      {isFutureAnalyticsRange(range, asOf) && <p role="status" className="mb-3 text-sm text-amber-700">ยังไม่ถึงช่วงเวลาที่เลือก · ยอดรวมยังไม่มีข้อมูลที่สังเกตแล้ว</p>}
      {range && compare && !previous && sites.some(site => site.status === "partial") && <p role="status" className="mb-3 text-sm text-amber-700">ข้อมูลบางเว็บไซต์ไม่ครบ</p>}
      {!sites.length ? <p className="text-sm text-muted-foreground">ยังไม่มีเว็บไซต์ในระบบ</p> : <><WebsiteSiteSummaryGraph mobileOverview={mobileOverview} mobileControls={periodControls} granularity={granularity} sites={sites} month={month} range={range} today={today} asOf={asOf} compare={compare} previous={previous} scope={scope} />{mobileOverview ? <CompactMobileSiteSummary sites={sites} month={month} range={range} compare={compare} scope={scope} /> : <MobileSiteSummary sites={sites} month={month} range={range} showCoverage={compare} scope={scope} />}<div className="hidden md:block"><Table aria-label="สถิติแยกเว็บไซต์">
        <TableHeader><TableRow><TableHead className="min-w-48">เว็บไซต์ / โดเมน</TableHead><TableHead className="min-w-32">สถานะข้อมูล</TableHead>{columns.map(column => <TableHead key={column.key} className="text-right">{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{sites.map(site => {
          return <TableRow key={site.key}>
            <TableCell><Link href={websitePeriodHref({ month: range?.to.slice(0, 7) ?? month, ...range, site: site.key, page: 1 }, {}, compare, scope)} className="block rounded-sm py-1 hover:underline focus-visible:outline-2"><span className="font-medium">{site.displayName}</span><span className="mt-1 block text-xs text-muted-foreground">{displayDomain(site.origin)}</span></Link></TableCell>
            <TableCell><SiteStatus site={site} showCoverage={compare} /></TableCell>
            <MetricCells metrics={site.totals} />
          </TableRow>;
        })}</TableBody>
      </Table></div></>}
    </CardContent>
  </Card></WebsiteAnalyticsLoadingProvider>;
}
