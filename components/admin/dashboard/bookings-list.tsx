import { type DashboardBookingsQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardBookingDetailHref, dashboardBookingsHref } from "../../../lib/dashboard-routes";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardBookingRow, DashboardBookingTableRow } from "./dashboard-rows";
import { DashboardPager } from "./dashboard-list-primitives";
import { DashboardBookingFilters } from "./dashboard-booking-filters";

export function BookingsList({ report, query }: { report: DashboardReport; query: DashboardBookingsQuery }) {
  const showAgency = report.scope.kind === "admin";
  return <section>
      <DashboardBookingFilters query={query} />
      {report.bookings.total === 0 ? <div className="overflow-hidden rounded-xl border"><p role="status" className="py-12 text-center text-sm text-muted-foreground">{report.bookingCount === 0 ? "ไม่มีการจองในเดือนนี้" : "ไม่พบการจองที่ตรงกับตัวกรอง"}</p></div> : <>
        <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead className={showAgency ? "w-[26%]" : "w-[34%]"}>บ้าน / DV</TableHead><TableHead className={showAgency ? "w-[21%]" : "w-[27%]"}>วันเข้าพัก</TableHead><TableHead className="w-[17%]">สถานะการจอง</TableHead>{showAgency && <TableHead className="w-[20%]">เอเจนซี่</TableHead>}<TableHead className="w-[16%] text-right">ยอดจอง</TableHead></TableRow></TableHeader><TableBody>{report.bookings.rows.map(row => <DashboardBookingTableRow key={row.id} booking={row} showAgency={showAgency} href={dashboardBookingDetailHref(query, row.id)} />)}</TableBody></Table></div>
        <div className="space-y-3 md:hidden">{report.bookings.rows.map(row => <DashboardBookingRow key={row.id} booking={row} presentation="card" showAgency={showAgency} href={dashboardBookingDetailHref(query, row.id)} />)}</div>
      </>}
      <div className="mt-4"><DashboardPager {...report.bookings} pageSize={9} href={page => dashboardBookingsHref(query, { page })} /></div>
  </section>;
}
