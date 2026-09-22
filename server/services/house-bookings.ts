import "server-only";
import { assertBookingNotPast, bookingToday } from "../../lib/booking-availability.ts";
import { bookingId, parseBookingCreate, parseBookingRange, parseBookingUpdate, type BookingResult } from "../../lib/house-bookings.ts";
import type { HouseBookingsRepository } from "../repositories/house-bookings.ts";

export async function requireBookingHouse(repository: HouseBookingsRepository, propertyId: unknown) {
  const house = await repository.house(bookingId(propertyId));
  if (!house) throw new Error("booking_house_not_found");
  return house;
}
export async function listHouseBookings(repository: HouseBookingsRepository, propertyId: unknown, start: unknown, end: unknown) {
  const range = parseBookingRange(start, end);
  const house = await requireBookingHouse(repository, propertyId);
  const bookings = await repository.list(house, range.start, range.end);
  return bookings.filter(booking => booking.status !== "cancelled");
}
export async function getHouseBooking(repository: HouseBookingsRepository, propertyId: unknown, id: unknown) {
  const house = await requireBookingHouse(repository, propertyId);
  const booking = await repository.get(house, bookingId(id));
  if (!booking) throw new Error("booking_not_found");
  return booking;
}
export async function saveHouseBooking(repository: HouseBookingsRepository, actorId: string, propertyId: unknown, raw: unknown) {
  const input = parseBookingUpdate(raw);
  const house = await requireBookingHouse(repository, propertyId);
  // The RPC repeats these checks under a row lock to prevent concurrent edits.
  const current = await repository.get(house, input.id);
  if (!current) throw new Error("booking_not_found");
  if (current.updated_at !== input.updated_at) throw new Error("booking_stale");
  if (input.status !== "cancelled") assertBookingNotPast(input.check_in, input.check_out, bookingToday(), current);
  if (current.status === "repair" && input.status !== "repair" && input.status !== "cancelled" && !input.customer_id) throw new Error("กรุณาเลือกลูกค้าสำหรับการจอง");
  if (input.customer_id && !await repository.ownsCustomer(house, input.customer_id)) throw new Error("กรุณาเลือกลูกค้าของบ้านนี้");
  return repository.update(house, actorId, input);
}
export function bookingError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  if (code === "23P01") return "ช่วงวันที่นี้ซ้อนกับการจองอื่น กรุณาตรวจสอบวันเข้าพัก";
  if (message === "booking_stale") return "มีผู้แก้ไขการจองนี้แล้ว กรุณาปิดและเปิดรายการใหม่";
  if (message === "booking_forbidden") return "คุณไม่มีสิทธิ์จัดการการจอง";
  if (message === "booking_not_found" || message === "booking_house_not_found") return "ไม่พบการจองหรือบ้านที่เลือก";
  if (code === "23503") return "ไม่พบลูกค้าที่เลือก กรุณาค้นหาและเลือกลูกค้าใหม่";
  if (["42P01", "42703", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(String(code))) return "ฐานข้อมูลยังไม่พร้อมสำหรับระบบการจอง กรุณาติดต่อผู้ดูแล";
  // Validation errors are authored locally. Never return raw database errors.
  if (error instanceof Error && /[ก-๙]/u.test(message) && !code) return message;
  return "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง";
}
export async function bookingResult<T>(work: () => Promise<T>): Promise<BookingResult<T>> {
  try { return { ok: true, data: await work() }; }
  catch (error) { return { ok: false, message: bookingError(error) }; }
}

export async function createHouseBooking(repository: HouseBookingsRepository, actorId: string, propertyId: unknown, raw: unknown) {
  const input = parseBookingCreate(raw);
  assertBookingNotPast(input.check_in, input.check_out, bookingToday());
  const house = await requireBookingHouse(repository, propertyId);
  if (input.customer_id && !await repository.ownsCustomer(house, input.customer_id)) throw new Error("กรุณาเลือกลูกค้าของบ้านนี้");
  return repository.create(house, actorId, input);
}

export async function cancelHouseBooking(repository: HouseBookingsRepository, actorId: string, propertyId: unknown, id: unknown, expectedRevision: unknown) {
  const house = await requireBookingHouse(repository, propertyId);
  const current = await repository.get(house, bookingId(id));
  if (!current) throw new Error("booking_not_found");
  if (current.updated_at !== expectedRevision) throw new Error("booking_stale");
  return repository.update(house, actorId, parseBookingUpdate({ ...current, status: "cancelled" }));
}
