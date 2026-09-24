import { parseBookingGalleryQuery, type BookingGalleryQuery } from "./booking-gallery.ts";

type GalleryQueryChanges = Partial<Pick<BookingGalleryQuery, "month" | "zone" | "order">>;
type GalleryQueryResult = { ok: true; query: BookingGalleryQuery } | { ok: false; message: string };

export function tryBookingGalleryQuery(current: BookingGalleryQuery, changes: GalleryQueryChanges): GalleryQueryResult {
  try {
    return { ok: true, query: parseBookingGalleryQuery({
      month: changes.month ?? current.month,
      zone: changes.zone === undefined ? current.zone : changes.zone,
      order: changes.order ?? current.order,
    }) };
  } catch {
    return { ok: false, message: "เดือนที่เลือกอยู่นอกช่วงที่ระบบรองรับ กรุณาเลือกเดือนอื่น" };
  }
}

export function adjacentBookingGalleryMonth(month: string, offset: -1 | 1): string | null {
  const [year, number] = month.split("-").map(Number);
  const position = year * 12 + number - 1 + offset;
  const candidate = `${Math.floor(position / 12)}-${String(position % 12 + 1).padStart(2, "0")}`;
  try {
    parseBookingGalleryQuery({ month: candidate });
    return candidate;
  } catch {
    return null;
  }
}
