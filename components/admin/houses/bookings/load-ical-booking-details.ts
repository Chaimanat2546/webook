import type { Booking, BookingResult } from '@/lib/house-bookings';
import type { BookingGalleryCard } from '@/lib/booking-gallery';
interface Dependencies {
  refreshCalendar:()=>Promise<BookingResult<BookingGalleryCard[]>>;
  loadBooking:()=>Promise<BookingResult<Booking>>;
}
export async function loadIcalBookingView(propertyId:string,bookingId:string,deps:Dependencies):Promise<{card:BookingGalleryCard;booking:Booking}> {
  const calendar=await deps.refreshCalendar();
  if(!calendar.ok)throw new Error(calendar.message);
  const fresh=await deps.loadBooking();
  if(!fresh.ok)throw new Error(fresh.message);
  const card=calendar.data.find(item=>item.propertyId===propertyId);
  if(!card || fresh.data.id!==bookingId || fresh.data.houseid!==propertyId || !fresh.data.calendar_source_id)throw new Error('ไม่พบรายการปฏิทินภายนอกของบ้านนี้');
  return {card,booking:fresh.data};
}
