# House booking calendar

Open **การจอง** from the desktop or mobile actions for a house. The route is
`/admin/houses/[propertyId]/bookings`. It uses the existing House Workspace Shell.

- Confirmed is red (จองแล้ว), waiting is green (รอยืนยัน). Cancelled bookings are excluded from the calendar response and legend; records remain in the database. Cancelling through the editor removes the event after save and refresh.
- Status is the saved `bookings.status`; deposits do not change status automatically.
- One bar represents one booking. Checkout is exclusive. Cross-week/month stays
  keep the same record and total.
- Click a bar to edit dates, linked customer, status, quantity, full house price (`price_max`), required deposit (`price_sell`),
  extra charge and note. Changing dates preserves all amounts and displays a warning.
- The approved mockup replaces an existing customer link; creating/editing the
  shared customer master is not part of this first editor. Unedited booking fields
  such as deposit_amount, details, booking_type, house linkage and agent_id are preserved.
- The sheet warns on unsaved close and shows errors without discarding input.

## Calendar Gallery

Open **การจอง** in the primary admin navigation for `/admin/bookings`. This
shows one monthly calendar per house, including houses without bookings. Search
by house title substring or exact raw/DV-prefixed property ID; six matching
houses appear per server page with an exact total count. The
grid has three columns on desktop and one on mobile. Each card has its own Thai
month heading and previous/next controls, so houses can display different
months. Select a booked date to edit it, an available future date to start a
booking, or the card's **สร้างการจอง** action to create one without a date.

The Gallery opens the existing booking form in a centred modal over the dimmed
calendar. Stay dates and availability appear on the left, with customer, status,
money and notes on the right. On narrow screens the modal fills the width and
stacks the stay section above the other fields in a scrollable view. The same
validation, save/cancel actions, stale-revision and overlap protection, and
unsaved-change confirmation apply. Closing returns focus to the selected card
control or search field. A successful save or cancellation invalidates every
cached month for that house, including cross-month stays, and reloads its
currently visible month. Other houses do not refetch for that mutation.
If a month fails to load, its card shows an error and **ลองอีกครั้ง** instead
of stale availability. Editor errors keep entered values available
for correction and retry.

The per-house route `/admin/houses/[propertyId]/bookings` remains available
from house navigation. It keeps the House Workspace Shell, full house calendar,
and Sheet editor. The Gallery adds a second entry point and does not replace
this workflow.

Confirmed dates are red, waiting dates green, and repair dates have a separate
state. The user approved deferring yellow holiday dates until an authoritative
holiday source is available; the Gallery uses actual booking statuses for now.
An unrecognized saved status other than `cancelled`
appears as a neutral **สถานะไม่ทราบ (ติดจอง)** date with a booking edit target,
matching the availability rule that treats it as occupied until corrected.
Card headers show the house title, DV ID and the saved listing `is_active` status
(เปิดใช้งาน / ปิดใช้งาน; missing status shows ไม่ทราบสถานะ). Both active and inactive
houses remain visible, without changing booking permissions. Province/zone and
booked-night counts are not displayed. Checkout remains exclusive. Unbooked dates
display as free. Both routes use
the existing booking permissions, service and repository paths. This addition
requires no database schema or RLS change.

The Gallery reads metadata and availability through separate authorized
actions. Calendar requests contain one to six validated property IDs and one
month. The repository resolves their listing IDs, selects only
`id,listing_id,houseid,check_in,check_out,status` from bookings, filters exact
listing/property pairs, and paginates dense results in 500-row batches. The
client caches up to 24 house/month pairs for 30 seconds; late responses cannot
restore data invalidated by a save. Search waits 250 ms before requesting a
page, and the existing editor is loaded only when selected. The page uses the
database's numeric property ID ascending order before six-house pagination,
including search results. Six card skeletons reserve the loading page layout;
individual calendar loading replaces only that card's date grid with a skeleton.
Skeletons announce loading, contain no fake interactive dates and respect reduced motion.
Partial numeric ID search would require a
database cast or index and is not part of this bounded query.

## Access and data flow

The shared booking form displays a read-only **ข้อมูลที่พัก** panel below the
stay dates (left column in the Gallery dialog). On form mount it requests only
`listings.extra_beds`, `insurance_fee`, `checkin_time`, and `checkout_time` for
the validated property ID through a booking-authorized server action. Extra-bed
price is labelled ราคาคนเสริม. These are current house settings, not historical
booking snapshots; they are never included in booking totals or save payloads.
Missing values show ไม่ระบุ, zero amounts remain 0 บาท, and local times show
HH:mm without timezone conversion. Loading/error/retry is local to this panel
and does not block the booking form. Gallery list/calendar queries are unchanged.

Every action verifies the Supabase session, then loads `users.allow_tools` by
`uid` using the server-only admin client. Only explicit `allow_booking: true`
permits booking operations; email fallback is not used at this privileged boundary.
The existing admin house-list/navigation also recognizes booking-only users.

The user approved all-house access. An authenticated operator with explicit
allow_booking may manage bookings for every house and select existing customers
globally. No additional scope environment variable is required. Every detail read
and edit still checks that the booking belongs to the house opened in the route.

Server Actions -> booking services -> booking repositories -> Supabase admin
client. The server resolves property_id and verifies both listing_id and houseid
for detail reads and edits. Reads load only the fields needed by the UI, not
customer identity documents, tax data or addresses.

The `admin_update_house_booking` RPC is executable only by service_role. It does
not perform user permission checks: those belong to the web server. It locks the
booking, verifies the expected updated_at and house relationship, allowlists
fields, and preserves the existing overlap constraint and audit trigger. It sets
the transaction-local JWT subject to the verified actor so the existing audit
trigger records that user once, then restores the prior subject. No RLS changes.

## Database readiness

Read-only Production metadata inspection confirmed an exclusion constraint on
listing_id and daterange(check_in, check_out, '[)'), except cancelled/rejected
bookings. The existing `trigger_booking_audit_log` writes old/new data and uses
auth.uid(). Neither was changed.

Staging was upgraded on 2026-09-18 after confirming bookings and booking_logs
were empty. Migration 20260918090000 locks and refuses populated legacy tables,
converts empty UUID IDs to bigint, adds missing fields/customer linkage, and
preserves table identities and existing RLS. New customers are granted only to
service_role, including when default privileges would otherwise expose them.
Migration 20260918100000 adds the update RPC. Migration 20260918110000 removes
an auth.users read that service_role cannot perform; the audit FK validates actor
existence. All three migrations were applied only to Staging.

A Staging transaction tested the RPC under service_role with a synthetic house
and booking, verified preserved total and exactly one correctly attributed audit
update, then rolled back all test rows. Original bookings/logs RLS remains enabled
with unchanged policy counts. Missing schema/RPC returns a controlled error.
Production has not been modified.

## Verification

- `node --import ./tests/register-server-only.mjs --test tests/house-bookings.test.ts tests/house-booking-service.test.ts`
- Set `RUN_BOOKING_DB_TESTS=1` and run the same command with
  `tests/house-booking-database.test.ts`. It launches and removes a private
  `postgres:17-alpine` Docker container, with synthetic records and no host port.
  It never reads Supabase environment files or contacts a deployed database.
- The database test checks service-only execution, substituted houses, stale
  revisions, preserved totals, actor attribution, single audit entry and overlap
  rollback. Its audit trigger is a focused fixture, not the deployed trigger.
- Browser verification used the actual calendar/editor components with local
  fixture actions: confirmed red, waiting green, 5 -> 6 nights with total 30000
  unchanged, successful fixture save, and a 320px mobile sheet with no field overflow.
- Run `npm run build:pwa` before full tests because the checked-in Service
  Worker includes a source revision. Keep its regenerated output with the
  feature.

The legacy-upgrade Docker test also checks populated-table refusal, RLS retention,
customer privilege isolation and idempotence. Run tests/legacy-booking-upgrade.test.ts
with RUN_BOOKING_DB_TESTS=1.

## Staging deployment (2026-09-18)

Deployed via npm run deploy:cf:staging to
https://webook-staging.chaymanus2003.workers.dev, version
3cbd55e9-7081-4356-9d6a-23029e67db97, account
0df55f166fa309dcc904e992c43f86db. Compiled bundle: 12 files with the Staging
Supabase reference and zero with the Production reference. Login returned 200;
unauthenticated house-list and booking requests returned 307 to /login.

Staging currently has no houses or bookings. Synthetic integration data was
rolled back; no demo records or account permission changes were left behind.
Authenticated browser testing against deployed data has not been performed.

Verification: typecheck/lint passed; Node suite 641 passed with one opt-in test
skipped; all 6 explicit Docker database tests passed.

## Money fields correction

`price_max` is the full house price; `price_sell` is the required deposit, not money already received. `deposit_amount` is not shown, calculated or sent for editing; its stored value is preserved. A missing full price remains null until entered. Dates never multiply these booking amounts. Migration 20260918120000 updates the RPC allowlist without modifying RLS; apply it before deploying this editor update.

Correction verification: npm run build and npm run verify passed (642 tests passed, one opt-in test skipped). Six isolated PostgreSQL RPC tests passed, including preservation of a nonzero deposit_amount and rejection of attempts to edit it. The correction migration was subsequently applied to Staging only; see deployment verification below.

### Money correction deployed to Staging (2026-09-18)

Migration 20260918120000 applied to sxvkhzhqtrpxgzumsswl. A rollback-only service_role transaction saved price_max=6900 and price_sell=3900 while preserving deposit_amount=1234, verified one attributed audit update, and left zero fixture rows. RLS was unchanged.

Deployed via npm run deploy:cf:staging, version 0e8ac004-aab9-4ad9-b453-288ba57e5cd1. Bundle verification found 12 files containing the Staging reference and zero containing the Production reference. Login returned 200; unauthenticated house routes redirected to login. Staging still has no bookings, so authenticated booking-screen testing with hosted records remains unverified. Production was not changed.

### Staging demo data (2026-09-18)

At user request, seeded 10 synthetic houses (property_id 1–10), 20 synthetic customers, and 50 bookings dated September 18–October 8, 2026. Each house has two confirmed, two waiting and one cancelled booking, including a five-night cross-month stay. Customer names are fictional, phones use a 000000 prefix, and email addresses use example.invalid. Marker: STAGING-DEMO-20260918; booking prefix: DEMO-202609-H. No Production data was copied. price_max is full stay cost and price_sell the required deposit; deposit_amount retains its default zero. This supersedes the earlier empty-Staging notes. Only data changed, so no build or deployment was required.

### Shared shell navigation

The booking page uses HouseDetailSectionNav from the house detail page, including mobile active-item scrolling, with bookings selected. It uses the same viewport height, sidebar title and shell-owned content padding. Only calendar content and its task header change.

Shell correction deployed to Staging as 22ea42ab-444f-4df1-9ab6-73cbe74a76f6. Build, typecheck, lint and 642 tests passed (one opt-in skipped). Independent static review passed. Authenticated browser verification confirmed the shared sidebar, active booking item and seeded calendar events. Bundle contains Staging references only.

The booking calendar now fills the remaining workspace height on desktop and mobile. FullCalendar uses height=100% and one visible event per day with overflow links so the whole month fits without scrolling the calendar body.

Viewport fit deployed to Staging version 3e7e09aa-d4af-47f4-8e54-4693918b1afc. Verified September six-week calendar with seeded events at desktop 1280x720 (scroller 293/293px) and mobile 375x667 (312/312px), with no calendar overflow. Mobile shell uses explicit auto/minmax grid rows and accommodates the hidden content header. Build and lint passed; suite 642 passed with one opt-in skipped.

Unsaved booking edits use the existing shadcn Dialog for close/cancel confirmation. The safe default returns to editing; Escape also keeps edits. Only explicit discard closes the editor. Browser/tab unload retains the native beforeunload guard, which cannot use an in-page modal.

Unsaved-edit modal deployed to Staging version b5710260-73f8-4741-b9ed-e35b2fe2d78c. Build/typecheck/lint and 642 tests passed (one opt-in skipped). Authenticated browser verified opening the shadcn modal, safe initial focus, keeping edited text on cancel, and explicit discard returning focus to the booking. No test edit was saved.

Booking saves use the existing Sonner success toast with concise text. No persistent success message is rendered inside the calendar, preserving its available height.

`bookings.quantity` is the number of nights (exclusive checkout minus check-in). The editor displays it read-only and recalculates on date edits; server validation independently derives it, ignoring submitted quantities. Existing mismatches can be corrected by saving without changing other fields. Money remains unchanged.

Night quantity deployed to Staging d87a2cde-c406-43b4-b28d-c225b991d954. Corrected 40 marked demo records; all 50 now match date differences. Build/typecheck/lint and 643 tests passed (one opt-in skipped), including cross-month and leap-day calculations and ignoring client quantities. Production unchanged.
