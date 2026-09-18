# House booking calendar

## Approved behavior

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

Reuse Button, Sheet, Input, Label, Textarea, Alert and Combobox. No installed
calendar component or event-calendar library was found. Recommended: a focused
CSS Grid calendar with pure date and interval helpers. A date-picker alone would
not implement multi-day booking bars; adding an event-calendar dependency is an
alternative requiring separate dependency approval.

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

Editable booking fields are check_in, check_out, status, booking_type, quantity,
price_sell, price_max, deposit_amount, extra_charge, details and note. Preserve
their stored semantics: do not infer a balance or per-night price from column names.
Use price_sell as the displayed sale total with explicit wording. Do not multiply
amounts by nights or quantity. Allowed status/type changes must follow verified
database constraints and existing business rules, not sample values alone.

Support missing customer links. A separate customer section permits selecting a
customer or creating one and linking it, and clearly distinguishes editing a shared
customer record from replacing this booking's customer. Shared edits affect every
booking referencing that customer; show this consequence before saving changes.
The initial form covers name and contact fields; preserve other customer fields
without overwriting them. Broader identity/tax/profile editing is separate scope.
Do not reuse quotation_customers repositories: it is a different customer master.

Validate real dates, checkout after checkin, integer quantity, supported field
lengths, finite monetary values and required customer name/phone on the server.
Handle not-found, permission denial, invalid input and database conflict with
actionable Thai messages. Keep entered values on a save error; disable repeat
submission while pending. Warn before discarding unsaved edits. Refresh calendar
and selected detail only after a successful save.

## Architecture and authorization

Routes and Server Actions live under the bookings route. Components live under
components/admin/houses/bookings. Framework-light contracts, date segmentation
and validation live in lib; orchestration in server/services; queries and RPC
calls in server/repositories. No privileged clients in browser components.

The managed-user tool catalog already defines allow_booking; admin auth does not
yet expose its guard. Add a booking-specific guard once the identity and tenant
mapping below is verified. Do not equate price or house-edit permission with booking
permission. Check authorization and house/customer scope in every read and write,
including direct requests with substituted booking or customer IDs.

Save booking/customer mutations atomically when both change. Use a verified
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
for current foreign keys, checks, indexes, RLS, grants, triggers and RPCs. REST
OpenAPI alone cannot establish those rules. Verify the relationship of users to
seller/customer scope (agent_id, dv_id and mid); do not assume these are equivalent.
Verify booking overlap/capacity rules and cancellation behavior before enforcing
new restrictions. Existing bookings may overlap; the calendar must still render
them. Verify whether price_max and quantity impose additional validation rules.

Capture schema differences in a new migration, never edit historical migrations.
Do not destructively cast legacy UUID booking IDs to bigint. Reconciliation must
preserve existing staging data and dependent records, using an explicit mapping
or reviewed migration strategy after inspecting that data. Test with synthetic
customer data; no production customer data copying is needed.

This design authorizes no Production writes or deployment. Any required Staging
deployment must use the documented staging command and verified target.

## Verification and completion

Test interval segmentation across weeks/months/leap days, exclusive checkout,
overlapping lanes, bookings spanning the entire visible month, and one stable
booking identity across bars. Test preserved totals after date changes, stale
revision rejection, tenant/house/customer substitution denial, null customers,
transaction rollback and audit attribution in a suitable database test setup.
Verify desktop/mobile entry points, Sheet keyboard behavior, pending/error states
and the visible pricing reminder. Run typecheck, lint, relevant Node tests and
build. Update architecture and booking workflow documentation and review the diff.

Calendar creation by clicking empty dates, drag/resize, recurring bookings,
automatic pricing, payments and deletion are outside this first editing flow.
