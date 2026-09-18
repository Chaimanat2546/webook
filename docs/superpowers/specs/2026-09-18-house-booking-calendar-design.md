# House booking calendar

## Approved behavior

The approved interactive mockup is authoritative for the first editor: red means
confirmed (จองแล้ว), green means waiting (รอยืนยัน), gray means cancelled. Status
is selected by staff, never inferred from payment amounts.

Enter bookings from each house's actions in the house list. Open
`/admin/houses/[propertyId]/bookings` as a monthly calendar for that house.
Click a booking bar to edit the booking in a side sheet, full width on mobile.
One booking covers the entire stay and has one total, even across weeks or months.
Changing dates preserves all amounts. Show “ช่วงวันเข้าพักเปลี่ยนแล้ว โปรดตรวจสอบยอดเงิน”.
Staff edit amounts manually; there is no automatic repricing.

`bookings.houseid` corresponds to `listings.property_id`; `listing_id` references
`listings.id`. The server resolves and checks both against the selected house.

## Layout and component reuse

Use HouseTaskHeader, HouseWorkspaceShell and HouseWorkspaceNavItem. This is the
per-house workspace agreed in the conversation. Keep the existing 16rem desktop
sidebar, horizontal mobile navigation, and content-owned scroll. Add การจอง to
the house actions on desktop and mobile and to the relevant house navigation.
Preserve the house-list return URL and its filters through validated local links.

Reuse Button, Sheet, Input, Label, Textarea, Alert and Combobox. The user approved
adding a calendar dependency. Use @fullcalendar/react 7.1.0 and temporal-polyfill
with the bundled @fullcalendar/react/daygrid plugin. This MIT-licensed package
supports React 17–19. Do not mix its v7 API with the separate v6 daygrid package.
Follow the v7 theme and stylesheet imports and adapt colors to existing app tokens.
Reference: https://fullcalendar.io/docs/react

FullCalendar owns month layout, clipping and lanes. Map each booking to one all-day
event with its stable ID, start=check_in and exclusive end=check_out. eventClick
opens the editor; drag/resize remains disabled. No premium scheduler is needed.

The toolbar provides previous/next month and today, plus a visible month label.
Use date-only arithmetic and Bangkok's current date, avoiding timezone shifts.
Each week has seven columns and event lanes. Clip each booking interval to each
week and the visible grid, retaining one stable booking ID across segments.
Checkout is exclusive: a 10–13 October stay occupies the nights of 10, 11 and 12.
Load intervals intersecting the whole visible grid, including spillover dates.
Place intersecting bars in separate lanes; never hide a booking behind another.
Use status text as well as color. Buttons have keyboard support and accessible
names including booking code and full stay dates. Mobile may scroll the calendar
horizontally within its content area to keep day cells and event targets readable.

## Editor and data contracts

Load full booking details only after selection, scoped to the current house.
Display the booking code, selected house, stay, number of nights, linked customer,
status, booking type, quantity, amounts, details and note. Keep system identifiers,
creation metadata and house linkage out of editable inputs.

Editable booking fields are check_in, check_out, status, quantity,
price_max, price_sell, extra_charge and note. Preserve
their stored semantics: do not infer a balance or per-night price from column names.
Use price_max as the full house price and price_sell as the required deposit. Do not multiply
amounts by nights or quantity. Allowed status/type changes must follow verified
database constraints and existing business rules, not sample values alone.

Support missing customer links. As approved in the mockup, a separate customer
section permits selecting an existing customer or clearing the link. Do not edit
or create shared customer records in this first editor. Preserve booking_type,
deposit_amount, details and all customer-master fields without overwriting them.
Broader customer profile editing is separate scope.
Do not reuse quotation_customers repositories: it is a different customer master.

Validate real dates, checkout after checkin, integer quantity, supported field
lengths, finite monetary values and required customer name/phone on the server.
Handle not-found, permission denial, invalid input and database conflict with
actionable Thai messages. Keep entered values on a save error; disable repeat
submission while pending. Warn before discarding unsaved edits. Refresh calendar
and selected detail only after a successful save.

## Architecture and authorization

Routes and Server Actions live under the bookings route. Components live under
components/admin/houses/bookings. Framework-light contracts, calendar event mapping
and validation live in lib; orchestration in server/services; queries and RPC
calls in server/repositories. No privileged clients in browser components.

The user requires application-side authorization with no RLS changes. Do not
create, alter or disable RLS policies for this feature. Add a booking-specific
server guard that verifies the session and loads permissions from trusted server
data, requiring allow_tools.allow_booking === true before every calendar, booking
detail, customer read or mutation. Hiding menus is not sufficient. Never accept
permission flags from the client or substitute price/house-edit permission.

After authorization, repositories use the existing server-only Supabase admin
client so the flow does not depend on authenticated-role RLS grants. Credentials
never reach the browser. Enforce house/customer scope in application code, including
direct requests with substituted IDs. The user approved all-house access for
authenticated operators with allow_booking; no seller restriction or additional
scope environment variable is required. Preserve database integrity
constraints and audit behavior; only access authorization belongs to the web layer.

Save booking fields and its customer link atomically. Use a verified
database transaction/RPC, an expected revision check to reject stale edits, and
consistent audit attribution to the authenticated user. Check existing audit
triggers before adding any new logging to prevent duplicate booking_logs entries.

## Database prerequisites

Read-only inspection on 2026-09-18 found Production has bigint booking IDs,
listing_id, customer_id, booking_code and customers. Staging still exposes the
older UUID bookings with listings_id/codebooking and no customers in REST schema.
The repository baseline is also old. Production contains 7 bookings, 4 without a
customer link, and 14 INSERT/UPDATE booking logs at inspection time.

Before writing a migration or enabling mutations, obtain authoritative metadata
for current foreign keys, checks, indexes, triggers and RPCs. RLS stays unchanged. REST
OpenAPI alone cannot establish those rules. The approved access scope covers all
houses; agent_id, dv_id and mid are not used as seller restrictions.
Verify booking overlap/capacity rules and cancellation behavior before enforcing
new restrictions. Existing bookings may overlap; the calendar must still render
them. Verify whether price_max and quantity impose additional validation rules.

Capture structural schema differences in a new migration, never edit historical
migrations or include RLS changes.
Do not destructively cast legacy UUID booking IDs to bigint. Reconciliation must
preserve existing staging data and dependent records, using an explicit mapping
or reviewed migration strategy after inspecting that data. Test with synthetic
customer data; no production customer data copying is needed.

This design authorizes no Production writes or deployment. Any required Staging
deployment must use the documented staging command and verified target.

## Verification and completion

Test event mapping and rendered spans across weeks/months/leap days, exclusive checkout,
overlapping lanes, bookings spanning the entire visible month, and one stable
booking identity across bars. Test preserved totals after date changes, stale
revision rejection, unauthenticated or missing/false allow_booking denial,
tenant/house/customer substitution denial, null customers,
transaction rollback and audit attribution in a suitable database test setup.
Verify desktop/mobile entry points, Sheet keyboard behavior, pending/error states
and the visible pricing reminder. Run typecheck, lint, relevant Node tests and
build. Update architecture and booking workflow documentation and review the diff.

Calendar creation by clicking empty dates, drag/resize, recurring bookings,
automatic pricing, payments and deletion are outside this first editing flow.
