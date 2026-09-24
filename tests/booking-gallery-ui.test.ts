import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const gallery = () => readFileSync(new URL("../components/admin/bookings/booking-calendar-gallery.tsx", import.meta.url), "utf8");
const card = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-card.tsx", import.meta.url), "utf8");
const days = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-days.tsx", import.meta.url), "utf8");
const cardCss = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-card.css", import.meta.url), "utf8");

test("gallery loads through the authorized action and exposes month, zone, order, and retry controls", () => {
  const source = gallery();
  assert.match(source, /listBookingGalleryAction\(query\)/);
  assert.match(source, /aria-label="เดือนที่แสดง"/);
  assert.match(source, /setQuery\([^]*?month:/);
  assert.match(source, /zone:/);
  assert.match(source, /order:/);
  assert.match(source, /ลองอีกครั้ง/);
  assert.match(source, /ไม่พบ/);
});

test("card uses the booking ID and property ID for selection and keeps seven date columns", () => {
  const source = days();
  assert.match(source, /day\.bookingId/);
  assert.match(source, /onBookingSelect\(card\.propertyId, day\.bookingId/);
  assert.match(source, /onCreateSelect\(card\.propertyId/);
  assert.match(source, /aria-label=/);
  assert.match(cardCss(), /grid-template-columns:\s*repeat\(7,/);
});

test("card styles distinguish confirmed, waiting, repair and free days without inventing holidays", () => {
  const source = days();
  const css = cardCss();
  assert.match(source, /toneLabel\[day\.tone\]/);
  assert.match(source, /booking-gallery-day-\$\{day\.tone\}/);
  for (const tone of ["confirmed", "waiting", "repair", "free"]) {
    assert.match(css, new RegExp(`\\.booking-gallery-day-${tone}\\b`));
  }
  assert.doesNotMatch(source, /holidayDates|holidays\.map/);
});

test("expanded dialog keeps a focusable card trigger and large date targets", () => {
  assert.match(card(), /ref=\{expandButton\}/);
  assert.match(card(), /<Dialog open=\{expanded\}/);
  assert.match(card(), /getTrigger=\{dayButton => expandButton\.current \?\? dayButton\}/);
  assert.match(cardCss(), /\.booking-gallery-days-expanded \.booking-gallery-day \{[^}]*min-height: 40px/);
});

test("route mounts the gallery after the existing server authorization", () => {
  const source = readFileSync(new URL("../app/admin/bookings/page.tsx", import.meta.url), "utf8");
  assert.match(source, /await requireBookingAdmin\(\)/);
  assert.match(source, /<BookingCalendarGallery\s*\/>/);
});
