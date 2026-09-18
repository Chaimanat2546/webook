"use server";
import { revalidatePath } from "next/cache";
import { requireBookingAdmin } from "../../../../../server/auth/bookings";
import { bookingResult, getHouseBooking, listHouseBookings, requireBookingHouse, saveHouseBooking } from "../../../../../server/services/house-bookings";

export async function listHouseBookingsAction(propertyId: string, start: string, end: string) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listHouseBookings(repository, propertyId, start, end);
  });
}
export async function getHouseBookingAction(propertyId: string, id: string) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return getHouseBooking(repository, propertyId, id);
  });
}
export async function searchBookingCustomersAction(propertyId: string, query: string) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    if (typeof query !== "string" || query.length > 100) throw new Error("คำค้นหายาวเกินไป");
    return repository.customers(query.trim());
  });
}
export async function saveHouseBookingAction(propertyId: string, input: unknown) {
  return bookingResult(async () => {
    const { repository, actorId } = await requireBookingAdmin();
    const saved = await saveHouseBooking(repository, actorId, propertyId, input);
    revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/bookings`);
    return saved;
  });
}
