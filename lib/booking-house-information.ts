import type { BookingHouseInformation } from "./house-bookings";

export function bookingHouseInformationValue<K extends keyof BookingHouseInformation>(
  values: BookingHouseInformation,
  defaults: BookingHouseInformation,
  key: K,
  touched: boolean,
): BookingHouseInformation[K] {
  return touched ? values[key] : values[key] ?? defaults[key];
}
