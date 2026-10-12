import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult } from "../../../server/services/house-bookings";
import { BookingCalendarGallery } from "@/components/admin/bookings/booking-calendar-gallery";
import type { GallerySearchMode } from "@/lib/booking-gallery";

export default async function BookingGalleryPage({ searchParams }: { searchParams: Promise<{ search?: string; searchMode?: string; page?: string }> }) {
  const params = await searchParams;
  const initialSearch = params.search?.trim().slice(0, 120) ?? "";
  const initialSearchMode: GallerySearchMode = params.searchMode === "title" ? "title" : "dv";
  const parsedPage = Number(params.page);
  const initialPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const result = await bookingResult(async () => {
    await requireBookingAdmin();
    return true;
  });
  if (!result.ok) return <div role="alert" className="rounded-lg border p-6">{result.message}</div>;

  return <BookingCalendarGallery initialSearch={initialSearch} initialSearchMode={initialSearchMode} initialPage={initialPage} />;
}
