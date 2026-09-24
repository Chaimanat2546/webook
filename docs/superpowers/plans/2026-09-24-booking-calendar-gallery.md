# Booking Calendar Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a top-level Calendar Gallery for all houses and edit bookings in a centred modal that reuses the existing form, while preserving the per-house booking page.

**Architecture:** A server-side Gallery query reads authorised houses and monthly booking intervals. A framework-light mapper creates per-house date cells. The current BookingEditor form is extracted from its Sheet host and placed in a Dialog host; the current house route retains its Sheet host.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS, shadcn/Radix Dialog, Supabase, Node.js Test Runner.

**Spec:** docs/superpowers/specs/2026-09-24-booking-calendar-gallery-design.md

## Global Constraints

- Gallery is additive: never delete, redirect, or modify the legacy route app/admin/houses/[propertyId]/bookings, its actions, navigation entries, or Sheet editor.
- Every Gallery list, detail, mutation, customer, and availability call uses requireBookingAdmin. Client input never authorises scope.
- Preserve Bangkok date-only arithmetic, exclusive checkout, cancelled omission, repair visibility, conflicts, stale revisions, dirty-close confirmation, Thai errors, and money behavior.
- Do not add dependencies, change RLS/schema, or expose privileged clients.
- Use the existing Dialog component; focus is trapped and restored to the selected Gallery card. Mobile stacks vertically.

## Review Focus

- A month-crossing stay paints visible occupied nights but not checkout: Task 1.
- An empty house remains visible and all days are available: Task 1.
- A booking-denied user cannot list or act via Gallery: Task 2.
- Dirty close by Escape, overlay, or close retains confirmation and focus returns correctly: Task 4.
- Date changes retain full price, deposit required, and extra charge: Task 4.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| lib/booking-gallery.ts | Range parsing, Gallery contracts, visible-grid and booking-cell mapping. |
| server/repositories/house-bookings.ts | All-house Gallery reads including location_zone. |
| server/services/house-bookings.ts | Validated Gallery orchestration. |
| app/admin/bookings/page.tsx and actions.ts | New guarded route and Gallery action. |
| components/admin/bookings/* | Toolbar, cards, modal host. |
| components/admin/houses/bookings/booking-editor.tsx | Reusable existing form, existing Sheet unchanged. |
| Admin shell/navigation and lib/mobile-navigation.ts | Booking navigation only for booking operators. |
| tests/booking-gallery*.test.ts | Domain, service, and UI contracts. |

### Task 1: Gallery contracts, mapper, repository, and service

**Files:**
- Create: lib/booking-gallery.ts
- Modify: server/repositories/house-bookings.ts
- Modify: server/services/house-bookings.ts
- Create: tests/booking-gallery.test.ts
- Create: tests/booking-gallery-service.test.ts

**Interfaces:**
- Produces parseBookingGalleryQuery(input: unknown): BookingGalleryQuery where the result is month, start, end, zone, and title/booked order.
- Produces buildBookingGallery(houses, bookings): BookingGalleryCard[].
- Adds repository methods galleryHouses(zone) and galleryBookings(houses, start, end).

- [ ] **Step 1: Write the failing mapper tests**

~~~ts
test("keeps empty house and checkout is exclusive", () => {
  const cards = buildBookingGallery([houseA, houseB], [
    { ...booking, houseid: houseA.property_id, check_in: "2026-09-30", check_out: "2026-10-03", status: "confirmed" },
  ]);
  assert.equal(cards[0].days["2026-10-01"].tone, "confirmed");
  assert.equal(cards[0].days["2026-10-03"].tone, "free");
  assert.equal(cards[1].bookedNights, 0);
});
test("does not paint cancelled bookings but paints repair", () => {
  const cards = buildBookingGallery([houseA], [{ ...booking, status: "cancelled" }, { ...booking, id: "2", status: "repair" }]);
  assert.equal(cards[0].days[booking.check_in].tone, "repair");
});
~~~

- [ ] **Step 2: Run the mapper test to verify failure**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery.test.ts

Expected: FAIL because Gallery exports do not exist.

- [ ] **Step 3: Implement focused Gallery contracts**

~~~ts
export interface BookingGalleryHouse { id: string; property_id: string; title: string; location_zone: string | null; }
export interface BookingGalleryDay { date: string; tone: "free" | "waiting" | "confirmed" | "repair" | "holiday"; bookingId: string | null; }
export interface BookingGalleryCard { propertyId: string; title: string; zone: string | null; bookedNights: number; days: Record<string, BookingGalleryDay>; }
export function buildBookingGallery(houses: BookingGalleryHouse[], bookings: Booking[]): BookingGalleryCard[] {
  // Allocate the six-week visible grid, then paint check_in <= day < check_out.
}
~~~

- [ ] **Step 4: Write the failing service test**

~~~ts
test("normalises zone and loads the bounded visible range", async () => {
  await listBookingGallery(repository, { month: "2026-09", zone: " พัทยา ", order: "title" });
  assert.deepEqual(repository.galleryBookingsCalls[0].slice(1), ["2026-08-31", "2026-10-12"]);
});
~~~

- [ ] **Step 5: Implement trusted repository/service read**

~~~ts
async galleryHouses(zone: string | null): Promise<BookingGalleryHouse[]> {
  let query = client.from("listings").select("id,property_id,title,location_zone").order("title");
  if (zone) query = query.eq("location_zone", zone);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapBookingGalleryHouse);
}
export async function listBookingGallery(repository: HouseBookingsRepository, raw: unknown) {
  const query = parseBookingGalleryQuery(raw);
  const houses = await repository.galleryHouses(query.zone);
  return buildBookingGallery(houses, await repository.galleryBookings(houses, query.start, query.end));
}
~~~

- [ ] **Step 6: Run focused tests**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery.test.ts tests/booking-gallery-service.test.ts

Expected: PASS for invalid ranges, zones, ordering, cross-month, exclusive checkout, confirmed/waiting/repair/cancelled, and empty houses.

- [ ] **Step 7: Commit**

~~~bash
git add lib/booking-gallery.ts server/repositories/house-bookings.ts server/services/house-bookings.ts tests/booking-gallery.test.ts tests/booking-gallery-service.test.ts
git commit -m "feat: add booking gallery data model"
~~~

### Task 2: Top-level protected route and navigation

**Files:**
- Create: app/admin/bookings/page.tsx
- Create: app/admin/bookings/actions.ts
- Modify: app/admin/layout.tsx
- Modify: components/layout/admin-shell.tsx
- Modify: components/layout/admin-desktop-sidebar.tsx
- Modify: components/layout/admin-mobile-navigation.tsx
- Modify: lib/mobile-navigation.ts
- Modify: tests/admin-sidebar-icons.test.ts
- Modify: tests/booking-gallery-service.test.ts

**Interfaces:**
- Produces listBookingGalleryAction(input): Promise of BookingResult with Gallery cards.
- Adds canUseBooking boolean to shell/mobile permission contracts.

- [ ] **Step 1: Write failing action and navigation tests**

~~~ts
test("Gallery action applies booking guard before repository use", async () => {
  await assert.rejects(() => listBookingGalleryAction({ month: "2026-09", zone: null, order: "title" }), /booking_forbidden/);
});
assert.match(sidebarSource, /CalendarDays[\s\S]*?<span>การจอง<\/span>/);
assert.match(mobileSource, /bookings: CalendarDays/);
assert.match(mobileSource, /canUseBooking/);
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery-service.test.ts tests/admin-sidebar-icons.test.ts

Expected: FAIL because no Gallery action or primary Booking destination exists.

- [ ] **Step 3: Add guarded route/action**

~~~ts
export async function listBookingGalleryAction(input: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    return listBookingGallery(repository, input);
  });
}
export default async function BookingGalleryPage() {
  await requireBookingAdmin();
  return <BookingCalendarGallery />;
}
~~~

- [ ] **Step 4: Thread booking permission through navigation**

~~~tsx
<AdminShell canUseBooking={canUseBooking(adminUser)} /* preserve all existing props */>
{canUseBooking && <Link href="/admin/bookings"><CalendarDays data-icon="inline-start" /><span>การจอง</span></Link>}
~~~

Add the bookings destination and icon only for canUseBooking. Do not change mobile workspace handling or active state of existing house routes.

- [ ] **Step 5: Run tests and commit**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery-service.test.ts tests/admin-sidebar-icons.test.ts tests/house-detail-shell-ui.test.ts

Expected: PASS and legacy page assertions remain unchanged.

~~~bash
git add app/admin/bookings app/admin/layout.tsx components/layout/admin-shell.tsx components/layout/admin-desktop-sidebar.tsx components/layout/admin-mobile-navigation.tsx lib/mobile-navigation.ts tests/admin-sidebar-icons.test.ts tests/booking-gallery-service.test.ts
git commit -m "feat: add booking gallery route and navigation"
~~~

### Task 3: Gallery toolbar and public-calendar-style cards

**Files:**
- Create: components/admin/bookings/booking-calendar-gallery.tsx
- Create: components/admin/bookings/booking-gallery-card.tsx
- Create: components/admin/bookings/booking-gallery-card.css
- Create: tests/booking-gallery-ui.test.ts

**Interfaces:**
- Consumes Task 1 cards and Task 2 action.
- Produces BookingCalendarGallery and selected property/booking state consumed by Task 4.

- [ ] **Step 1: Write failing UI contracts**

~~~ts
assert.match(gallerySource, /listBookingGalleryAction/);
assert.match(gallerySource, /aria-label="เดือนที่แสดง"/);
assert.match(cardSource, /bookingId/);
assert.match(cardSource, /tone === "confirmed"/);
assert.match(cardSource, /tone === "waiting"/);
assert.match(cardSource, /tone === "repair"/);
~~~

- [ ] **Step 2: Run test to verify failure**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery-ui.test.ts

Expected: FAIL because Gallery components do not exist.

- [ ] **Step 3: Implement Gallery state and toolbar**

~~~tsx
const [query, setQuery] = useState<BookingGalleryQuery>(() => currentBangkokGalleryQuery());
const [selected, setSelected] = useState<GallerySelection | null>(null);
const load = useCallback(async () => {
  const result = await listBookingGalleryAction(query);
  if (result.ok) setCards(result.data); else setError(result.message);
}, [query]);
~~~

Implement previous/next/today, zone filtering, title/booked ordering, loading/error/retry/no-result state, and five-to-two responsive grid.

- [ ] **Step 4: Implement an accessible compact card**

~~~tsx
<button type="button" aria-label={card.title + " · " + card.bookedNights + " คืนที่ติดจอง"}
  onClick={() => day.bookingId && onBookingSelect(card.propertyId, day.bookingId)}
  className={cn("booking-gallery-day", "booking-gallery-day-" + day.tone)}>
  {day.date.slice(-2)}
</button>
~~~

Use 7 columns, house title/zone, compact legend, and public-calendar colors. Booked dates open edit; card-level creation opens a new booking for that exact property.

- [ ] **Step 5: Run tests and commit**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery.test.ts tests/booking-gallery-ui.test.ts

Expected: PASS for tone classes, accessibility labels, toolbar, empty gallery.

~~~bash
git add components/admin/bookings tests/booking-gallery-ui.test.ts
git commit -m "feat: render booking calendar gallery"
~~~

### Task 4: Centred modal using existing editor form

**Files:**
- Modify: components/admin/houses/bookings/booking-editor.tsx
- Create: components/admin/bookings/booking-gallery-editor-dialog.tsx
- Modify: components/admin/bookings/booking-skeletons.tsx
- Modify: components/admin/bookings/booking-calendar-gallery.tsx
- Modify: tests/booking-gallery-ui.test.ts
- Modify: tests/house-bookings.test.ts

**Interfaces:**
- Produces exported BookingEditorForm with current FormProps.
- Produces BookingGalleryEditorDialog with propertyId, optional bookingId/initialDate, triggerRef, onClose, onSaved.
- BookingEditor remains the legacy Sheet host.

- [ ] **Step 1: Write failing reuse/modal/regression tests**

~~~ts
assert.match(editorSource, /export function BookingEditorForm/);
assert.match(editorSource, /<SheetContent/);
assert.match(dialogSource, /<Dialog open/);
assert.match(dialogSource, /<BookingDateRange/);
assert.match(dialogSource, /lg:grid-cols-\[/);
assert.match(dialogSource, /triggerRef\.current\?\.focus\(\)/);
~~~

Add a saveHouseBooking assertion that moving checkout preserves price_max, price_sell, and extra_charge.

- [ ] **Step 2: Run tests to verify failure**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery-ui.test.ts tests/house-bookings.test.ts

Expected: FAIL because no exported form and no Gallery Dialog exist.

- [ ] **Step 3: Extract existing editor body without rule changes**

~~~tsx
export function BookingEditorForm(props: FormProps) {
  // Move the current form state, customer picker, date validation, money fields,
  // dirty callbacks, and submit path without changing their semantics.
}
export function BookingEditor(props: EditorProps) {
  return <Sheet open>{/* retain current header, loading/error, cancel/discard Dialogs, and BookingEditorForm */}</Sheet>;
}
~~~

Keep existing parsing and actions; do not duplicate them.

- [ ] **Step 4: Build approved Dialog layout**

~~~tsx
<Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
  <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden p-0">
    <DialogHeader>{/* booking code, cancel, close */}</DialogHeader>
    <div className="grid min-h-0 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)]">
      <BookingStaySection /* existing date range and warning */ />
      <BookingEditorForm /* current customer/status/money/note/save */ />
    </div>
  </DialogContent>
</Dialog>
~~~

Keep one form and save action. Stack on mobile with only modal body scrolling. All inner calls retain propertyId so current house/customer scope checks stay active.

- [ ] **Step 5: Wire refresh and focus restoration**

~~~tsx
onClose={() => {
  setSelected(null);
  requestAnimationFrame(() => triggerRefs.current.get(selectionKey)?.focus());
}}
onSaved={() => { void load(); }}
~~~

- [ ] **Step 6: Run regressions and commit**

Run: node --import ./tests/register-server-only.mjs --test tests/booking-gallery-ui.test.ts tests/house-bookings.test.ts tests/house-booking-service.test.ts tests/booking-availability.test.ts

Expected: PASS for dirty close, focus return, stale/cross-house protection, date conflict, and money retention.

~~~bash
git add components/admin/houses/bookings/booking-editor.tsx components/admin/houses/bookings/booking-skeletons.tsx components/admin/bookings/booking-gallery-editor-dialog.tsx components/admin/bookings/booking-calendar-gallery.tsx tests/booking-gallery-ui.test.ts tests/house-bookings.test.ts
git commit -m "feat: edit gallery bookings in modal"
~~~

### Task 5: Documentation and release verification

**Files:**
- Modify: docs/house-bookings.md
- Modify: tests/booking-gallery.test.ts
- Modify: tests/booking-gallery-ui.test.ts

- [ ] **Step 1: Add legacy route preservation test**

~~~ts
assert.match(legacyPageSource, /<HouseBookingCalendar propertyId=\{house\.property_id\} \/>/);
assert.doesNotMatch(legacyPageSource, /BookingCalendarGallery/);
~~~

- [ ] **Step 2: Document both entry points**

Add:

~~~md
## Calendar Gallery

Open **การจอง** in primary navigation for /admin/bookings. It shows one compact
monthly calendar per house. Selecting a booked date opens the existing booking
form in a centred modal. The per-house route remains available and keeps its
Sheet editor.
~~~

- [ ] **Step 3: Run booking suite**

Run: node --import ./tests/register-server-only.mjs --test tests/house-bookings.test.ts tests/house-booking-service.test.ts tests/booking-availability.test.ts tests/booking-gallery.test.ts tests/booking-gallery-service.test.ts tests/booking-gallery-ui.test.ts tests/admin-sidebar-icons.test.ts

Expected: PASS.

- [ ] **Step 4: Run required checks**

Run: npm run typecheck

Expected: PASS.

Run: npm run lint

Expected: PASS.

Run: npm run build

Expected: PASS.

- [ ] **Step 5: Review and commit**

~~~bash
git diff --check
git status --short
git add docs/house-bookings.md tests/booking-gallery.test.ts tests/booking-gallery-ui.test.ts
git commit -m "docs: document booking calendar gallery"
~~~

## Self-Review

- Tasks 1–3 cover all-house server data, mapping, filters, cards, and navigation.
- Task 4 implements the selected centred modal with stay dates on the left and the unchanged form on the right.
- Task 5 documents and explicitly preserves the existing per-house page.
- All Review Focus risks have a named owning task and executable regression command.
