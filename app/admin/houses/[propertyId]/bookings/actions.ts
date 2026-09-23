"use server";
import { revalidatePath } from "next/cache";
import { requireBookingAdmin } from "../../../../../server/auth/bookings";
import { thaiAddressRepository } from "../../../../../server/geography/thai-address-repository";
import { createBookingCustomer, getBookingCustomer, updateBookingCustomer } from "../../../../../server/services/booking-customers";
import { lookupDbdJuristicPerson } from "../../../../../server/services/dbd-juristic-person";
import { bookingResult, cancelHouseBooking, createHouseBooking, getHouseBooking, listHouseBookings, requireBookingHouse, saveHouseBooking } from "../../../../../server/services/house-bookings";
import { listThaiDistricts, listThaiProvinces, listThaiSubdistricts, lookupThaiPostalCode, resolveThaiAddressNames } from "../../../../../server/services/thai-addresses";

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
    const house = await requireBookingHouse(repository, propertyId);
    if (typeof query !== "string" || query.length > 100) throw new Error("คำค้นหายาวเกินไป");
    return repository.customers(house, query.trim());
  });
}
export async function createBookingCustomerAction(propertyId: string, input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return createBookingCustomer(repository, propertyId, input);
  });
}
export async function getBookingCustomerAction(propertyId: string, id: string) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return getBookingCustomer(repository, propertyId, id);
  });
}
export async function updateBookingCustomerAction(propertyId: string, id: string, revision: string | null, input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return updateBookingCustomer(repository, propertyId, id, revision, input);
  });
}
export async function lookupBookingCustomerDbdAction(propertyId: string, taxId: string) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    if (typeof taxId !== "string" || !/^\d{13}$/.test(taxId)) throw new Error("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
    const result = await lookupDbdJuristicPerson(taxId);
    if (!result.ok) throw new Error(result.reason === "not_found" ? "ไม่พบข้อมูลนิติบุคคลใน DBD" : "เชื่อมต่อ DBD ไม่สำเร็จ กรุณาลองอีกครั้ง");
    return result.defaults;
  });
}

export async function lookupThaiPostalCodeAction(propertyId: string, postalCode: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return lookupThaiPostalCode(thaiAddressRepository, postalCode);
  });
}

export async function listThaiProvincesAction(propertyId: string, postalCode: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return listThaiProvinces(thaiAddressRepository, postalCode);
  });
}

export async function listThaiDistrictsAction(propertyId: string, provinceCode: unknown, postalCode: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return listThaiDistricts(thaiAddressRepository, provinceCode, postalCode);
  });
}

export async function listThaiSubdistrictsAction(propertyId: string, districtCode: unknown, postalCode: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return listThaiSubdistricts(thaiAddressRepository, districtCode, postalCode);
  });
}

export async function resolveThaiAddressNamesAction(propertyId: string, value: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return resolveThaiAddressNames(thaiAddressRepository, value);
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

export async function createHouseBookingAction(propertyId: string, input: unknown) {
  return bookingResult(async () => {
    const { repository, actorId } = await requireBookingAdmin();
    const saved = await createHouseBooking(repository, actorId, propertyId, input);
    revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/bookings`);
    return saved;
  });
}

export async function cancelHouseBookingAction(propertyId: string, id: string, revision: string) {
  return bookingResult(async () => {
    const { repository, actorId } = await requireBookingAdmin();
    const saved = await cancelHouseBooking(repository, actorId, propertyId, id, revision);
    revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/bookings`);
    return saved;
  });
}
