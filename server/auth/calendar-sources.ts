import 'server-only';
import { requireBookingAdmin } from './bookings';
export async function requireCalendarSourcesAdmin(){
  const context=await requireBookingAdmin();
  if(!context.canManageBookingAgency)throw new Error('คุณไม่มีสิทธิ์จัดการแหล่งปฏิทิน');
  return context;
}
