import Link from "next/link";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { dashboardBackHref } from "../../../lib/dashboard-navigation";
import { dashboardAgencyDetailHref, dashboardBookingDetailHref, dashboardHouseDetailHref, type DashboardAgencyDetailQuery } from "../../../lib/dashboard-routes";
import { DASHBOARD_AGENCY_SORTS, DASHBOARD_STATUSES, dashboardDate, dashboardMoney, dashboardStatus, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardNights } from "../../../lib/dashboard-calculations";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardBookingRow, DashboardBookingTableRow } from "./dashboard-rows";
import { DashboardMonthFilter, DashboardPager, DashboardSearchFilter } from "./dashboard-list-primitives";
import { DashboardTaskHeader } from "./dashboard-task-header";

interface DashboardDetailsProps {
  backHref?: string;
  backLabel?: string;
  agencyQuery?: DashboardAgencyDetailQuery;
  query: DashboardQuery;
  report: DashboardReport;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`min-w-0 ${className ?? ""}`}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium [overflow-wrap:anywhere]">{children}</dd></div>;
}

export function DashboardDetails({
  backHref,
  backLabel = "กลับไปหน้าก่อนหน้า",
  agencyQuery,
  query,
  report,
}: DashboardDetailsProps) {
  const detail = report.detail;
  if (!detail) return null;

  const resolvedBackHref = backHref ?? dashboardBackHref(query);

  if (detail.kind === "booking") {
    const booking = detail.booking;
    const status = dashboardStatus(booking.status);
    return <div className="space-y-4">
      <DashboardTaskHeader backHref={resolvedBackHref} backLabel={backLabel} description={`${booking.houseTitle} · DV-${booking.propertyId}`} title="รายละเอียดการจอง" />
      <Card><CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-5 lg:grid-cols-3">
          <Field className="col-span-2" label="รหัสจอง">{booking.code}</Field>
          <Field label="สถานะปัจจุบัน">{DASHBOARD_STATUSES.find(item => item.value === status)?.label}</Field>
          <Field label="เข้าพัก">{dashboardDate(booking.checkIn)}</Field><Field label="เช็กเอาต์">{dashboardDate(booking.checkOut)}</Field>
          <Field label="จำนวนคืน">{dashboardNights(booking.checkIn, booking.checkOut) ?? "—"}</Field>
          <Field label="ยอดจอง">{status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents)}</Field>
          <Field label="วันที่สร้าง">{dashboardDate(booking.createdAt, true)}</Field>
          {detail.agency && <Field label="เอเจนซี่">{detail.agency.name}</Field>}
        </dl>
      </CardContent></Card>
    </div>;
  }

  if (detail.kind === "agency") {
    const agencyListQuery = agencyQuery ?? { month: query.month, search: query.agencySearch, page: query.agenciesPage, bookingSearch: "", bookingsPage: 1, sort: "date-asc" as const };
    const agencyId = detail.agency.id ?? "unassigned";
    return <div className="space-y-4">
      <DashboardTaskHeader backHref={resolvedBackHref} backLabel={backLabel} description="รายละเอียดเอเจนซี่" title={detail.agency.name} />
      <Card><CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 sm:gap-5"><Field label="ยอดขาย">{dashboardMoney(detail.agency.amountCents)}</Field><Field label="จำนวนการจอง">{detail.agency.count} รายการ</Field><Field label="สัดส่วนยอดขาย">{detail.sharePercent === null ? "—" : `${detail.sharePercent.toFixed(1)}%`}</Field></dl>
        {detail.agency.missingPrices > 0 && <p role="status" className="text-sm text-muted-foreground">การจองติดจอง {detail.agency.missingPrices} รายการยังไม่ระบุยอด</p>}
      </CardContent></Card>
      <section className="space-y-3">
        <h2 className="font-medium">รายการจอง</h2>
        <form action={`/admin/dashboard/agencies/${encodeURIComponent(agencyId)}`} method="get" className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <input type="hidden" name="search" value={agencyListQuery.search} />
          <input type="hidden" name="page" value={agencyListQuery.page} />
          <DashboardSearchFilter ariaLabel="ค้นหาการจองเอเจนซี่" name="bookingSearch" value={agencyListQuery.bookingSearch} placeholder="ค้นหาบ้านพัก..." />
          <DashboardMonthFilter id="agency-detail-month" month={agencyListQuery.month} width="half" />
          <div className="col-span-1 min-w-0 sm:w-48">
            <label className="sr-only" htmlFor="agency-detail-sort">เรียงตาม</label>
            <select id="agency-detail-sort" name="sort" aria-label="เรียงตาม" defaultValue={agencyListQuery.sort} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
              {DASHBOARD_AGENCY_SORTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <Button className="col-span-2 h-11 w-full px-3 sm:col-span-1 sm:w-auto" type="submit"><SearchIcon aria-hidden className="size-4" />ค้นหา</Button>
        </form>
        {detail.bookings.total === 0 ? <p role="status" className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">{agencyListQuery.bookingSearch ? "ไม่พบการจองที่ตรงกับคำค้นหา" : "ไม่มีรายการจองในเดือนนี้"}</p> : <>
            <div className="hidden md:block"><Table className="table-fixed overflow-hidden rounded-xl border"><TableHeader><TableRow><TableHead className="w-[42%]">บ้านพัก</TableHead><TableHead className="w-[38%]">วันเข้าพัก</TableHead><TableHead className="w-[20%] text-right">ยอดจอง</TableHead></TableRow></TableHeader><TableBody>{detail.bookings.rows.map(booking => <DashboardBookingTableRow key={booking.id} booking={booking} showAgency={false} href={dashboardBookingDetailHref({ month: query.month, status: "confirmed", search: "", agency: agencyId, page: 1 }, booking.id)} />)}</TableBody></Table></div>
            <div className="divide-y overflow-hidden rounded-xl border md:hidden">{detail.bookings.rows.map(booking => <DashboardBookingRow key={booking.id} booking={booking} showAgency={false} href={dashboardBookingDetailHref({ month: query.month, status: "confirmed", search: "", agency: agencyId, page: 1 }, booking.id)} />)}</div>
            <DashboardPager {...detail.bookings} href={page => dashboardAgencyDetailHref(agencyListQuery, agencyId, { bookingsPage: page })} />
        </>}
      </section>
    </div>;
  }

  const house = detail.house;
  const propertyType = house.propertyType === "poolvilla" ? "พูลวิลล่า" : house.propertyType === "condo" ? "คอนโด" : house.propertyType ?? "—";
  const time = (value: string | null) => value?.slice(0, 5) ?? "—";
  const returnTo = dashboardHouseDetailHref({ month: query.month, search: query.houseSearch, page: query.housesPage }, house.id);
  const manageParams = new URLSearchParams({ returnTo });
  return <div className="space-y-4">
    <DashboardTaskHeader backHref={resolvedBackHref} backLabel={backLabel} description="รายละเอียดบ้านใหม่" title={house.title} />
    <Card><CardContent className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5 lg:grid-cols-4">
        <Field label="เลขบ้าน">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</Field>
        <Field label="วันที่เพิ่มเข้าระบบ">{dashboardDate(house.createdAt, true)}</Field>
        <Field label="ประเภทบ้าน">{propertyType}</Field>
        <Field label="โซน">{house.locationZone ?? "—"}</Field>
        <Field label="ห้องนอน">{house.bedrooms ?? "—"}</Field>
        <Field label="ห้องน้ำ">{house.bathrooms ?? "—"}</Field>
        <Field label="ผู้เข้าพักสูงสุด">{house.maxGuests === null ? "—" : `${house.maxGuests} คน`}</Field>
        <Field label="สถานะบ้าน">{house.isActive === null ? "ไม่ระบุ" : house.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Field>
        <Field label="เวลาเช็กอิน">{time(house.checkinTime)}</Field>
        <Field label="เวลาเช็กเอาต์">{time(house.checkoutTime)}</Field>
      </dl>
      {house.propertyId && <Button asChild variant="outline" className="min-h-11"><Link href={`/admin/houses/${encodeURIComponent(house.propertyId)}?${manageParams.toString()}`}>จัดการบ้าน</Link></Button>}
    </CardContent></Card>
  </div>;
}
