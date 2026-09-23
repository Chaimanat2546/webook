import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HouseWorkspaceShell } from "@/components/admin/houses/house-workspace-shell";
import { BookingCalendarSkeleton } from "@/components/admin/houses/bookings/booking-skeletons";

export default function Loading() {
  return <div aria-busy="true" className="flex h-[calc(100dvh-2.5rem)] min-h-0 flex-col gap-3 md:h-[calc(100dvh-6.5rem)] lg:gap-4 [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:grid-rows-[auto_minmax(0,1fr)] lg:[&>div:last-child]:grid-rows-1">
    <div aria-hidden="true" className="space-y-2"><Skeleton className="h-4 w-24 motion-reduce:animate-none" /><Skeleton className="h-7 w-56 motion-reduce:animate-none" /><Skeleton className="h-4 w-32 motion-reduce:animate-none" /></div>
    <HouseWorkspaceShell contentIcon={<CalendarDays />} contentTitle="ปฏิทินการจอง" sidebarTitle="หมวดข้อมูล" contentClassName="row-span-2 min-h-0 overflow-hidden p-2 lg:row-span-1 lg:overflow-hidden lg:p-3" sidebar={<div aria-hidden="true" className="flex gap-3 p-3 lg:flex-col">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 w-20 shrink-0 motion-reduce:animate-none lg:w-full" />)}</div>}>
      <BookingCalendarSkeleton />
    </HouseWorkspaceShell>
  </div>;
}
