import Link from "next/link";
import { DASHBOARD_STATUSES, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardBackHref, dashboardHref } from "../../../lib/dashboard-navigation";
import { dashboardShare } from "../../../lib/dashboard-calculations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../ui/pagination";
import { DashboardAgencyRow, DashboardBookingRow, DashboardHouseRow } from "./dashboard-rows";

function Pager({ page, pages, total, href }: { page: number; pages: number; total: number; href: (next: number) => string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
    <span>{total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} จาก ${total} รายการ` : "0 รายการ"}</span>
    <Pagination className="mx-0 w-auto" aria-label="แบ่งหน้ารายการ"><PaginationContent>
      {page > 1 && <PaginationItem><PaginationPrevious className="min-h-11 min-w-11" text="ก่อนหน้า" aria-label="หน้าก่อนหน้า" href={href(page - 1)} /></PaginationItem>}
      <PaginationItem><span className="px-2" aria-current="page">{page} / {pages}</span></PaginationItem>
      {page < pages && <PaginationItem><PaginationNext className="min-h-11 min-w-11" text="ถัดไป" aria-label="หน้าถัดไป" href={href(page + 1)} /></PaginationItem>}
    </PaginationContent></Pagination>
  </div>;
}

export function DashboardLists({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const bookingView = query.view === "bookings";
  const agencyView = query.view === "agencies";
  const page = bookingView ? report.bookings : agencyView ? report.admin?.agencies : report.admin?.houses;
  if (!page) return null;
  const context = { ...query, ...(bookingView ? { page: page.page } : agencyView ? { agenciesPage: page.page } : { housesPage: page.page }) };
  const title = bookingView ? "ข้อมูลการจอง" : agencyView ? "ยอดขายเอเจนซี่" : "ประวัติบ้านเพิ่มใหม่";
  const searchName = bookingView ? "search" : agencyView ? "agencySearch" : "houseSearch";
  const total = bookingView ? report.bookingCount : agencyView ? report.overview.agencyCount : report.overview.newHouseCount;
  return <div className="space-y-4">
    <Button asChild variant="outline" className="min-h-11"><Link href={dashboardBackHref({ ...query, from: "overview" })}>กลับภาพรวม</Link></Button>
    <Card><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">{agencyView ? "เฉพาะติดจอง · เรียงยอดขายสูงสุดก่อน" : bookingView ? "กดรายการเพื่อดูรายละเอียด · ยอดจองแสดงตามแต่ละรายการ" : "บ้านที่สร้างรายการในเดือนที่เลือก"}</p></CardHeader>
      <CardContent className="space-y-4">
        <form action="/admin/dashboard" method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="month" value={query.month} /><input type="hidden" name="view" value={query.view} />
          <label className="grid min-w-0 flex-[1_1_15rem] gap-1 text-sm">ค้นหา<Input className="min-h-11" aria-label={bookingView ? "ค้นหาการจอง" : agencyView ? "ค้นหาเอเจนซี่" : "ค้นหาบ้าน"} name={searchName} defaultValue={query[searchName]} placeholder={bookingView ? "บ้าน เลข DV หรือรหัสจอง" : agencyView ? "ชื่อเอเจนซี่" : "ชื่อบ้าน หรือเลข DV"} /></label>
          {bookingView && <label className="grid flex-[1_1_9rem] gap-1 text-sm">สถานะ<select name="status" defaultValue={query.status} className="min-h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2"><option value="all">ทุกสถานะ</option>{DASHBOARD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>}
          {bookingView && report.scope.kind === "admin" && <input type="hidden" name="agency" value={query.agency} />}
          <Button type="submit" variant="outline" className="min-h-11">ค้นหา</Button>
        </form>
        {bookingView && report.admin && <div className="flex flex-wrap items-center gap-2 text-sm">
          {query.agency && <><span className="min-w-0 break-words">กรองเอเจนซี่: {report.admin.selectedAgency?.name ?? "เอเจนซี่ที่เลือก"}</span><Button asChild variant="outline" className="min-h-11"><Link href={dashboardHref(query, { agency: "" })}>ล้างเอเจนซี่</Link></Button></>}
          <Button asChild variant="outline" className="min-h-11"><Link href={dashboardHref(query, { view: "agencies", agencySearch: "", agenciesPage: 1 })}>เลือกเอเจนซี่จากยอดขาย</Link></Button>
        </div>}
        {page.total === 0 && <p role="status" className="py-6 text-sm text-muted-foreground">{total === 0 ? bookingView ? "ไม่มีการจองในเดือนนี้" : agencyView ? "ไม่มียอดขายติดจองในเดือนนี้" : "ไม่มีบ้านเพิ่มใหม่ในเดือนนี้" : bookingView ? "ไม่พบการจองที่ตรงกับตัวกรอง" : agencyView ? "ไม่พบเอเจนซี่ที่ตรงกับตัวกรอง" : "ไม่พบบ้านที่ตรงกับตัวกรอง"}</p>}
        <div className="divide-y">
          {bookingView && report.bookings.rows.map(row => <DashboardBookingRow key={row.id} booking={row} href={dashboardHref(context, { view: "booking", from: "bookings", bookingId: row.id })} />)}
          {agencyView && report.admin?.agencies.rows.map(row => <DashboardAgencyRow key={row.id ?? "unassigned"} agency={row} sharePercent={dashboardShare(row.amountCents, report.sales.amountCents)} href={dashboardHref(context, { view: "agency", from: "agencies", agency: row.id ?? "unassigned" })} />)}
          {query.view === "houses" && report.admin?.houses.rows.map(row => <DashboardHouseRow key={row.id} house={row} href={dashboardHref(context, { view: "house", from: "houses", houseId: row.id })} />)}
        </div>
        <Pager {...page} href={next => dashboardHref(context, bookingView ? { page: next } : agencyView ? { agenciesPage: next } : { housesPage: next })} />
      </CardContent>
    </Card>
  </div>;
}
