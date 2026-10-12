"use server";

import { requireBookingAdmin } from "../../../server/auth/bookings";
import { bookingResult, listBookingGalleryCalendars, listBookingGalleryHouses } from "../../../server/services/house-bookings";
import { parseGalleryCalendarInput } from '../../../lib/booking-gallery';
import { refreshHouseCalendars } from '../../../server/services/calendar-sync';

export async function listBookingGalleryHousesAction(input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listBookingGalleryHouses(repository, input);
  });
}

export async function listBookingGalleryCalendarsAction(input: unknown) {
  return bookingResult(async () => {
    const { repository, calendarRepository, actorId } = await requireBookingAdmin();
    const parsed = parseGalleryCalendarInput(input);
    const houses = await repository.galleryHousesByPropertyIds(parsed.propertyIds);
    const summaries = await refreshHouseCalendars(calendarRepository, houses.map(house => house.id), actorId);
    const cards = await listBookingGalleryCalendars(repository, input);
    return cards.map(card => ({ ...card, calendarSync: summaries[houses.find(house => house.property_id === card.propertyId)?.id ?? ''] }));
  });
}
