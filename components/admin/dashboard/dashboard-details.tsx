import Link from "next/link";
import type { ReactNode } from "react";
import { dashboardBackHref, dashboardHref } from "../../../lib/dashboard-navigation";
import { DASHBOARD_STATUSES, dashboardDate, dashboardMoney, dashboardStatus, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardNights } from "../../../lib/dashboard-calculations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { DashboardBackLink } from "./dashboard-back-link";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium [overflow-wrap:anywhere]">{children}</dd></div>;
}

export function DashboardDetails({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const detail = report.detail;
  if (!detail) return null;
  const back = <DashboardBackLink href={dashboardBackHref(query)} label="กลับ" />;
  if (detail.kind === "booking") {
    const b = detail.booking;
    const status = dashboardStatus(b.status);
    return <div className="space-y-4">{back}<Card><CardHeader><CardTitle>รายละเอียดการจอง</CardTitle></CardHeader><CardContent>
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="รหัสจอง">{b.code}</Field><Field label="บ้าน">{b.houseTitle} · DV-{b.propertyId}</Field>
        <Field label="สถานะปัจจุบัน">{DASHBOARD_STATUSES.find(item => item.value === status)?.label}</Field>
        <Field label="เข้าพัก">{dashboardDate(b.checkIn)}</Field><Field label="เช็กเอาต์">{dashboardDate(b.checkOut)}</Field>
        <Field label="จำนวนคืน">{dashboardNights(b.checkIn, b.checkOut) ?? "—"}</Field>
        <Field label="ยอดจอง">{status === "repair" ? "—" : b.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(b.priceCents)}</Field>
        <Field label="วันที่สร้าง">{dashboardDate(b.createdAt, true)}</Field>
        {detail.agency && <Field label="เอเจนซี่">{detail.agency.name}</Field>}
      </dl>
    </CardContent></Card></div>;
  }
  if (detail.kind === "agency") return <div className="space-y-4">{back}<Card><CardHeader><CardTitle className="break-words">{detail.agency.name}</CardTitle></CardHeader><CardContent className="space-y-6">
    <dl className="grid gap-5 sm:grid-cols-3"><Field label="ยอดขาย">{dashboardMoney(detail.agency.amountCents)}</Field><Field label="การจองติดจอง">{detail.agency.count} รายการ</Field><Field label="สัดส่วนยอดขาย">{detail.sharePercent === null ? "—" : `${detail.sharePercent.toFixed(1)}%`}</Field></dl>
    {detail.agency.missingPrices > 0 && <p role="status" className="text-sm text-muted-foreground">การจองติดจอง {detail.agency.missingPrices} รายการยังไม่ระบุยอด</p>}
    <section className="border-t pt-5"><h2 className="font-medium">บ้านที่สร้างยอดขายสูงสุด · รวม {detail.houseCount} หลัง</h2><ul className="mt-2 divide-y">{detail.topHouses.map(house => <li className="flex flex-wrap justify-between gap-2 py-3" key={house.propertyId}><span className="min-w-0 break-words [overflow-wrap:anywhere]">{house.houseTitle} · DV-{house.propertyId}<span className="block text-sm text-muted-foreground">{house.count} การจอง</span></span><span className="tabular-nums">{dashboardMoney(house.amountCents)}</span></li>)}</ul></section>
    <Button asChild className="min-h-11 h-auto whitespace-normal"><Link href={dashboardHref(query, { view: "bookings", from: "overview", status: "confirmed", agency: detail.agency.id ?? "unassigned", search: "", page: 1 })}>ดูการจองทั้งหมด {detail.agency.count} รายการ</Link></Button>
  </CardContent></Card></div>;
  return <div className="space-y-4">{back}<Card><CardHeader><CardTitle className="break-words">{detail.house.title}</CardTitle></CardHeader><CardContent className="space-y-6">
    <dl className="grid gap-5 sm:grid-cols-2"><Field label="เลขบ้าน">{detail.house.propertyId ? `DV-${detail.house.propertyId}` : "ยังไม่ระบุ DV"}</Field><Field label="วันที่เพิ่มเข้าระบบ">{dashboardDate(detail.house.createdAt, true)}</Field></dl>
    {detail.house.propertyId && <Button asChild variant="outline" className="min-h-11"><Link href={`/admin/houses/${encodeURIComponent(detail.house.propertyId)}`}>จัดการบ้าน</Link></Button>}
  </CardContent></Card></div>;
}
