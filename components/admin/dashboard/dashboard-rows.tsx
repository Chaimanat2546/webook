import Link from "next/link";
import { Building2, CalendarDays, ChevronRight } from "lucide-react";
import { DASHBOARD_STATUSES, dashboardDate, dashboardMoney, dashboardStatus, type DashboardAgency, type DashboardBooking, type DashboardHouse } from "../../../lib/dashboard";
import { Badge } from "../../ui/badge";
import { TableCell, TableRow } from "../../ui/table";

export function DashboardBookingRow({ booking, href, showAgency, presentation = "row" }: { booking: DashboardBooking; href: string; showAgency: boolean; presentation?: "card" | "row" }) {
  const status = dashboardStatus(booking.status);
  const amount = status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents);
  if (presentation === "card") return <Link id={`dashboard-booking-${booking.id}`} data-dashboard-detail-link href={href} className="block rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-2">
    <span className="block min-w-0"><span className="block break-words font-semibold">{booking.houseTitle}</span><span className="mt-0.5 block text-xs text-muted-foreground">DV-{booking.propertyId}</span></span>
    <DashboardBookingStatusBadge className="mt-2" status={status} />
    <span className="mt-3 flex min-w-0 items-start gap-2 text-sm text-muted-foreground"><CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" /><span>{dashboardDate(booking.checkIn)} – {dashboardDate(booking.checkOut)}</span></span>
    {showAgency && <span className="mt-2 flex min-w-0 items-start gap-2 text-sm text-muted-foreground"><Building2 aria-hidden className="mt-0.5 size-4 shrink-0" /><span className="break-words">{booking.agency?.name ?? "ไม่ระบุเอเจนซี่"}</span></span>}
    <span className="mt-3 block rounded-lg bg-primary/10 px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-primary"><span className="sr-only">ยอดจอง </span>{amount}</span>
  </Link>;
  const columns = showAgency ? "md:grid-cols-4" : "md:grid-cols-3";
  return <Link id={`dashboard-booking-${booking.id}`} data-dashboard-detail-link href={href} className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 ${columns}`}>
    <span className="min-w-0"><span className="block break-words font-medium">{booking.houseTitle}</span><span className="mt-0.5 block text-xs text-muted-foreground">DV-{booking.propertyId}</span></span>
    <span className="row-span-2 flex min-w-0 items-center justify-end gap-2 md:row-auto"><Badge className="md:hidden" variant={status === "confirmed" ? "default" : "secondary"}>{status === "repair" ? "ปิดซ่อม" : DASHBOARD_STATUSES.find(item => item.value === status)?.label}</Badge><span className="text-sm tabular-nums"><span className="sr-only">ยอดจอง </span>{amount}</span><ChevronRight aria-hidden className="size-4 text-muted-foreground" /></span>
    <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-sm">{dashboardDate(booking.checkIn)} – {dashboardDate(booking.checkOut)}</span>
    {showAgency && <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-sm"><span className="md:hidden">เอเจนซี่: </span>{booking.agency?.name ?? "ไม่ระบุเอเจนซี่"}</span>}
  </Link>;
}

export function DashboardBookingTableRow({ booking, href, showAgency }: { booking: DashboardBooking; href: string; showAgency: boolean }) {
  const status = dashboardStatus(booking.status);
  const amount = status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents);
  return <TableRow>
    <TableCell className="align-top"><Link id={`dashboard-booking-${booking.id}`} data-dashboard-detail-link href={href} className="block min-w-48 rounded-sm font-medium hover:underline focus-visible:outline-2">{booking.houseTitle}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">DV-{booking.propertyId}</span></Link></TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">{dashboardDate(booking.checkIn)} – {dashboardDate(booking.checkOut)}</TableCell>
    <TableCell><DashboardBookingStatusBadge status={status} /></TableCell>
    {showAgency && <TableCell className="text-muted-foreground">{booking.agency?.name ?? "ไม่ระบุเอเจนซี่"}</TableCell>}
    <TableCell className="whitespace-nowrap text-right tabular-nums">{amount}</TableCell>
  </TableRow>;
}

export function DashboardBookingStatusBadge({ className, status }: { className?: string; status: ReturnType<typeof dashboardStatus> }) {
  const label = DASHBOARD_STATUSES.find(item => item.value === status)?.label ?? "ไม่ทราบสถานะ";
  const colorClass = status === "confirmed" ? "bg-red-700/10 text-red-700 dark:text-red-300" : status === "waiting" ? "bg-green-700/10 text-green-700 dark:text-green-300" : status === "cancelled" ? "bg-destructive/10 text-destructive" : status === "repair" ? "bg-gray-500/10 text-gray-700 dark:text-gray-300" : "bg-slate-300 text-slate-900 dark:bg-slate-300 dark:text-slate-900";
  return <Badge data-dashboard-booking-status className={`${className ?? ""} ${colorClass}`} variant="secondary">{label}</Badge>;
}

export function DashboardAgencyTableRow({ agency, href }: { agency: DashboardAgency; href: string }) {
  return <TableRow>
    <TableCell className="whitespace-normal"><Link id={`dashboard-agency-${agency.id ?? "unassigned"}`} data-dashboard-detail-link href={href} className="block break-words font-medium [overflow-wrap:anywhere] hover:underline focus-visible:outline-2">{agency.name}</Link></TableCell>
    <TableCell className="text-right tabular-nums">{agency.count.toLocaleString("th-TH")}</TableCell>
    <TableCell className="whitespace-nowrap text-right tabular-nums">{dashboardMoney(agency.amountCents)}</TableCell>
  </TableRow>;
}

export function DashboardAgencyRow({ agency, href }: { agency: DashboardAgency; href: string }) {
  return <Link id={`dashboard-agency-${agency.id ?? "unassigned"}`} data-dashboard-detail-link href={href} className="block rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-2">
    <span className="flex min-w-0 items-start justify-between gap-3"><span className="break-words font-semibold [overflow-wrap:anywhere]">{agency.name}</span><ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></span>
    <span className="mt-3 grid grid-cols-2 gap-3 text-sm"><span><span className="block text-xs text-muted-foreground">จำนวนการจองติดจอง</span><span className="mt-1 block font-medium tabular-nums">{agency.count.toLocaleString("th-TH")} รายการ</span></span><span className="text-right"><span className="block text-xs text-muted-foreground">ยอดขาย</span><span className="mt-1 block font-semibold tabular-nums text-primary">{dashboardMoney(agency.amountCents)}</span></span></span>
  </Link>;
}

export function DashboardHouseRow({ house, href }: { house: DashboardHouse; href: string }) {
  return <Link id={`dashboard-house-${house.id}`} data-dashboard-detail-link href={href} className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-1 rounded-lg py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2"><span className="min-w-0"><span className="block break-words font-medium [overflow-wrap:anywhere]">{house.title}</span><span className="block text-xs text-muted-foreground">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</span></span><span className="text-xs text-muted-foreground sm:whitespace-nowrap">{dashboardDate(house.createdAt)}</span></Link>;
}

export function DashboardHouseTableRow({ house, href }: { house: DashboardHouse; href: string }) {
  return <TableRow>
    <TableCell className="align-top whitespace-normal">
      <Link id={`dashboard-house-${house.id}`} data-dashboard-detail-link href={href} className="block min-w-48 break-words rounded-sm font-medium [overflow-wrap:anywhere] hover:underline focus-visible:outline-2">
        {house.title}
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</span>
      </Link>
    </TableCell>
    <TableCell className="whitespace-nowrap text-right text-muted-foreground">{dashboardDate(house.createdAt)}</TableCell>
  </TableRow>;
}

export function DashboardHouseCard({ house, href }: { house: DashboardHouse; href: string }) {
  return <Link id={`dashboard-house-${house.id}`} data-dashboard-detail-link href={href} className="block rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-2">
    <span className="flex min-w-0 items-start justify-between gap-3">
      <span className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{house.title}</span>
      <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    </span>
    <span className="mt-0.5 block text-xs text-muted-foreground">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</span>
    <span className="mt-3 block text-sm text-muted-foreground"><span className="text-xs">วันที่เพิ่ม</span><span className="ml-2">{dashboardDate(house.createdAt)}</span></span>
  </Link>;
}
