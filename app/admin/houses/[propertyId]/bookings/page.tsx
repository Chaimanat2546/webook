import { CalendarDays } from "lucide-react";
import { HouseTaskHeader } from "../../../../../components/admin/houses/house-task-header";
import { HouseWorkspaceShell } from "../../../../../components/admin/houses/house-workspace-shell";
import { HouseDetailSectionNav } from "../../../../../components/admin/houses/house-detail-section-nav";
import { HouseBookingCalendar } from "../../../../../components/admin/houses/bookings/booking-calendar";
import { requireBookingAdmin } from "../../../../../server/auth/bookings";
import { requireAdmin, canUseAccommodation, canViewHousePrices } from "../../../../../server/auth/admin";
import { bookingResult, requireBookingHouse } from "../../../../../server/services/house-bookings";

export default async function HouseBookingsPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { propertyId } = await params;
  const query = await searchParams;
  const returnTo = query.returnTo === "/admin/houses" || query.returnTo?.startsWith("/admin/houses?") ? query.returnTo : "/admin/houses";
  const result = await bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return requireBookingHouse(repository, propertyId);
  });
  if (!result.ok) return <div role="alert" className="rounded-lg border p-6">{result.message}</div>;
  const { adminUser } = await requireAdmin();
  const house = result.data;
  const sections = [
    { key: "details", label: "ข้อมูลบ้าน", enabled: canUseAccommodation(adminUser) },
    { key: "prices", label: "ราคาพื้นฐาน", enabled: canViewHousePrices(adminUser) },
    { key: "facilities", label: "สิ่งอำนวยความสะดวก", enabled: canUseAccommodation(adminUser) },
  ].filter(section => section.enabled);
  return <div className="flex h-[calc(100dvh-2.5rem)] md:h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-3 lg:gap-4 [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:grid-rows-[auto_minmax(0,1fr)] lg:[&>div:last-child]:grid-rows-1">
    <HouseTaskHeader backHref={returnTo} propertyId={house.property_id} title={house.title} subtitle="จัดการการจอง" />
    <HouseWorkspaceShell contentClassName="row-span-2 lg:row-span-1 min-h-0 overflow-hidden p-2 lg:overflow-hidden lg:p-3" contentIcon={<CalendarDays />} contentTitle="ปฏิทินการจอง" contentMeta="กดแถบการจองเพื่อแก้ไข" sidebarTitle="หมวดข้อมูล" sidebar={
      <HouseDetailSectionNav canManageBookings propertyId={house.property_id} returnTo={returnTo} sections={sections} selectedSection="bookings" />
    }>
      <HouseBookingCalendar propertyId={house.property_id} />
    </HouseWorkspaceShell>
  </div>;
}
