# House booking calendar implementation plan

> Execute tasks in this session, with independent UI work delegated after contracts are defined.

**Goal:** Implement the approved per-house calendar and edit sheet.
**Architecture:** FullCalendar client view calls authenticated Server Actions; services validate and authorize before repositories use the existing server-only admin client.
**Tech stack:** Next.js, strict TypeScript, FullCalendar 7, shadcn Sheet, Supabase, Node tests.
**Spec:** ../specs/2026-09-18-house-booking-calendar-design.md

## Constraints

- No RLS changes or Production writes/deployment.
- Red confirmed (จองแล้ว), green waiting (รอยืนยัน), gray cancelled.
- Exclusive checkout; one record and total per stay; no automatic repricing.
- Resolve propertyId to listing_id and check houseid; never trust a client-supplied house relationship.
- Require a verified session and trusted allow_booking on every request.
- Existing Staging schema differs; report unavailable integration honestly and preserve legacy data.
- The user approved all-house access for authenticated allow_booking operators.

## 1. Contracts and service rules

- [x] Create lib/house-bookings.ts with Booking, BookingCustomer, BookingUpdate contracts and date/amount validation.
- [x] Write tests/house-bookings.test.ts first: invalid dates, same-day checkout, preserved amounts, unknown status, invalid IDs and stale revision.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/house-bookings.test.ts`; observe failure, implement and rerun.
- [x] Add canUseBooking to server/auth/admin.ts and a verified-identity guard in server/auth/bookings.ts. Test false/missing permissions and booking-only house-list access.

## 2. Repository and actions

- [x] Inspect live schema read-only; preserve database checks and triggers.
- [x] Create server/repositories/house-bookings.ts: list by resolved house and intersecting date range, fetch one scoped record, search customers with pagination/limits, update only allowlisted fields using expected updated_at.
- [x] Create server/services/house-bookings.ts for validated orchestration and safe errors; no schema details or secrets in responses.
- [x] Create app/admin/houses/[propertyId]/bookings/actions.ts; return a discriminated result after guard success, validate runtime input and revalidate after writes.
- [x] Test cross-house IDs, unauthorized requests, stale edits, range boundaries and database error mapping using transport doubles where the external database is required.
- [x] Do not add a multi-table transaction or customer-master editing unless its database prerequisites can be verified; the approved mockup changes the linked customer only.

## 3. Calendar and editor

- [x] Create components/admin/houses/bookings/booking-calendar.tsx, booking-editor.tsx and booking-calendar.css.
- [x] Use FullCalendar v7 DayGrid and official theme imports; stable booking ID, allDay=true, start=check_in, end=check_out.
- [x] Map visible-range changes to list action; suppress stale responses and show retry/error/loading states.
- [x] Sheet loads record on click. Edit dates, status, quantity, total, deposit, extra and note; retain untouched fields. Customer replacement is explicit.
- [x] Warn on date changes and unsaved close; keep inputs on save error; refresh after success. Prevent duplicated submits.
- [x] Verify month crossing, keyboard focus, small-screen layout and manually retained total.

## 4. Route and navigation

- [x] Add app/admin/houses/[propertyId]/bookings/page.tsx using HouseTaskHeader and HouseWorkspaceShell.
- [x] Add gated booking links to both desktop and mobile HouseList actions and house task navigation.
- [x] Extend house-list access/navigation to allow_booking without granting house-edit/price privileges.
- [x] Keep validated returnTo links.

## 5. Review and verification

- [x] Review diff for privileged access, input validation, unintentional database changes and interaction regressions.
- [x] Run typecheck, lint, relevant tests, full tests and build. Restore build-generated public/sw.js only if changed solely by this build.
- [x] Document the workflow, schema prerequisites and actual integration checks performed.
- [x] Do not claim database writes verified without an authorized suitable test environment.

## Execution result

Implemented and reviewed locally. Typecheck, lint and build passed; full Node suite 641 passed, plus 5 isolated PostgreSQL RPC tests. Actual React components checked in a browser with synthetic actions, including a 320px sheet and retained total after date change.

The user approved all-house access; the temporary scope configuration gate has been removed. Staging schema reconciliation and RPC deployment completed after empty-table verification, local migration tests and a rollback-only Staging save/audit test. Original RLS and policies remain unchanged. Staging web deployed as version 3cbd55e9-7081-4356-9d6a-23029e67db97; Production untouched. See docs/house-bookings.md for smoke checks and the absence of Staging house/booking data.
