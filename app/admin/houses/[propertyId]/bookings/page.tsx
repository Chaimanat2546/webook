import { notFound, redirect } from "next/navigation";
import { bookingId } from "../../../../../lib/house-bookings";

/** Compatibility for notification links issued before the calendar gallery URL. */
export default async function HouseBookingsPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  let id: string;
  try {
    id = bookingId(propertyId);
  } catch {
    notFound();
  }
  // The gallery page enforces booking permission before loading house data.
  redirect(`/admin/bookings?search=${encodeURIComponent(id)}&searchMode=dv`);
}
