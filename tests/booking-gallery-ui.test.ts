import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const gallery = () => readFileSync(new URL("../components/admin/bookings/booking-calendar-gallery.tsx", import.meta.url), "utf8");
const days = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-days.tsx", import.meta.url), "utf8");
const cardCss = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-card.css", import.meta.url), "utf8");
const editor = () => readFileSync(new URL("../components/admin/houses/bookings/booking-editor.tsx", import.meta.url), "utf8");
const galleryDialog = () => readFileSync(new URL("../components/admin/bookings/booking-gallery-editor-dialog.tsx", import.meta.url), "utf8");
const skeleton = () => readFileSync(new URL("../components/admin/houses/bookings/booking-skeletons.tsx", import.meta.url), "utf8");
const dateRange = () => readFileSync(new URL("../components/admin/houses/bookings/booking-date-range.tsx", import.meta.url), "utf8");

test("gallery requests separate bounded house and calendar data with search, pagination, and retry controls", () => {
  const source = gallery();
  assert.match(source, /listBookingGalleryHousesAction\(\{ search: committedSearch, page: requestedPage, searchMode \}\)/);
  assert.match(source, /listBookingGalleryCalendarsAction\(\{ month: group\.month, propertyIds:/);
  assert.match(source, /setTimeout\(\(\) => setCommittedSearch\(search\.trim\(\)\), 250\)/);
  assert.match(source, /aria-label="ค้นหาจาก"/);
  assert.match(source, /<Pagination>/);
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

test("route mounts the gallery after the existing server authorization", () => {
  const source = readFileSync(new URL("../app/admin/bookings/page.tsx", import.meta.url), "utf8");
  assert.match(source, /await requireBookingAdmin\(\)/);
  assert.match(source, /<BookingCalendarGallery\s*\/>/);
});

test("the per-house booking route remains the workspace calendar and does not mount the gallery", () => {
  const legacyPageSource = readFileSync(new URL("../app/admin/houses/[propertyId]/bookings/page.tsx", import.meta.url), "utf8");
  assert.match(legacyPageSource, /<HouseBookingCalendar propertyId=\{house\.property_id\} \/>/);
  assert.doesNotMatch(legacyPageSource, /BookingCalendarGallery/);
});

test("gallery editor reuses one booking form with Sheet and centred Dialog presentations", () => {
  const source = editor();
  assert.match(source, /export function BookingEditorForm/);
  assert.match(source, /<SheetContent/);
  assert.match(source, /<DialogContent/);
  assert.match(source, /lg:grid-cols-\[minmax\(/);
  assert.match(source, /BookingEditorSkeleton presentation=\{presentation\}/);
  assert.match(skeleton(), /presentation === "dialog"/);
  assert.match(source, /<div className="min-h-0 min-w-0 flex-1 overflow-y-auto">\s*<fieldset/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/skeleton\.css"/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/themes\/classic\/theme\.css"/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/themes\/classic\/palette\.css"/);
  assert.match(galleryDialog(), /<BookingEditor/);
  assert.match(gallery(), /<BookingGalleryEditorDialog/);
});

test("gallery returns focus to the card trigger or search and invalidates the saved house", () => {
  const source = gallery();
  assert.match(source, /triggerRef=\{trigger\}/);
  assert.match(source, /trigger\.current\.focus\(\)/);
  assert.match(source, /searchInput\.current\?\.focus\(\)/);
  assert.match(source, /onSaved=\{/);
  assert.match(source, /cache\.invalidateHouse\(selected\.propertyId\)/);
  assert.match(source, /if \(visible\) void loadPairs\(\[\{ propertyId: selected\.propertyId/);
  assert.match(source, /trigger\.current instanceof HTMLButtonElement && trigger\.current\.disabled/);
});
