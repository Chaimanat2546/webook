"use server";

import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult, listBookingGalleryCalendars, listBookingGalleryHouses } from "../../../server/services/house-bookings";

export async function listBookingGalleryHousesAction(input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listBookingGalleryHouses(repository, input);
  });
}

export async function listBookingGalleryCalendarsAction(input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listBookingGalleryCalendars(repository, input);
  });
}
