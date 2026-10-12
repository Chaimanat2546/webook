import { redirect } from "next/navigation";
import { requireAdmin } from "../server/auth/admin";
import { requireBookingAdmin } from "../server/auth/bookings";
import { bookingResult } from "../server/services/house-bookings";

export default async function Home() {
  await requireAdmin();
  const bookingAccess = await bookingResult(async () => {
    await requireBookingAdmin();
    return true;
  });
  redirect(bookingAccess.ok ? "/admin/bookings" : "/admin/houses");
}
