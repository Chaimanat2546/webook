'use client';
import { useEffect, useState } from 'react';
import type { Booking } from '@/lib/house-bookings';
import type { BookingGalleryCard } from '@/lib/booking-gallery';
import { listBookingGalleryCalendarsAction } from '@/app/admin/bookings/actions';
import { getHouseBookingAction } from '@/app/admin/houses/[propertyId]/bookings/actions';
import { loadIcalBookingView } from './load-ical-booking-details';
import { Button } from '@/components/ui/button';
import { BookingDateRange } from './booking-date-range';
import { BookingEditorLayout } from './booking-editor-layout';
import { BookingCalendarSkeleton } from './booking-skeletons';
import { IcalBookingSummary } from './ical-booking-summary';

interface Props {propertyId:string;booking:Booking;onClose:()=>void;presentation:'sheet'|'dialog'}
const ignoreChange=()=>{};

export function IcalBookingDetails({propertyId,booking,onClose,presentation}:Props) {
  const [state,setState]=useState<{card?:BookingGalleryCard;booking?:Booking;error?:string}|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const result=await loadIcalBookingView(propertyId,booking.id,{
          refreshCalendar:()=>listBookingGalleryCalendarsAction({month:booking.check_in.slice(0,7),propertyIds:[propertyId]}),
          loadBooking:()=>getHouseBookingAction(propertyId,booking.id),
        });
        if(active)setState(result);
      }catch{if(active)setState(previous=>({...previous,error:'โหลดปฏิทินไม่สำเร็จ กรุณาลองอีกครั้ง'}));}
    }
    void load();return()=>{active=false;};
  },[retry,propertyId,booking.id,booking.check_in]);
  const displayedBooking=state?.booking??booking;
  const source=state?.card?.calendarSync?.sources.find(item=>item.id===displayedBooking.calendar_source_id);
  return <>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
      <BookingEditorLayout presentation={presentation} dates={<>
        {!state?<BookingCalendarSkeleton compact/>:<BookingDateRange propertyId={propertyId} excludeId={displayedBooking.id}
          originalStart={displayedBooking.check_in} originalEnd={displayedBooking.check_out} originalStatus={displayedBooking.status}
          start={displayedBooking.check_in} end={displayedBooking.check_out} revision={retry} readOnly onChange={ignoreChange} onValid={ignoreChange}/>}
        {state?.error&&<div role="alert" className="space-y-2 text-sm text-destructive"><p>{state.error}</p><Button variant="outline" onClick={()=>setRetry(value=>value+1)}>ลองอีกครั้ง</Button></div>}
      </>}>
        <IcalBookingSummary booking={displayedBooking} source={source}/>
      </BookingEditorLayout>
    </div>
    <div className="flex shrink-0 justify-end border-t bg-popover p-4"><Button variant="outline" onClick={onClose}>ปิด</Button></div>
  </>;
}
