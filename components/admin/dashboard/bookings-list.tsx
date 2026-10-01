import Link from "next/link";
import { ChevronDownIcon, SearchIcon, TagIcon } from "lucide-react";
import { DASHBOARD_STATUSES, type DashboardBookingsQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardBookingDetailHref, dashboardBookingsHref } from "../../../lib/dashboard-routes";
import { Button } from "../../ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardBookingRow, DashboardBookingTableRow } from "./dashboard-rows";
import { DashboardMonthFilter, DashboardPager, DashboardSearchFilter } from "./dashboard-list-primitives";

export function BookingsList({ report, query }: { report: DashboardReport; query: DashboardBookingsQuery }) {
  const showAgency = report.scope.kind === "admin";
  return <section>
      <form action="/admin/dashboard/bookings" method="get" className="mb-3 grid min-w-0 grid-cols-2 gap-2 sm:mb-4 sm:flex sm:flex-wrap">
        <DashboardSearchFilter ariaLabel="ค้นหาการจอง" name="search" value={query.search} placeholder="ค้นหาบ้านพัก..." />
        <DashboardMonthFilter id="booking-month" month={query.month} width="half" />
        <div className="relative min-w-0">
          <label className="sr-only" htmlFor="booking-status">สถานะ</label>
          <TagIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select id="booking-status" name="status" defaultValue={query.status} className="h-11 min-w-0 w-full appearance-none rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus-visible:outline-2 sm:min-w-32 sm:w-auto"><option value="all">ทุกสถานะ</option>{DASHBOARD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {showAgency && <input type="hidden" name="agency" value={query.agency} />}
        <Button className="col-span-2 h-11 w-full px-3 sm:col-span-1 sm:w-auto" type="submit"><SearchIcon aria-hidden className="size-4" />ค้นหา</Button>
      </form>
      {showAgency && query.agency && <p className="mb-4 text-sm text-muted-foreground">เอเจนซี่: {report.admin?.selectedAgency?.name ?? "เอเจนซี่ที่เลือก"} · <Link className="underline underline-offset-4" href={dashboardBookingsHref(query, { agency: "" })}>ล้างตัวกรอง</Link></p>}
      <div className="overflow-hidden rounded-xl border">
        {report.bookings.total === 0 ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">{report.bookingCount === 0 ? "ไม่มีการจองในเดือนนี้" : "ไม่พบการจองที่ตรงกับตัวกรอง"}</p> : <>
          <div className="hidden md:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[35%]">บ้าน / DV</TableHead><TableHead className="w-[24%]">วันเข้าพัก</TableHead>{showAgency && <TableHead className="w-[25%]">เอเจนซี่</TableHead>}<TableHead className="w-[16%] text-right">ยอดจอง</TableHead></TableRow></TableHeader><TableBody>{report.bookings.rows.map(row => <DashboardBookingTableRow key={row.id} booking={row} showAgency={showAgency} href={dashboardBookingDetailHref(query, row.id)} />)}</TableBody></Table></div>
          <div className="divide-y md:hidden">{report.bookings.rows.map(row => <DashboardBookingRow key={row.id} booking={row} showAgency={showAgency} href={dashboardBookingDetailHref(query, row.id)} />)}</div>
        </>}
      </div>
      <div className="mt-4"><DashboardPager {...report.bookings} href={page => dashboardBookingsHref(query, { page })} /></div>
  </section>;
}
