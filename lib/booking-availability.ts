import type { Booking } from "./house-bookings.ts";

export type OccupiedBooking = Pick<Booking, "id" | "check_in" | "check_out" | "status">;
export function bookingConflict(rows: OccupiedBooking[], start: string, end: string, excludeId?: string) {
  return rows.find(row => row.id !== excludeId && row.status !== "cancelled" && row.check_in < end && row.check_out > start);
}
export function occupiedNight(rows: OccupiedBooking[], day: string, excludeId?: string) {
  return rows.find(row => row.id !== excludeId && row.status !== "cancelled" && row.check_in <= day && row.check_out > day);
}

export function bookingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function assertBookingNotPast(start: string, end: string, today: string, current?: { check_in: string; check_out: string; status: string }) {
  const unchangedActiveStay = current && current.status !== "cancelled" && current.check_in === start && current.check_out === end;
  if (start < today && !unchangedActiveStay) throw new Error("ไม่สามารถจองวันที่ผ่านมาแล้วได้ กรุณาเลือกตั้งแต่วันนี้เป็นต้นไป");
}
