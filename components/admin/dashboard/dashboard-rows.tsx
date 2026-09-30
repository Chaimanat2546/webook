import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DASHBOARD_STATUSES, dashboardDate, dashboardMoney, dashboardStatus, type DashboardAgency, type DashboardBooking, type DashboardHouse } from "../../../lib/dashboard";
import { Badge } from "../../ui/badge";

export function DashboardBookingRow({ booking, href }: { booking: DashboardBooking; href: string }) {
  const status = dashboardStatus(booking.status);
  const amount = status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents);
  return <Link id={`dashboard-booking-${booking.id}`} href={href} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2">
    <span className="min-w-0"><span className="block break-words font-medium">{booking.houseTitle}</span><span className="mt-0.5 block text-xs text-muted-foreground">{dashboardDate(booking.checkIn)} – {dashboardDate(booking.checkOut)}</span></span>
    <span className="flex items-center gap-2"><Badge variant={status === "confirmed" ? "default" : "secondary"}>{status === "repair" ? "ปิดซ่อม" : DASHBOARD_STATUSES.find(item => item.value === status)?.label}</Badge><span className="text-sm tabular-nums">{amount}</span><ChevronRight aria-hidden className="size-4 text-muted-foreground" /></span>
  </Link>;
}

export function DashboardAgencyRow({ agency, sharePercent, href }: { agency: DashboardAgency; sharePercent: number | null; href: string }) {
  const share = sharePercent === null ? "—" : `${sharePercent.toFixed(1)}%`;
  return <Link href={href} className="block rounded-lg py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2"><span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{agency.name}</span><span className="shrink-0 tabular-nums">{dashboardMoney(agency.amountCents)}</span></span><span className="mt-1 block text-xs text-muted-foreground">{agency.count.toLocaleString("th-TH")} การจอง · {share} ของยอดขาย</span><span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, sharePercent ?? 0)}%` }} /></span></Link>;
}

export function DashboardHouseRow({ house, href }: { house: DashboardHouse; href: string }) {
  return <Link href={href} className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2"><span className="min-w-0 break-words font-medium">{house.title}<span className="ml-2 text-xs font-normal text-muted-foreground">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</span></span><span className="shrink-0 text-xs text-muted-foreground">{dashboardDate(house.createdAt)}</span></Link>;
}
