"use server";

import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult, listBookingGallery } from "../../../server/services/house-bookings";

export async function listBookingGalleryAction(input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listBookingGallery(repository, input);
  });
}
