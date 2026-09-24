import { bookingToday } from "./booking-availability.ts";
import type { Booking } from "./house-bookings.ts";

export interface BookingGalleryQuery {
  month: string;
  start: string;
  end: string;
  zone: string | null;
  order: "title" | "booked";
}

export interface BookingGalleryHouse {
  id: string;
  property_id: string;
  title: string;
  location_zone: string | null;
}

export interface BookingGalleryDay {
  date: string;
  tone: "free" | "waiting" | "confirmed" | "repair" | "holiday";
  bookingId: string | null;
}

export interface BookingGalleryCard {
  propertyId: string;
  title: string;
  zone: string | null;
  bookedNights: number;
  days: Record<string, BookingGalleryDay>;
}

const dayMilliseconds = 86_400_000;

function monthRange(month: string): { start: string; end: string } {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("เดือนไม่ถูกต้อง");
  const [year, monthNumber] = month.split("-").map(Number);
  const first = Date.UTC(year, monthNumber - 1, 1);
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7;
  const start = new Date(first - mondayOffset * dayMilliseconds).toISOString().slice(0, 10);
  const end = new Date(first + (42 - mondayOffset) * dayMilliseconds).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("เดือนไม่ถูกต้อง");
  return { start, end };
}

export function parseBookingGalleryQuery(input: unknown): BookingGalleryQuery {
  if (input != null && (typeof input !== "object" || Array.isArray(input))) throw new Error("ข้อมูลไม่ถูกต้อง");
  const raw = (input ?? {}) as Record<string, unknown>;
  const month = raw.month === undefined ? bookingToday().slice(0, 7) : raw.month;
  if (typeof month !== "string") throw new Error("เดือนไม่ถูกต้อง");
  const { start, end } = monthRange(month);
  const zone = raw.zone == null ? null : raw.zone;
  if (zone !== null && typeof zone !== "string") throw new Error("โซนไม่ถูกต้อง");
  const trimmedZone = zone?.trim() ?? null;
  if (trimmedZone && trimmedZone.length > 120) throw new Error("โซนไม่ถูกต้อง");
  const order = raw.order === undefined ? "title" : raw.order;
  if (order !== "title" && order !== "booked") throw new Error("ลำดับไม่ถูกต้อง");
  return { month, start, end, zone: trimmedZone || null, order };
}

export function buildBookingGallery(houses: BookingGalleryHouse[], bookings: Booking[], month: string): BookingGalleryCard[] {
  const { start, end } = monthRange(month);
  const firstDay = Date.parse(`${start}T00:00:00Z`);
  const lastDay = Date.parse(`${end}T00:00:00Z`);
  const cards = houses.map(house => {
    const days: Record<string, BookingGalleryDay> = {};
    for (let day = firstDay; day < lastDay; day += dayMilliseconds) {
      const date = new Date(day).toISOString().slice(0, 10);
      days[date] = { date, tone: "free", bookingId: null };
    }
    return { propertyId: house.property_id, title: house.title, zone: house.location_zone, bookedNights: 0, days };
  });
  const cardByHouse = new Map(houses.map((house, index) => [`${house.id}:${house.property_id}`, cards[index]]));
  for (const booking of bookings) {
    if (booking.status !== "confirmed" && booking.status !== "waiting" && booking.status !== "repair") continue;
    const card = cardByHouse.get(`${booking.listing_id}:${booking.houseid}`);
    if (!card) continue;
    for (let day = Math.max(firstDay, Date.parse(`${booking.check_in}T00:00:00Z`)); day < Math.min(lastDay, Date.parse(`${booking.check_out}T00:00:00Z`)); day += dayMilliseconds) {
      const date = new Date(day).toISOString().slice(0, 10);
      card.days[date] = { date, tone: booking.status, bookingId: booking.id };
    }
  }
  for (const card of cards) {
    card.bookedNights = Object.values(card.days).filter(day => day.date.startsWith(month) && (day.tone === "confirmed" || day.tone === "waiting")).length;
  }
  return cards;
}
