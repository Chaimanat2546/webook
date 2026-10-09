import { CalendarDays, House } from 'lucide-react';
import { requireCalendarSourcesAdmin } from '../../../../../server/auth/calendar-sources';
import { requireBookingHouse } from '../../../../../server/services/house-bookings';
import { calendarSourceSummary } from '../../../../../server/services/calendar-sync';
import { HouseTaskHeader } from '../../../../../components/admin/houses/house-task-header';
import { HouseWorkspaceShell } from '../../../../../components/admin/houses/house-workspace-shell';
import { HouseWorkspaceNavItem } from '../../../../../components/admin/houses/house-workspace-nav-item';
import { CalendarSources } from '../../../../../components/admin/houses/calendar-sources';

export default async function CalendarSourcesPage({params}:{params:Promise<{propertyId:string}>}){
  const context=await requireCalendarSourcesAdmin(),{propertyId}=await params;
  const house=await requireBookingHouse(context.repository,propertyId);
  const sources=(await context.calendarRepository.list([house.id])).map(calendarSourceSummary);
  return <main className="flex min-h-0 flex-col gap-4 lg:h-full">
    <HouseTaskHeader backHref="/admin/houses" propertyId={house.property_id} title={house.title} subtitle="เชื่อมปฏิทินภายนอก" />
    <HouseWorkspaceShell sidebarTitle="จัดการบ้าน" contentIcon={<CalendarDays />} contentTitle="แหล่งปฏิทิน iCal"
      sidebar={<nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col">
        <HouseWorkspaceNavItem href={`/admin/houses/${house.property_id}`} icon={<House />} label="ข้อมูลบ้าน" />
        <HouseWorkspaceNavItem href={`/admin/bookings?search=${house.property_id}`} icon={<CalendarDays />} label="ตารางการจอง" />
        <HouseWorkspaceNavItem active href={`/admin/houses/${house.property_id}/calendar-sources`} icon={<CalendarDays />} label="แหล่งปฏิทิน iCal" />
      </nav>}><CalendarSources propertyId={house.property_id} initialSources={sources} /></HouseWorkspaceShell>
  </main>;
}
