import { bookingToday } from "./booking-availability.ts";
import { bookingId, type Booking } from "./house-bookings.ts";

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
export interface GalleryHouseSummary extends BookingGalleryHouse { is_active: boolean | null }
export interface GalleryHousePage { houses: GalleryHouseSummary[]; total: number; page: number; pageCount: number }
export type GallerySearchMode = "dv" | "title";
export interface GalleryPageInput { page: number; search: string; searchMode: GallerySearchMode }
export interface GalleryCalendarInput { month: string; start: string; end: string; propertyIds: string[] }
export interface GalleryBookingSlice { id: string; listing_id: string; houseid: string; check_in: string; check_out: string; status: string | null }

export function parseGalleryPageInput(input: unknown): GalleryPageInput {
  if (input != null && (typeof input !== "object" || Array.isArray(input))) throw new Error("ข้อมูลไม่ถูกต้อง");
  const raw = (input ?? {}) as Record<string, unknown>;
  const page = raw.page === undefined ? 1 : raw.page;
  const search = raw.search === undefined ? "" : raw.search;
  const searchMode = raw.searchMode === undefined ? "dv" : raw.searchMode;
  if (searchMode !== "dv" && searchMode !== "title") throw new Error("ประเภทการค้นหาไม่ถูกต้อง");
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 100000) throw new Error("หน้าไม่ถูกต้อง");
  if (typeof search !== "string" || search.trim().length > 120) throw new Error("คำค้นหาไม่ถูกต้อง");
  return { page, search: search.trim(), searchMode };
}

export function parseGalleryCalendarInput(input: unknown): GalleryCalendarInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("ข้อมูลไม่ถูกต้อง");
  const raw = input as Record<string, unknown>;
  if (typeof raw.month !== "string") throw new Error("เดือนไม่ถูกต้อง");
  const { start, end } = monthRange(raw.month);
  if (!Array.isArray(raw.propertyIds) || raw.propertyIds.length < 1 || raw.propertyIds.length > 6) throw new Error("รหัสบ้านไม่ถูกต้อง");
  const propertyIds = raw.propertyIds.map(bookingId);
  if (new Set(propertyIds).size !== propertyIds.length) throw new Error("รหัสบ้านซ้ำกัน");
  return { month: raw.month, start, end, propertyIds };
}

export interface BookingGalleryDay {
  date: string;
  tone: "free" | "waiting" | "confirmed" | "repair" | "unknown" | "holiday";
  bookingId: string | null;
}

export interface BookingGalleryCard {
  propertyId: string;
  title: string;
  zone: string | null;
  bookedNights: number;
  days: Record<string, BookingGalleryDay>;
}

export type BookingGalleryMonthState =
  | { status: "loading" }
  | { status: "ready"; cards: BookingGalleryCard[] }
  | { status: "error"; message: string };

export function paginateBookingGallery(cards: BookingGalleryCard[], search: string, requestedPage: number) {
  const term = search.trim().toLocaleLowerCase();
  const filtered = cards.filter(card => card.title.toLocaleLowerCase().includes(term)
    || card.propertyId.toLocaleLowerCase().includes(term)
    || `dv ${card.propertyId}`.toLocaleLowerCase().includes(term));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  return { cards: filtered.slice((page - 1) * 6, page * 6), total: filtered.length, pageCount, page };
}

export function bookingGalleryCardForMonth(propertyId: string, month: string, months: Record<string, BookingGalleryMonthState>) {
  const state = months[month] ?? { status: "loading" as const };
  return { status: state.status, message: state.status === "error" ? state.message : "", card: state.status === "ready" ? state.cards.find(card => card.propertyId === propertyId) ?? null : null };
}

export function bookingGalleryMonthsToRefresh(months: Record<string, BookingGalleryMonthState>): string[] {
  return Object.keys(months).sort();
}

export function bookingGalleryPageNumbers(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const middle = page <= 3 ? [2, 3] : page >= pageCount - 2 ? [pageCount - 2, pageCount - 1] : [page - 1, page, page + 1];
  const numbers = [1, ...middle, pageCount];
  const items: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const number of numbers) {
    if (previous > 0 && number - previous > 1) items.push("ellipsis");
    items.push(number);
    previous = number;
  }
  return items;
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

export function buildBookingGallery(houses: BookingGalleryHouse[], bookings: Array<GalleryBookingSlice | Booking>, month: string): BookingGalleryCard[] {
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
    if (booking.status === "cancelled") continue;
    const card = cardByHouse.get(`${booking.listing_id}:${booking.houseid}`);
    if (!card) continue;
    const tone = booking.status === "confirmed" || booking.status === "waiting" || booking.status === "repair" ? booking.status : "unknown";
    for (let day = Math.max(firstDay, Date.parse(`${booking.check_in}T00:00:00Z`)); day < Math.min(lastDay, Date.parse(`${booking.check_out}T00:00:00Z`)); day += dayMilliseconds) {
      const date = new Date(day).toISOString().slice(0, 10);
      card.days[date] = { date, tone, bookingId: booking.id };
    }
  }
  for (const card of cards) {
    card.bookedNights = Object.values(card.days).filter(day => day.date.startsWith(month) && (day.tone === "confirmed" || day.tone === "waiting" || day.tone === "unknown")).length;
  }
  return cards;
}
