import Link from "next/link";
import { CalendarDays, HousePlus, LayoutDashboard, Wallet, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { dashboardDate, dashboardMoney, type DashboardReport, type DashboardQuery } from "../../../lib/dashboard";
import { BOOKING_STATUSES } from "../../../lib/house-bookings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

export function DashboardHeader({ month, scope }: { month: string; scope?: string }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard aria-hidden className="size-6" />Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">ภาพรวมรายเดือน{scope ? ` · ${scope}` : ""}</p></div>
    <form action="/admin/dashboard" method="get" className="flex flex-wrap items-end gap-2">
      <label htmlFor="dashboard-month" className="grid gap-1 text-sm">เดือนที่สร้างรายการ<Input id="dashboard-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} key={month} required /></label>
      <Button type="submit">ดูข้อมูล</Button>
    </form>
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: ReactNode }) {
  return <Card><CardHeader><CardDescription className="flex items-center gap-2">{icon}{label}</CardDescription>
    <CardTitle className="break-words text-2xl tabular-nums">{value}</CardTitle></CardHeader>
    <CardContent className="text-xs text-muted-foreground">{detail}</CardContent></Card>;
}

function PageLinks({ page, pages, total, target, query }: { page: number; pages: number; total: number; target: "page" | "housesPage"; query: DashboardQuery }) {
  function href(next: number) {
    return `/admin/dashboard?${new URLSearchParams({ month: query.month, page: String(query.page), housesPage: String(query.housesPage), [target]: String(next) })}#${target === "page" ? "bookings" : "new-houses"}`;
  }
  return <nav aria-label={target === "page" ? "หน้ารายการจอง" : "หน้าบ้านเพิ่มใหม่"} className="flex flex-wrap items-center justify-between gap-2 pt-4">
    <p className="text-xs text-muted-foreground">{total.toLocaleString("th-TH")} รายการ · หน้า {page} / {pages}</p>
    <div className="flex gap-2">{page > 1 && <Button asChild size="sm" variant="outline"><Link href={href(page - 1)}>ก่อนหน้า</Link></Button>}
      {page < pages && <Button asChild size="sm" variant="outline"><Link href={href(page + 1)}>ถัดไป</Link></Button>}</div>
  </nav>;
}

export function DashboardView({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const actualQuery = { ...query, page: report.bookings.page, housesPage: report.admin?.houses.page ?? 1 };
  return <div className="mx-auto max-w-7xl space-y-6">
    <DashboardHeader month={report.month} scope={report.scope.kind === "admin" ? "ทุกบ้าน" : `บ้าน DV-${report.scope.propertyId}`} />
    <p className="text-sm text-muted-foreground">อิงวันที่สร้างรายการตามเวลาประเทศไทย ยอดขายนับเฉพาะสถานะติดจอง ใช้ค่าบ้านเต็มจำนวน ไม่รวมค่าใช้จ่ายเพิ่มและไม่ใช่ยอดรับชำระ</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="การจองทั้งหมด" value={report.bookingCount.toLocaleString("th-TH")} detail="รวมรายการยกเลิก · ไม่รวมปิดซ่อม" icon={<CalendarDays aria-hidden className="size-4" />} />
      <Metric label="ติดจอง" value={report.sales.count.toLocaleString("th-TH")} detail="จำนวนการจองที่ยืนยันแล้ว" icon={<CalendarDays aria-hidden className="size-4" />} />
      <Metric label="รอโอน" value={report.waitingCount.toLocaleString("th-TH")} detail="จำนวนการจองที่รอชำระเงิน" icon={<Clock aria-hidden className="size-4" />} />
      <Metric label="ยอดขายติดจอง" value={dashboardMoney(report.sales.amountCents)} detail="รวมค่าบ้านเต็มจำนวนของรายการติดจอง" icon={<Wallet aria-hidden className="size-4" />} />
    </div>
    {report.sales.missingPrices > 0 && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">มีรายการติดจอง {report.sales.missingPrices} รายการที่ยังไม่มีค่าบ้านเต็มจำนวน จึงนับจำนวนแต่ไม่นำยอดเงินมารวม</p>}
    <Card id="bookings"><CardHeader><CardTitle><h2>ข้อมูลการจอง</h2></CardTitle><CardDescription>รายการที่สร้างในเดือนที่เลือก แสดงสถานะปัจจุบัน</CardDescription></CardHeader><CardContent>
      {report.bookings.rows.length === 0 ? <p className="py-8 text-center text-muted-foreground">ไม่มีรายการจองในเดือนนี้</p> : <Table>
        <TableHeader><TableRow><TableHead>รหัส / วันที่สร้าง</TableHead><TableHead>บ้าน</TableHead><TableHead>เข้าพัก – เช็กเอาต์</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">ค่าบ้านเต็มจำนวน</TableHead></TableRow></TableHeader>
        <TableBody>{report.bookings.rows.map(row => <TableRow key={row.id}>
          <TableCell><p className="font-medium">{row.code}</p><p className="text-xs text-muted-foreground">{dashboardDate(row.createdAt)}</p></TableCell>
          <TableCell><p className="max-w-56 truncate" title={row.houseTitle}>{row.houseTitle}</p><p className="text-xs text-muted-foreground">DV-{row.propertyId}</p></TableCell>
          <TableCell>{dashboardDate(row.checkIn)} – {dashboardDate(row.checkOut)}</TableCell>
          <TableCell><Badge variant={row.status === "confirmed" ? "default" : "secondary"}>{BOOKING_STATUSES.find(status => status.value === row.status)?.label ?? "ไม่ทราบสถานะ"}</Badge></TableCell>
          <TableCell className="text-right tabular-nums">{row.priceCents === null ? "ไม่ระบุ" : dashboardMoney(row.priceCents)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>}
      <PageLinks {...report.bookings} target="page" query={actualQuery} />
    </CardContent></Card>
    {report.admin && <>
      <Card><CardHeader><CardTitle><h2>ยอดขายเอเจนซี่</h2></CardTitle><CardDescription>เฉพาะติดจอง · เรียงตามยอดขาย · รวมเอเจนซี่ที่ปิดใช้งานหากมีรายการขาย</CardDescription></CardHeader><CardContent>
        {report.admin.agencies.length === 0 ? <p className="py-8 text-center text-muted-foreground">ไม่มียอดขายติดจองในเดือนนี้</p> : <Table>
          <TableHeader><TableRow><TableHead>เอเจนซี่</TableHead><TableHead className="text-right">จำนวนการจอง</TableHead><TableHead className="text-right">ยอดขาย</TableHead></TableRow></TableHeader>
          <TableBody>{report.admin.agencies.map(row => <TableRow key={row.id ?? "unassigned"}><TableCell>{row.name}{row.missingPrices > 0 && <p className="text-xs text-muted-foreground">ยังไม่ระบุราคา {row.missingPrices} รายการ</p>}</TableCell><TableCell className="text-right tabular-nums">{row.count.toLocaleString("th-TH")}</TableCell><TableCell className="text-right tabular-nums">{dashboardMoney(row.amountCents)}</TableCell></TableRow>)}
            <TableRow className="font-semibold"><TableCell>รวมทั้งหมด (รวมไม่ระบุเอเจนซี่)</TableCell><TableCell className="text-right">{report.sales.count.toLocaleString("th-TH")}</TableCell><TableCell className="text-right">{dashboardMoney(report.sales.amountCents)}</TableCell></TableRow>
          </TableBody>
        </Table>}
      </CardContent></Card>
      <Card id="new-houses"><CardHeader><CardTitle><h2 className="flex items-center gap-2"><HousePlus aria-hidden className="size-5" />บ้านที่เพิ่มใหม่ <Badge variant="secondary">{report.admin.houses.total.toLocaleString("th-TH")} หลัง</Badge></h2></CardTitle><CardDescription>อิงวันที่เพิ่มบ้านเข้าระบบในเดือนที่เลือก รวมบ้านที่ปิดใช้งาน</CardDescription></CardHeader><CardContent>
        {report.admin.houses.rows.length === 0 ? <p className="py-8 text-center text-muted-foreground">ไม่มีบ้านเพิ่มใหม่ในเดือนนี้</p> : <Table>
          <TableHeader><TableRow><TableHead>เลขบ้าน</TableHead><TableHead>ชื่อบ้าน</TableHead><TableHead>วันที่เพิ่ม</TableHead></TableRow></TableHeader>
          <TableBody>{report.admin.houses.rows.map(row => <TableRow key={row.id}><TableCell>{row.propertyId ? `DV-${row.propertyId}` : "ยังไม่ระบุเลขบ้าน"}</TableCell><TableCell className="max-w-64 whitespace-normal">{row.title}</TableCell><TableCell>{dashboardDate(row.createdAt, true)}</TableCell></TableRow>)}</TableBody>
        </Table>}
        <PageLinks {...report.admin.houses} target="housesPage" query={actualQuery} />
      </CardContent></Card>
    </>}
  </div>;
}
