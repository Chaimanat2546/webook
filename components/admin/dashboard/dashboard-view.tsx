import Link from "next/link";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { DASHBOARD_STATUSES, dashboardStatus, dashboardDate, dashboardMoney, type DashboardReport, type DashboardQuery } from "../../../lib/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { AgencySales } from "./agency-sales";

export function DashboardHeader({ month, scope }: { month: string; scope?: string }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />ภาพรวมธุรกิจ</h1><p className="mt-1 text-sm text-muted-foreground">สรุปรายเดือน{scope ? ` · ${scope}` : ""}</p></div>
    <form action="/admin/dashboard" method="get" className="flex flex-wrap items-end gap-2"><label htmlFor="dashboard-month" className="grid gap-1 text-sm">เดือน<Input id="dashboard-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} key={month} required /></label><Button type="submit">ดูข้อมูล</Button></form>
  </div>;
}

function reportHref(query: DashboardQuery, changes: Record<string, string>, anchor = "bookings") {
  return `/admin/dashboard?${new URLSearchParams({ month: query.month, status: query.status, search: query.search, agency: query.agency, page: String(query.page), housesPage: String(query.housesPage), ...changes })}#${anchor}`;
}

function PageLinks({ page, pages, total, target, query }: { page: number; pages: number; total: number; target: "page" | "housesPage"; query: DashboardQuery }) {
  const href = (next: number) => reportHref(query, { [target]: String(next) }, target === "page" ? "bookings" : "new-houses");
  return <nav aria-label={target === "page" ? "หน้ารายการจอง" : "หน้าบ้านเพิ่มใหม่"} className="flex flex-wrap items-center justify-between gap-2 pt-4"><p className="text-xs text-muted-foreground">{total.toLocaleString("th-TH")} รายการ · หน้า {page} / {pages}</p><div className="flex gap-2">{page > 1 && <Button asChild size="sm" variant="outline"><Link href={href(page - 1)}>ก่อนหน้า</Link></Button>}{page < pages && <Button asChild size="sm" variant="outline"><Link href={href(page + 1)}>ถัดไป</Link></Button>}</div></nav>;
}

export function DashboardView({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const actualQuery = { ...query, agency: report.admin ? query.agency : "", page: report.bookings.page, housesPage: report.admin?.houses.page ?? 1 };
  const agency = report.admin?.agencies.rows.find(row => (row.id ?? "unassigned") === query.agency);
  return <div className="mx-auto max-w-7xl space-y-5">
    <DashboardHeader month={report.month} scope={report.scope.kind === "admin" ? "ทุกบ้าน" : `บ้าน DV-${report.scope.propertyId}`} />
    <p className="text-xs text-muted-foreground">ตามวันที่สร้างรายการ · เวลาประเทศไทย · แสดงสถานะปัจจุบัน</p>
    <Card><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">ยอดขายจากการจอง</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums">{dashboardMoney(report.sales.amountCents)}</p><p className="mt-1 text-xs text-muted-foreground">เฉพาะติดจอง {report.sales.count.toLocaleString("th-TH")} รายการ</p></div><div className="border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5"><p className="text-sm text-muted-foreground">การจองทุกสถานะ</p><p className="mt-1 text-3xl font-semibold tabular-nums">{report.bookingCount.toLocaleString("th-TH")} <span className="text-sm font-normal">รายการ</span></p><p className="mt-1 text-xs text-muted-foreground">รวมรอโอน ยกเลิก และปิดซ่อม</p></div></CardContent></Card>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1">วิธีคำนวณยอดขาย</summary><p className="mt-2">รวมค่าบ้านเต็มจำนวนต่อการจองเฉพาะสถานะติดจอง ไม่รวมค่าใช้จ่ายเพิ่ม วันที่เข้าพักอาจอยู่คนละเดือนกับวันที่สร้างรายการ และยอดย้อนหลังอาจเปลี่ยนเมื่อสถานะเปลี่ยน</p></details>
    {report.sales.missingPrices > 0 && <Alert role="status"><AlertTitle>มูลค่าการจองยังไม่ครบ</AlertTitle><AlertDescription>มีรายการติดจอง {report.sales.missingPrices} รายการที่ยังไม่มีค่าบ้านเต็มจำนวน จึงนับจำนวนแต่ไม่นำยอดเงินมารวม</AlertDescription></Alert>}
    {report.admin && <AgencySales key={report.month} agencies={report.admin.agencies.rows} sales={report.sales} month={report.month} />}
    <Card id="bookings" className="scroll-mt-4"><CardHeader><CardTitle><h2>ข้อมูลการจอง</h2></CardTitle><CardDescription>เลือกสถานะเพื่อดูรายการ · กดรายการเพื่อดูรายละเอียด</CardDescription></CardHeader><CardContent>
      <nav aria-label="กรองสถานะการจอง" className="mb-4 flex flex-wrap gap-2">{[{ value: "all", label: "ทั้งหมด", count: report.bookingCount }, ...DASHBOARD_STATUSES.map(item => ({ ...item, count: report.statusCounts[item.value] }))].map(item => <Button key={item.value} asChild size="sm" variant={query.status === item.value ? "default" : "outline"}><Link aria-current={query.status === item.value ? "page" : undefined} href={reportHref(actualQuery, { status: item.value, page: "1" })}>{item.label} {item.count.toLocaleString("th-TH")}</Link></Button>)}</nav>
      {actualQuery.agency && <p className="mb-3 text-sm">เอเจนซี่: {agency?.name ?? "ไม่พบเอเจนซี่"} <Link className="underline" href={reportHref(actualQuery, { agency: "", page: "1" })}>ล้างตัวกรองเอเจนซี่</Link></p>}
      <details key={`${query.status}:${query.search}:${actualQuery.agency}:${report.bookings.page}`} open={query.status !== "all" || Boolean(query.search || actualQuery.agency) || report.bookings.page > 1}>
      <summary className="mb-4 cursor-pointer py-2 text-sm font-medium">ดูรายการจอง {report.bookings.total.toLocaleString("th-TH")} รายการ</summary>
      <form action="/admin/dashboard#bookings" className="mb-4 flex gap-2"><input type="hidden" name="month" value={query.month} /><input type="hidden" name="status" value={query.status} /><input type="hidden" name="agency" value={actualQuery.agency} /><Input name="search" aria-label="ค้นหาการจอง" placeholder="ชื่อบ้าน เลข DV หรือรหัสจอง" defaultValue={query.search} key={query.search} maxLength={200} /><Button type="submit" variant="outline">ค้นหา</Button></form>
      {report.bookings.rows.length === 0 ? <p className="py-6 text-center text-muted-foreground">ไม่พบการจองตามตัวกรอง</p> : <div className="divide-y">{report.bookings.rows.map(row => <details key={row.id} className="group py-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-sm focus-visible:outline-2 [&::-webkit-details-marker]:hidden"><div className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><p className="break-words font-medium">{row.houseTitle}</p><p className="mt-1 text-xs text-muted-foreground">{dashboardDate(row.checkIn)} – {dashboardDate(row.checkOut)}</p></div><div className="flex w-full items-center justify-between gap-3 sm:w-auto"><Badge variant={row.status === "confirmed" ? "default" : "secondary"}>{DASHBOARD_STATUSES.find(status => status.value === dashboardStatus(row.status))?.label}</Badge><span className="text-sm tabular-nums">{row.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(row.priceCents)}</span><ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" /></div></summary>
        <dl className="mt-3 grid gap-3 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">รหัสการจอง</dt><dd className="break-all">{row.code}</dd></div><div><dt className="text-xs text-muted-foreground">เลขบ้าน</dt><dd>DV-{row.propertyId}</dd></div><div><dt className="text-xs text-muted-foreground">วันที่สร้าง</dt><dd>{dashboardDate(row.createdAt, true)}</dd></div></dl>
      </details>)}</div>}
      <PageLinks {...report.bookings} target="page" query={actualQuery} />
      </details>
    </CardContent></Card>
    {report.admin && <Card id="new-houses" className="scroll-mt-4"><CardHeader><CardTitle><h2>บ้านที่เพิ่มใหม่ <Badge variant="secondary">{report.admin.houses.total.toLocaleString("th-TH")} หลัง</Badge></h2></CardTitle><CardDescription>ประวัติบ้านที่เพิ่มในเดือนที่เลือก รวมบ้านที่ปิดใช้งาน</CardDescription></CardHeader><CardContent>
      <details key={report.admin.houses.page} open={report.admin.houses.page > 1}><summary className="cursor-pointer py-2 text-sm font-medium">ดูประวัติการเพิ่มบ้าน</summary>
      {report.admin.houses.rows.length === 0 ? <p className="py-6 text-center text-muted-foreground">ไม่มีบ้านเพิ่มใหม่ในเดือนนี้</p> : <div className="divide-y">{report.admin.houses.rows.map(row => <details key={row.id} className="py-3"><summary className="cursor-pointer break-words"><span className="font-medium">{row.title}</span><span className="mt-1 block text-xs text-muted-foreground">{row.propertyId ? `DV-${row.propertyId}` : "ยังไม่ระบุเลขบ้าน"} · เพิ่ม {dashboardDate(row.createdAt)}</span></summary><div className="mt-3 text-sm"><p>เพิ่มเข้าระบบ {dashboardDate(row.createdAt, true)}</p>{row.propertyId && <Link className="mt-2 inline-block underline" href={`/admin/houses/${encodeURIComponent(row.propertyId)}`}>เปิดข้อมูลบ้าน</Link>}</div></details>)}</div>}
      <PageLinks {...report.admin.houses} target="housesPage" query={actualQuery} />
      </details>
    </CardContent></Card>}
  </div>;
}
