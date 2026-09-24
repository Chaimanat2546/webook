import { parseBookingGalleryQuery } from "./booking-gallery.ts";

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
