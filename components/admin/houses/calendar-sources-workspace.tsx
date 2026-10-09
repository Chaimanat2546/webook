import { CalendarDays } from 'lucide-react';
import { requireCalendarSourcesAdmin } from '@/server/auth/calendar-sources';
import { requireBookingHouse } from '@/server/services/house-bookings';
import { calendarSourceSummary } from '@/server/services/calendar-sync';
import { HouseTaskHeader } from './house-task-header';
import { HouseWorkspaceShell } from './house-workspace-shell';
import { HouseDetailSectionNav } from './house-detail-section-nav';
import { CalendarSources } from './calendar-sources';

interface Props {
  propertyId: string;
  returnTo: string | null;
  sections: readonly {key:string;label:string}[];
}

export async function CalendarSourcesWorkspace({propertyId,returnTo,sections}:Props) {
  const context=await requireCalendarSourcesAdmin();
  const house=await requireBookingHouse(context.repository,propertyId);
  const sources=(await context.calendarRepository.list([house.id])).map(calendarSourceSummary);
  return <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6.5rem)] lg:min-h-0 lg:gap-4">
    <HouseTaskHeader backHref={returnTo??'/admin/houses'} propertyId={house.property_id} title={house.title} subtitle="จัดการข้อมูลบ้านพัก"/>
    <HouseWorkspaceShell sidebarTitle="หมวดข้อมูล" contentIcon={<CalendarDays aria-hidden/>} contentTitle="เชื่อมปฏิทินภายนอก"
      sidebar={<HouseDetailSectionNav propertyId={house.property_id} returnTo={returnTo} sections={sections} selectedSection="calendar"/>}>
      <CalendarSources propertyId={house.property_id} initialSources={sources}/>
    </HouseWorkspaceShell>
  </div>;
}
