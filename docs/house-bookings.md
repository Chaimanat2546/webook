# House bookings

Booking management lives at `/admin/bookings`. The retired
`/admin/houses/[propertyId]/bookings` page has been removed with no redirect;
old URLs return 404. Booking links have been removed from house-list actions and
the house workspace navigation. Other house workspace sections are unchanged.

Shared booking forms and the authorized Server Actions in the old route folder
remain in use by the Gallery. No booking data, validation, or permission checks
were removed. The old calendar loading screen has been removed.

## Calendar Gallery

Open **การจอง**, the first permitted destination in both the desktop sidebar and
mobile navigation, for `/admin/bookings`. Existing permission checks still apply. This
shows one monthly calendar per house, including houses without bookings. Search
using the **DV ID** (default) or **ชื่อบ้าน** radio option. DV ID matches an exact
raw/DV-prefixed property ID; invalid IDs return no results. ชื่อบ้าน matches only
a house-title substring. Switching modes preserves the search text and resets
pagination to page 1; request identity includes the mode to discard stale results.
Six matching
houses appear per server page; the exact total count is used for pagination but
no result-count text is displayed. Active houses come first, then inactive, then
unknown-status houses, with numeric DV ID ascending within each group. Sorting
happens before pagination. Inactive and unknown-status cards remain visible, but
all their buttons (dates, month arrows, retry, and create) are disabled. The
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
display as free. The Gallery uses
the existing booking permissions, service and repository paths. This addition
requires no database schema or RLS change.

The Gallery reads metadata and availability through separate authorized
actions. Calendar requests contain one to six validated property IDs and one
month. The repository resolves their listing IDs, selects only
`id,listing_id,houseid,check_in,check_out,status` from bookings, filters exact
listing/property pairs, and paginates dense results in 500-row batches. The
client caches up to 24 house/month pairs for the current gallery session; it
reloads only for an initial page/search, a per-house month change, an explicit
retry, or after saving that house. Late responses cannot restore data
invalidated by a save. Search waits 250 ms before requesting a page, and the
existing editor is loaded only when selected. The page uses the
database's active-first, numeric property ID ascending order before six-house pagination,
including search results. Six card skeletons reserve the loading page layout;
individual calendar loading replaces only that card's date grid with a skeleton.
Skeletons announce loading, contain no fake interactive dates and respect reduced motion.
Partial numeric ID search would require a
database cast or index and is not part of this bounded query.

## Access and data flow

The shared booking form displays an editable **ข้อมูลที่พัก** panel above the
booking totals (right column in the Gallery dialog; after status and nights on mobile).
For **ปิดซ่อม/ปรับปรุง**, this panel and the Agency selector are hidden; the
editor does not submit a new Agent assignment while saving that status.
Only when creating a booking, the repository reads
`listings.insurance`, `listings.extra_person`, `listings.checkin_time`, and
`listings.checkout_time`, mapping them respectively to `bookings.insurance`,
`bookings.extra_person`, `bookings.checkin_time`, and `bookings.checkout_time`.
Those four values are inserted as a booking snapshot. When editing an existing
booking, the panel reads and writes the saved booking values only; it never loads
listing defaults and never writes to a listing or house. Thus changing ราคาคนเสริม,
ประกันที่พัก, เวลาเช็คอิน, or เวลาเช็คเอาท์ does not change source accommodation data.
These fields are not included in booking totals. Missing values show ไม่ระบุ, zero
amounts remain 0 บาท, and local times show HH:mm without timezone conversion.
Loading/error/retry is local to create mode and does not block the booking form.
Gallery list/calendar queries are unchanged.

Every action verifies the Supabase session, then loads `users.allow_tools` by
`uid` using the server-only admin client. Only explicit `allow_booking: true`
permits booking operations; email fallback is not used at this privileged boundary.
The existing admin house-list/navigation also recognizes booking-only users.

The user approved all-house access. An authenticated operator with explicit
allow_booking may manage bookings for every house and select existing customers
globally. No additional scope environment variable is required. Every detail read
and edit still checks that the booking belongs to the house opened in the route.

Administrators (role ID `1`) additionally see the native **เอเจนซี่** selector
directly above the customer selector. It lists active agencies by name, includes
**ไม่ระบุเอเจนซี่**, and saves the selected UUID `agents.id` in
`bookings.agent_id`. Other booking operators neither receive agency choices nor
send an `agent_id` value, so an existing historic agency assignment is preserved.
The service and RPC independently require role ID `1` for an explicit agency
change and reject inactive or unknown agencies. The direct UUID migration keeps
Agent identities unchanged, uses `ON DELETE SET NULL` for the booking foreign
key, and clears legacy numeric booking Agent values because they cannot be
mapped to a UUID safely.

Server Actions -> booking services -> booking repositories -> Supabase admin
client. The server resolves property_id and verifies both listing_id and houseid
for detail reads and edits. Reads load only the fields needed by the UI, not
customer identity documents, tax data or addresses.

The `admin_create_house_booking` and `admin_update_house_booking` RPCs are
executable only by service_role. They lock/idempotently create as appropriate,
verify the expected revision and house relationship, and allowlist the four
booking snapshot fields, the optional `agent_id`, and the ordinary booking fields. They reject
legacy booking keys `insurance_fee` and `extra_beds`. The update RPC preserves
the existing overlap constraint and audit trigger. Both set the transaction-local
JWT subject to the verified actor, then restore the prior subject. No RLS changes.

## Database readiness

The Production schema inspected on 2026-09-29 has `bookings.insurance` and
`bookings.extra_person`, while the two booking time columns are absent. Its current
RPCs do not accept the four snapshot keys. The forward migration
`20260929140000_booking_house_information_snapshot.sql` adds only the two nullable
time columns and replaces those two RPC bodies. Before applying it or deploying,
inspect Production metadata again, summarize the result, and obtain explicit
confirmation. Production is not modified by this repository change.

The same Production inspection found `agents.id` and `agent_accounts.agent_id`
as UUID values but `bookings.agent_id` as a nullable bigint without a foreign key.
The direct migration `20260929150000_booking_agent_numeric_id.sql` changes only
`bookings.agent_id` from bigint to UUID, adds its `ON DELETE SET NULL` foreign
key, and adds optional agency handling to both booking RPCs. It never changes
Agent or Agent Account UUID identities. Legacy numeric booking Agent values are
cleared because no trustworthy UUID mapping exists. Version
`20260929160000_restore_booking_agent_uuid.sql` is a no-op retained solely for
Staging history compatibility. Apply Production migrations only after a fresh
Production-schema summary and explicit confirmation.

## Verification

- `node --import ./tests/register-server-only.mjs --test tests/house-bookings.test.ts tests/house-booking-service.test.ts`
- Set `RUN_BOOKING_DB_TESTS=1` and run the same command with
  `tests/house-booking-database.test.ts`. It launches and removes a private
  `postgres:17-alpine` Docker container, with synthetic records and no host port.
  It never reads Supabase environment files or contacts a deployed database.
- The database test checks service-only execution, substituted houses, stale
  revisions, Production-named snapshot values, idempotent creation, preserved
  totals, actor attribution, single audit entry and overlap rollback. Its audit
  trigger is a focused fixture, not the deployed trigger.
- Browser verification used the actual calendar/editor components with local
  fixture actions: confirmed red, waiting green, 5 -> 6 nights with total 30000
  unchanged, successful fixture save, and a 320px mobile sheet with no field overflow.
- Run `npm run build:pwa` before full tests because the checked-in Service
  Worker includes a source revision. Keep its regenerated output with the
  feature.

### Shared shell navigation

The booking page uses HouseDetailSectionNav from the house detail page, including mobile active-item scrolling, with bookings selected. It uses the same viewport height, sidebar title and shell-owned content padding. Only calendar content and its task header change.

The booking calendar now fills the remaining workspace height on desktop and mobile. FullCalendar uses height=100% and one visible event per day with overflow links so the whole month fits without scrolling the calendar body.

Unsaved booking edits use the existing shadcn Dialog for close/cancel confirmation. The safe default returns to editing; Escape also keeps edits. Only explicit discard closes the editor. Browser/tab unload retains the native beforeunload guard, which cannot use an in-page modal.

Booking saves use the existing Sonner success toast with concise text. No persistent success message is rendered inside the calendar, preserving its available height.

`bookings.quantity` is the number of nights (exclusive checkout minus check-in). The editor displays it read-only and recalculates on date edits; server validation independently derives it, ignoring submitted quantities. Existing mismatches can be corrected by saving without changing other fields. Money remains unchanged.
