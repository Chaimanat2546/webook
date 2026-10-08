import { MobileRanking } from "./mobile-ranking";
import { columns, labels, MetricCells } from "./table-metrics";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "../../../ui/table";
import { Badge } from "../../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { WEBSITE_ANALYTICS_SORTS, websiteAnalyticsHref, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";

export function WebsiteAnalyticsTables({ report, query }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery }) {
  const sort = WEBSITE_ANALYTICS_SORTS.find(option => option.value === (query.sort ?? "contacts")) ?? WEBSITE_ANALYTICS_SORTS[0];
  return <div className="grid min-w-0 gap-6">{report.websites.map(site => <Card key={site.key} id={`website-${site.key}`} className="min-w-0 scroll-mt-4 gap-2" aria-labelledby={`title-${site.key}`}>
    <CardHeader className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><CardTitle><h2 id={`title-${site.key}`}>{`${sort.heading} 5 อันดับ`}</h2></CardTitle></div><div className="flex shrink-0 flex-wrap items-center gap-3">{site.villas && site.villas.total > 0 && <Link href={websiteAnalyticsHref(query, { site: site.key, view: "houses", granularity: "day", page: 1, pages: {} })} className="inline-flex items-center text-sm text-primary hover:underline focus-visible:outline-2">ดูทั้งหมด</Link>}{site.status !== "partial" && <Badge variant={site.status === "complete" ? "secondary" : "outline"}>{labels[site.status]}</Badge>}</div></CardHeader>
    <CardContent className="min-w-0 space-y-3">
      {report.nameSortUnavailable && <p role="status" className="text-sm text-amber-700">โหลดชื่อบ้านไม่ได้ ขณะนี้เรียงตามรหัสบ้าน กรุณาลองใหม่</p>}
      <p className="hidden text-xs text-muted-foreground md:block">เรียงตาม{sort.label} · {sort.direction} · ยอดรวมท้ายตารางรวมบ้านทุกอันดับ</p>
      {site.coverage && <p className="hidden text-xs text-muted-foreground md:block">มีข้อมูลตั้งแต่ {new Date(site.coverage.data_available_from).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>}
      {!site.villas ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">ยังแสดงข้อมูลบ้านไม่ได้ · {labels[site.status]}</p> : <>
        <MobileRanking site={site} /><div className="hidden md:block"><Table aria-label={`สถิติบ้าน ${site.displayName}`}><TableHeader><TableRow><TableHead className="min-w-56">รหัสบ้าน / รายละเอียด</TableHead>{columns.map(column => <TableHead key={column.key} className="text-right">{column.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{site.villas.rows.slice(0, 5).map((villa, index) => <TableRow key={villa.villa_id}><TableCell className="max-w-80 whitespace-normal py-4"><div className="flex flex-wrap items-center gap-2"><span className="w-5 text-xs tabular-nums text-muted-foreground" aria-label={`อันดับ ${index + 1}`}>{index + 1}</span><span className="rounded bg-primary/10 px-2 py-1 font-mono text-xs text-primary">DV-{villa.villa_id}</span><span className="break-words">{villa.title ?? "ไม่พบชื่อบ้านในทะเบียน"}</span></div></TableCell><MetricCells metrics={villa} /></TableRow>)}
            {!site.villas.total && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">ยังไม่มีข้อมูลแยกบ้านจากเว็บไซต์ที่โหลดได้</TableCell></TableRow>}
            <TableRow className="bg-muted/20"><TableCell className="whitespace-normal text-muted-foreground">กิจกรรมที่ไม่ระบุบ้าน</TableCell><MetricCells metrics={site.unattributed} /></TableRow>
          </TableBody><TableFooter><TableRow><TableCell className="whitespace-normal">รวมทั้งเว็บไซต์ <span className="text-xs font-normal text-muted-foreground">({site.villas.total.toLocaleString("th-TH")} บ้าน)</span></TableCell><MetricCells metrics={site.totals} /></TableRow></TableFooter>
        </Table></div>
      </>}
    </CardContent>
  </Card>)}</div>;
}
