import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult } from "../../../server/services/house-bookings";
import { BookingCalendarGallery } from "@/components/admin/bookings/booking-calendar-gallery";

export default async function BookingGalleryPage() {
  const result = await bookingResult(async () => {
    await requireBookingAdmin();
    return true;
  });
  if (!result.ok) return <div role="alert" className="rounded-lg border p-6">{result.message}</div>;

  return <BookingCalendarGallery />;
}
