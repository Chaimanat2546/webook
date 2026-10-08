import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "../../../ui/table";
import { DashboardPager } from "../dashboard-list-primitives";
import { columns, labels, MetricCells } from "./table-metrics";
import { websiteAnalyticsHref, type AnalyticsMetrics, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";

function MobileMetrics({ metrics }: { metrics: AnalyticsMetrics | null | undefined }) {
  return <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 text-sm">{columns.map(column => <div key={column.key}><dt className="text-xs text-muted-foreground">{column.label}</dt><dd className={`mt-1 font-medium tabular-nums ${column.key === "contact_clicks" ? "text-primary" : ""}`}>{metrics ? metrics[column.key].toLocaleString("th-TH") : "—"}</dd></div>)}</dl>;
}
export function WebsiteAnalyticsHouseList({ report, query }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery }) {
  return <div className="space-y-4">
    {report.searchUnavailable && <p role="alert" className="text-sm text-amber-700">ค้นหาชื่อบ้านไม่ได้ กรุณาลองใหม่ ผลที่แสดงค้นหาได้เฉพาะรหัสบ้าน</p>}
    {report.nameSortUnavailable && <p role="status" className="text-sm text-amber-700">โหลดชื่อบ้านไม่ได้ ขณะนี้เรียงตามรหัสบ้าน กรุณาลองใหม่</p>}
    {report.websites.map(site => {
      const page = site.villas;
      if (!page) return <div key={site.key} role="alert" className="overflow-hidden rounded-xl border px-4 py-6 text-sm text-muted-foreground">ยังแสดงข้อมูลบ้านไม่ได้ · {labels[site.status]}</div>;
      return <section key={site.key} aria-label={`สถิติบ้าน ${site.displayName}`}>
        <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="table-fixed" aria-label={`สถิติบ้าน ${site.displayName}`}>
          <TableHeader><TableRow><TableHead className="w-[34%]">บ้าน / DV</TableHead>{columns.map(column => <TableHead key={column.key} className="text-right text-xs">{column.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{page.rows.map((villa, index) => <TableRow key={villa.villa_id}><TableCell className="whitespace-normal align-top"><div className="flex items-start gap-2"><span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{(page.page - 1) * 10 + index + 1}</span><div className="min-w-0"><p className="break-words font-medium [overflow-wrap:anywhere]">{villa.title ?? "ไม่พบชื่อบ้านในทะเบียน"}</p><p className="mt-0.5 text-xs text-muted-foreground">DV-{villa.villa_id}</p></div></div></TableCell><MetricCells metrics={villa} /></TableRow>)}
            {!page.total && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{report.searchUnavailable ? "ยังแสดงผลค้นหาชื่อบ้านไม่ได้" : query.search ? "ไม่พบบ้านที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลแยกบ้านในเดือนนี้"}</TableCell></TableRow>}
            <TableRow className="bg-muted/20"><TableCell className="whitespace-normal text-muted-foreground">กิจกรรมที่ไม่ระบุบ้าน</TableCell><MetricCells metrics={site.unattributed} /></TableRow>
          </TableBody><TableFooter><TableRow><TableCell className="whitespace-normal">รวมทั้งเว็บไซต์</TableCell><MetricCells metrics={site.totals} /></TableRow></TableFooter>
        </Table></div>
        <div className="space-y-3 md:hidden" aria-label={`รายการบ้าน ${site.displayName}`}>
          {page.rows.map((villa, index) => <article key={villa.villa_id} className="rounded-xl border bg-card p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{villa.title ?? "ไม่พบชื่อบ้านในทะเบียน"}</h2><span className="text-xs tabular-nums text-muted-foreground">{(page.page - 1) * 10 + index + 1}</span></div><p className="mt-0.5 text-xs text-muted-foreground">DV-{villa.villa_id}</p><MobileMetrics metrics={villa} /></article>)}
          {!page.total && <p role="status" className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">{report.searchUnavailable ? "ยังแสดงผลค้นหาชื่อบ้านไม่ได้" : query.search ? "ไม่พบบ้านที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลแยกบ้านในเดือนนี้"}</p>}
          <div className="rounded-xl border bg-muted/20 p-3"><h2 className="text-sm font-medium text-muted-foreground">กิจกรรมที่ไม่ระบุบ้าน</h2><MobileMetrics metrics={site.unattributed} /></div>
          <div className="rounded-xl border bg-card p-3"><h2 className="text-sm font-semibold">รวมทั้งเว็บไซต์</h2><MobileMetrics metrics={site.totals} /></div>
        </div>
        <div className="mt-4"><DashboardPager page={page.page} pages={Math.max(1, Math.ceil(page.total / 10))} total={page.total} href={number => websiteAnalyticsHref(query, { pages: { ...query.pages, [site.key]: number } })} /></div>
      </section>;
    })}
  </div>;
}
