import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DASHBOARD_STATUSES, dashboardDate, dashboardMoney, dashboardStatus, type DashboardAgency, type DashboardBooking, type DashboardHouse } from "../../../lib/dashboard";
import { Badge } from "../../ui/badge";
import { TableCell, TableRow } from "../../ui/table";

export function DashboardBookingRow({ booking, href, showAgency }: { booking: DashboardBooking; href: string; showAgency: boolean }) {
  const status = dashboardStatus(booking.status);
  const amount = status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents);
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
    {showAgency && <TableCell className="text-muted-foreground">{booking.agency?.name ?? "ไม่ระบุเอเจนซี่"}</TableCell>}
    <TableCell className="whitespace-nowrap text-right tabular-nums">{amount}</TableCell>
  </TableRow>;
}

export function DashboardAgencyTableRow({ agency, href }: { agency: DashboardAgency; href: string }) {
  return <TableRow>
    <TableCell className="whitespace-normal"><Link id={`dashboard-agency-${agency.id ?? "unassigned"}`} data-dashboard-detail-link href={href} className="block break-words font-medium [overflow-wrap:anywhere] hover:underline focus-visible:outline-2">{agency.name}</Link></TableCell>
    <TableCell className="text-right tabular-nums">{agency.count.toLocaleString("th-TH")}</TableCell>
    <TableCell className="whitespace-nowrap text-right tabular-nums">{dashboardMoney(agency.amountCents)}</TableCell>
  </TableRow>;
}

export function DashboardHouseRow({ house, href }: { house: DashboardHouse; href: string }) {
  return <Link id={`dashboard-house-${house.id}`} data-dashboard-detail-link href={href} className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-1 rounded-lg py-2 transition-colors hover:bg-muted/60 focus-visible:outline-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2"><span className="min-w-0"><span className="block break-words font-medium [overflow-wrap:anywhere]">{house.title}</span><span className="block text-xs text-muted-foreground">{house.propertyId ? `DV-${house.propertyId}` : "ยังไม่ระบุ DV"}</span></span><span className="text-xs text-muted-foreground sm:whitespace-nowrap">{dashboardDate(house.createdAt)}</span></Link>;
}
