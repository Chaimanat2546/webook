import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBookingGallery, type BookingGalleryCard } from '../lib/booking-gallery.ts';
import { safeHouseReturnTo } from '../lib/admin-return-to.ts';

test('gallery and read-only dialog calendar align Sunday headers with real dates', async () => {
  const output = await build({ entryPoints: [fileURLToPath(new URL('../components/admin/bookings/booking-gallery-days.tsx', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Days = loaded.exports.BookingGalleryDays as ComponentType<Record<string, unknown>>;
  const card = buildBookingGallery([{ id: 'listing-1', property_id: '2122', title: 'บ้านทดสอบ', location_zone: null }], [], '2026-08')[0];
  for (const readOnly of [false, true]) {
    const html = renderToStaticMarkup(createElement(Days, { card, month: '2026-08', today: '2026-08-01', readOnly, onBookingSelect: () => {}, onCreateSelect: () => {} }));
    const headers = html.match(/class="booking-gallery-weekdays"[^>]*>(.*?)<\/div>/)?.[1];
    assert.equal(headers, '<span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span>');
    const dates = Array.from(html.matchAll(/aria-label="บ้านทดสอบ · (\d{4}-\d{2}-\d{2})/g), match => match[1]);
    assert.equal(dates[0], '2026-07-26');
    assert.equal(dates[6], '2026-08-01');
    assert.equal(dates.length, 42);
  }
});

test('house return navigation accepts booking gallery filters but rejects other destinations', () => {
  assert.equal(safeHouseReturnTo('/admin/bookings'), '/admin/bookings');
  assert.equal(safeHouseReturnTo('/admin/bookings?search=2122&searchMode=dv&page=2'), '/admin/bookings?search=2122&searchMode=dv&page=2');
  for (const value of ['https://evil.example/admin/bookings', '//evil.example/admin/bookings', '/admin/bookings/extra', '/admin/bookings#x', '/admin/bookings\\evil']) {
    assert.equal(safeHouseReturnTo(value), null);
  }
});

test('booking route restores gallery search and page and defaults invalid page values', async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL('../app/admin/bookings/page.tsx', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
    plugins: [{ name: 'server-boundaries', setup(builder) {
      builder.onResolve({ filter: /server\/auth\/bookings$/ }, () => ({ path: 'test-auth', external: true }));
      builder.onResolve({ filter: /server\/services\/house-bookings$/ }, () => ({ path: 'test-result', external: true }));
      builder.onResolve({ filter: /booking-calendar-gallery$/ }, () => ({ path: 'test-gallery', external: true }));
    } }],
  });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', output.outputFiles[0].text)((id: string) => {
    if (id === 'test-auth') return { requireBookingAdmin: async () => {} };
    if (id === 'test-result') return { bookingResult: async (operation: () => Promise<unknown>) => ({ ok: true, data: await operation() }) };
    if (id === 'test-gallery') return { BookingCalendarGallery: () => null };
    return require(id);
  }, loaded, loaded.exports);
  const Page = loaded.exports.default as (props: { searchParams: Promise<Record<string, string>> }) => Promise<ReactElement<{ initialSearch: string; initialSearchMode: string; initialPage: number }>>;
  for (const [page, expected] of [['2', 2], ['0', 1], ['-1', 1], ['1.5', 1], ['bad', 1], ['9007199254740992', 1]] as const) {
    const result = await Page({ searchParams: Promise.resolve({ search: ' บ้านทะเล ', searchMode: 'title', page }) });
    assert.equal(result.props.initialSearch, 'บ้านทะเล');
    assert.equal(result.props.initialSearchMode, 'title');
    assert.equal(result.props.initialPage, expected);
  }
});

test('house header can show the booking return destination without losing its filters', async () => {
  const output = await build({ entryPoints: [fileURLToPath(new URL('../components/admin/houses/house-task-header.tsx', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Header = loaded.exports.HouseTaskHeader as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Header, { backHref: '/admin/bookings?search=2122&page=2', backLabel: 'กลับไปการจอง', propertyId: '2122', title: 'บ้านทดสอบ', subtitle: 'จัดการข้อมูลบ้านพัก' }));
  assert.match(html, /href="\/admin\/bookings\?search=2122&amp;page=2"/);
  assert.ok(html.includes('กลับไปการจอง'));
});

test('external calendar legend links to settings for its own house without replacing date buttons', async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL('../components/admin/bookings/booking-gallery-card.tsx', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' },
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Card = loaded.exports.BookingGalleryCard as ComponentType<Record<string, unknown>>;
  for (const [propertyId, href] of [['2122', '/admin/houses/2122?section=calendar&returnTo=%2Fadmin%2Fbookings%3Fsearch%3D2122%26searchMode%3Ddv%26page%3D2'], ['house/2', '/admin/houses/house%2F2?section=calendar&returnTo=%2Fadmin%2Fbookings%3Fsearch%3D2122%26searchMode%3Ddv%26page%3D2']]) {
    const card: BookingGalleryCard = {
      propertyId, title: 'บ้านทดสอบ', zone: null, bookedNights: 1,
      days: { '2026-10-12': { date: '2026-10-12', tone: 'external', bookingId: 'external-1',
        externalBookings: [{ id: 'external-1', provider: 'airbnb' }] } },
    };
    const html = renderToStaticMarkup(createElement(Card, {
      house: { id: `listing-${propertyId}`, property_id: propertyId, title: card.title, location_zone: null, is_active: true }, card,
      month: '2026-10', today: '2026-10-01', loading: false, error: '',
      returnTo: '/admin/bookings?search=2122&searchMode=dv&page=2',
      onMonthChange: () => {}, onRetry: () => {}, onBookingSelect: () => {}, onCreateSelect: () => {},
    }));
    assert.ok(html.includes(`href="${href.replaceAll('&', '&amp;')}"`), 'settings link must target this house and retain gallery filters');
    assert.match(html, /<a\b[^>]*>[^]*?ปฏิทินภายนอก<\/a>/);
    assert.match(html, /<button\b[^>]*aria-label="บ้านทดสอบ · 2026-10-12 · ปฏิทินภายนอก · เปิดการจอง"/);
    assert.ok(!html.includes('ไม่ว่างจาก iCal'));
  }
});

const gallery = () => readFileSync(new URL("../components/admin/bookings/booking-calendar-gallery.tsx", import.meta.url), "utf8");

test("booking cards keep sync summaries to one line even with 100 external sources", async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL("../components/admin/bookings/booking-gallery-card.tsx", import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external", loader: { ".css": "empty" },
  });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Card = loaded.exports.BookingGalleryCard as ComponentType<Record<string, unknown>>;
  const base: BookingGalleryCard = { propertyId: "2122", title: "บ้านทดสอบ", zone: null, bookedNights: 0, days: {} };
  const source: NonNullable<BookingGalleryCard["calendarSync"]>["sources"][number] = {
    id: "airbnb-1", listing_id: "house", provider: "airbnb", label: "airbnb", enabled: true,
    last_synced_at: "2026-10-12T08:14:00Z", last_attempted_at: null, next_refresh_at: null, last_error_code: null,
  };
  for (const sync of [undefined, { stale: false, sources: [source] }, { stale: true, sources: Array.from({ length: 100 }, (_, index) => ({ ...source, id: `source-${index}`, label: `บัญชีที่ ${index}` })) }]) {
    const html = renderToStaticMarkup(createElement(Card, {
      house: { id: "house", property_id: "2122", title: base.title, is_active: true },
      card: { ...base, calendarSync: sync }, month: "2026-10", today: "2026-10-12", loading: false, error: "",
      onMonthChange() {}, onRetry() {}, onBookingSelect() {}, onCreateSelect() {},
    }));
    const status = html.match(/<p[^>]+data-booking-sync-status[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(status, "every ready card reserves sync space");
    assert.match(status[0], /h-4/);
    assert.match(status[0], /truncate/);
    assert.doesNotMatch(status[0], /tabindex|overflow-y-auto/);
    if (sync) {
      if (sync.stale) {
        assert.match(status[1], /ปฏิทินภายนอก 100 แหล่ง/);
        assert.match(status[1], /ข้อมูลบางแหล่งยังไม่ล่าสุด/);
        assert.doesNotMatch(status[1], /บัญชีที่/);
      } else assert.match(status[1], /airbnb: ซิงก์/);
    } else {
      assert.equal(status[1], "");
      assert.doesNotMatch(status[0], /tabindex/);
    }
  }
});
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
  assert.match(source, /<BookingCalendarGallery\s+initialSearch=\{initialSearch\}\s+initialSearchMode=\{initialSearchMode\}\s+initialPage=\{initialPage\}\s*\/>/);
});

test("gallery editor reuses one booking form with Sheet and centred Dialog presentations", async () => {
  const source = editor();
  assert.match(source, /export function BookingEditorForm/);
  assert.match(source, /<SheetContent/);
  assert.match(source, /<DialogContent/);
  const output=await build({entryPoints:[fileURLToPath(new URL('../components/admin/houses/bookings/booking-editor-layout.tsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{} as Record<string,unknown>};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const Layout=loaded.exports.BookingEditorLayout as ComponentType<Record<string,unknown>>;
  const dialog=renderToStaticMarkup(createElement(Layout,{presentation:'dialog',dates:createElement('p',null,'calendar')},createElement('p',null,'details')));
  assert.match(dialog,/lg:grid-cols-\[minmax\(/);
  assert.ok(dialog.indexOf('calendar')<dialog.indexOf('details'));
  const sheet=renderToStaticMarkup(createElement(Layout,{presentation:'sheet',dates:'calendar'},'details'));
  assert.doesNotMatch(sheet,/grid-cols/);
  assert.match(source, /BookingEditorSkeleton presentation=\{presentation\}/);
  assert.match(skeleton(), /presentation === "dialog"/);
  assert.match(source, /<div className="min-h-0 min-w-0 flex-1 overflow-y-auto">\s*<fieldset/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/skeleton\.css"/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/themes\/classic\/theme\.css"/);
  assert.match(dateRange(), /import "@fullcalendar\/react\/themes\/classic\/palette\.css"/);
  assert.match(galleryDialog(), /<BookingEditor/);
  assert.match(gallery(), /<BookingGalleryEditorDialog/);
});

test("booking editor shows a Bangkok payment deadline only for waiting bookings", () => {
  const source = editor();
  assert.match(source, /form\.status === "waiting"/);
  assert.match(source, /หมดอายุการชำระเงิน/);
  assert.match(source, /type="datetime-local"/);
  assert.match(source, /defaultPaymentExpiry/);
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
