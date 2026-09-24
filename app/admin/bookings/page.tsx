import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult } from "../../../server/services/house-bookings";

export default async function BookingGalleryPage() {
  const result = await bookingResult(async () => {
    await requireBookingAdmin();
    return true;
  });
  if (!result.ok) return <div role="alert" className="rounded-lg border p-6">{result.message}</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">การจอง</h1>
      <div className="rounded-lg border p-6 text-muted-foreground">กำลังเตรียมปฏิทินการจอง</div>
    </main>
  );
}
