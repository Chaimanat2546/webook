import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Badge } from "../../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";
import { columns, MetricCells } from "./table-metrics";
import { websiteAnalyticsHref, type WebsiteSummary } from "../../../../lib/website-analytics";

function SiteStatus({ site }: { site: WebsiteSummary }) {
  const loaded = site.status === "complete" || site.status === "partial";
  const unconfigured = site.status === "not_configured";
  return <Badge variant="outline" className={loaded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : unconfigured ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}>{loaded ? "โหลดสำเร็จ" : unconfigured ? "ยังไม่ได้ตั้งค่า" : "โหลดไม่ได้"}</Badge>;
}

function MobileSiteSummary({ sites, month }: { sites: WebsiteSummary[]; month: string }) {
  return <ul className="divide-y md:hidden" aria-label="สถิติแยกเว็บไซต์บนมือถือ">{sites.map(site => <li key={site.key} className="min-w-0 py-3 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <Link href={websiteAnalyticsHref({ month, site: site.key, page: 1 }, {})} className="flex min-w-0 flex-1 items-center gap-1 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block break-words text-sm font-medium">{site.displayName}</span><span className="mt-0.5 block break-all text-[11px] text-muted-foreground">{new URL(site.origin).hostname}</span></span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
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

export function WebsiteSiteSummary({ sites, month }: { sites: WebsiteSummary[]; month: string }) {
  return <Card>
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <div><CardTitle><h2>แยกเว็บไซต์</h2></CardTitle><p className="mt-1 text-xs text-muted-foreground">สถานะข้อมูลและผลรวมในเดือนที่เลือก · กดชื่อเว็บไซต์เพื่อดูสถิติ</p></div>
      <span className="text-xs text-muted-foreground">{sites.length} โดเมนที่ผูกในระบบ</span>
    </CardHeader>
    <CardContent>
      {!sites.length ? <p className="text-sm text-muted-foreground">ยังไม่มีเว็บไซต์ในระบบ</p> : <><MobileSiteSummary sites={sites} month={month} /><div className="hidden md:block"><Table aria-label="สถิติแยกเว็บไซต์">
        <TableHeader><TableRow><TableHead className="min-w-48">เว็บไซต์ / โดเมน</TableHead><TableHead className="min-w-32">สถานะข้อมูล</TableHead>{columns.map(column => <TableHead key={column.key} className="text-right">{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{sites.map(site => {
          return <TableRow key={site.key}>
            <TableCell><Link href={websiteAnalyticsHref({ month, site: site.key, page: 1 }, {})} className="block rounded-sm py-1 hover:underline focus-visible:outline-2"><span className="font-medium">{site.displayName}</span><span className="mt-1 block text-xs text-muted-foreground">{new URL(site.origin).hostname}</span></Link></TableCell>
            <TableCell><SiteStatus site={site} /></TableCell>
            <MetricCells metrics={site.totals} />
          </TableRow>;
        })}</TableBody>
      </Table></div></>}
    </CardContent>
  </Card>;
}
