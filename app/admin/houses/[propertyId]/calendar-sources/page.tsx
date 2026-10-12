import { redirect } from 'next/navigation';
import { requireCalendarSourcesAdmin } from '../../../../../server/auth/calendar-sources';

export default async function CalendarSourcesPage({params}:{params:Promise<{propertyId:string}>}) {
  await requireCalendarSourcesAdmin();
  const {propertyId}=await params;
  redirect(`/admin/houses/${encodeURIComponent(propertyId)}?section=calendar`);
}
