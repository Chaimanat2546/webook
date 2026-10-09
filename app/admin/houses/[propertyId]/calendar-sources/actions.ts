'use server';
import { revalidatePath } from 'next/cache';
import { requireCalendarSourcesAdmin } from '../../../../../server/auth/calendar-sources';
import { bookingResult, requireBookingHouse } from '../../../../../server/services/house-bookings';
import { parseCalendarSourceInput } from '../../../../../server/services/calendar-sources';
import { encryptSourceUrl } from '../../../../../server/calendar/source-secret';
import { calendarSourceSummary, refreshHouseCalendars } from '../../../../../server/services/calendar-sync';

export async function saveCalendarSourceAction(propertyId:string,input:unknown){
  return bookingResult(async()=>{
    const {repository,calendarRepository,actorId}=await requireCalendarSourcesAdmin();
    const house=await requireBookingHouse(repository,propertyId),parsed=parseCalendarSourceInput(input);
    const payload=parsed.url?await encryptSourceUrl(parsed.url):null;
    if(parsed.sourceId)await calendarRepository.update(parsed.sourceId,house.id,actorId,parsed.label,parsed.enabled,payload);
    else {if(!payload)throw new Error('กรุณาระบุ URL');await calendarRepository.add(house.id,parsed.label,payload);}
    revalidatePath(`/admin/houses/${house.property_id}/calendar-sources`);revalidatePath('/admin/bookings');
    return (await calendarRepository.list([house.id])).map(calendarSourceSummary);
  });
}
export async function refreshCalendarSourcesAction(propertyId:string){
  return bookingResult(async()=>{
    const {repository,calendarRepository,actorId}=await requireCalendarSourcesAdmin();
    const house=await requireBookingHouse(repository,propertyId);
    const result=await refreshHouseCalendars(calendarRepository,[house.id],actorId);
    revalidatePath('/admin/bookings');
    return result[house.id].sources;
  });
}
