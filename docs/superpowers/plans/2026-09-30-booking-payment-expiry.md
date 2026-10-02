# Booking Payment Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators set a payment deadline on waiting bookings, default it to ten minutes, and automatically cancel expired bookings.

**Architecture:** A nullable UTC `payment_expires_at` flows through the existing booking contract and RPCs. A service-role-only RPC atomically cancels due waiting bookings; a custom OpenNext Worker forwards normal requests and invokes that RPC on a Cloudflare Cron trigger every minute.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase PostgreSQL/RPC, Cloudflare Workers/OpenNext, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-30-booking-payment-expiry-design.md`

## Global Constraints

- Store and compare timestamps as UTC `timestamptz`; present them in Asia/Bangkok.
- New waiting bookings default to ten minutes after creation if no deadline is supplied.
- Only waiting bookings retain a deadline; all other statuses save null.
- The once-per-minute sweep must be idempotent under duplicate Cron delivery.
- Never expose Supabase service-role credentials to client code.
- Add a migration; never edit a previous migration.
- Do not deploy Production. If Staging deployment is requested, use `npm run deploy:cf:staging`.

## Review Focus

- Legacy waiting records with no deadline remain waiting; Task 1 and Task 2 test this.
- Moving from waiting to confirmed, repair, or cancelled clears the deadline; Task 1 and Task 3 test this.
- An expired browser-submitted timestamp is rejected by the database RPC; Task 2 tests this.
- A duplicate Cron event does not cancel a confirmed or newly extended booking; Task 2 tests this.
- Bangkok local input round-trips to the exact UTC instant; Task 3 tests this.

---

## File Structure

- `lib/booking-payment-expiry.ts`: Bangkok input conversions and a ten-minute default helper.
- `lib/house-bookings.ts`: booking types and validation.
- `server/repositories/house-bookings.ts`: booking select/map/RPC payload updates.
- `server/repositories/booking-expiry.ts`: service-role expiry RPC adapter.
- `supabase/migrations/20260930100000_booking_payment_expiry.sql`: column, index, RPC rules, and grants.
- `components/admin/houses/bookings/booking-editor.tsx`: waiting-only deadline control.
- `worker.ts`: custom OpenNext fetch and scheduled handlers.
- `wrangler.jsonc`, `wrangler.staging.jsonc`: custom entry point and `* * * * *` Cron trigger.

### Task 1: Payment-expiry contract and booking mapping

**Files:**
- Create: `lib/booking-payment-expiry.ts`
- Modify: `lib/house-bookings.ts`, `server/repositories/house-bookings.ts`
- Test: `tests/house-bookings.test.ts`, `tests/booking-house-information-override.test.ts`

**Interfaces:**
- Produces `defaultPaymentExpiry(now: Date): string`, `paymentExpiryFromBangkokLocal(value: string): string`, and `paymentExpiryToBangkokLocal(value: string | null): string`.
- Extends `Booking`, `BookingUpdate`, and `BookingCreate` with `payment_expires_at: string | null`.

- [ ] Write failing tests that a valid waiting deadline is retained, non-waiting statuses normalize it to null, Bangkok local time converts to UTC, and the repository forwards `payment_expires_at` in `p_values`.
- [ ] Run `npm test -- tests/house-bookings.test.ts tests/booking-house-information-override.test.ts`; confirm the new assertions fail because the contract has no deadline.
- [ ] Implement strict timestamp parsing, ten-minute default computation, type additions, selection/mapping, and create/update RPC payload forwarding. Preserve null for legacy rows.
- [ ] Run the focused tests again; confirm they pass.
- [ ] Commit: `feat: add booking payment expiry contract`.

### Task 2: Database rules and atomic expiry RPC

**Files:**
- Create: `supabase/migrations/20260930100000_booking_payment_expiry.sql`, `server/repositories/booking-expiry.ts`, `tests/booking-payment-expiry-migration.test.ts`
- Modify: `tests/house-booking-database.test.ts`, `tests/booking-house-information-override.test.ts`

**Interfaces:**
- Produces `expireWaitingBookings(client: SupabaseClient): Promise<number>`.
- Creates `public.admin_expire_waiting_bookings(p_limit integer default 500) returns integer`, executable only by `service_role`.

- [ ] Write failing static migration tests asserting the nullable timestamp, waiting-only index, JSON allowlists, service-role-only grant, and `status = 'waiting' and payment_expires_at <= clock_timestamp()` update predicate. Add a mocked repository test that returns the RPC count.
- [ ] Run `npm test -- tests/booking-payment-expiry-migration.test.ts tests/booking-house-information-override.test.ts`; confirm it fails because the migration and adapter do not exist.
- [ ] Add the migration. In replacement create/update RPCs, accept `payment_expires_at`; reject explicit past waiting deadlines; default missing new waiting values with `clock_timestamp() + interval '10 minutes'`; persist null for every non-waiting status. Implement the bounded `FOR UPDATE SKIP LOCKED` expiry RPC, repeating its waiting/due predicate in the update and setting `updated_at`.
- [ ] Extend opt-in PostgreSQL coverage: verify default creation, clearing on confirmation, expired-input rejection, and repeated sweeps affecting only a due waiting record. Run `set RUN_BOOKING_DB_TESTS=1 && npm test -- tests/house-booking-database.test.ts`; report a skip if Docker is unavailable.
- [ ] Re-run focused static tests; confirm they pass.
- [ ] Commit: `feat: expire overdue waiting bookings`.

### Task 3: Waiting booking editor

**Files:**
- Modify: `components/admin/houses/bookings/booking-editor.tsx`
- Test: `tests/booking-gallery-ui.test.ts`

**Interfaces:**
- Consumes the Task 1 conversion/default helpers and submits its UTC contract.

- [ ] Write a failing UI-source assertion for a `datetime-local` control labelled `หมดอายุการชำระเงิน`, rendered only while `form.status === 'waiting'`, with the default helper used by new drafts.
- [ ] Run `npm test -- tests/booking-gallery-ui.test.ts`; confirm it fails.
- [ ] Initialize a new waiting draft to ten minutes from now. Render the Bangkok-local deadline control only for waiting. Clear it when the user changes to another status; assign a fresh default when they return to waiting without one. Preserve a null legacy waiting deadline until changed; surface Thai validation for invalid local input.
- [ ] Re-run the UI test; confirm it passes.
- [ ] Commit: `feat: set payment deadlines for waiting bookings`.

### Task 4: Cloudflare scheduler integration

**Files:**
- Create: `worker.ts`, `tests/booking-payment-expiry-worker.test.ts`
- Modify: `wrangler.jsonc`, `wrangler.staging.jsonc`, `tests/cloudflare-deploy.test.ts`, `tests/cloudflare-staging-boundary.test.ts`

**Interfaces:**
- `worker.ts` exports `{ fetch: handler.fetch, scheduled(...) } satisfies ExportedHandler<CloudflareEnv>`.
- Both configs point `main` to `worker.ts` and configure `triggers.crons` as `['* * * * *']`.

- [ ] Write failing tests that the custom worker forwards the generated OpenNext fetch handler, calls `expireWaitingBookings` from its scheduled handler, and both configuration files use the exact one-minute cron expression.
- [ ] Run `npm test -- tests/booking-payment-expiry-worker.test.ts tests/cloudflare-deploy.test.ts tests/cloudflare-staging-boundary.test.ts`; confirm it fails.
- [ ] Implement the custom worker following OpenNext's custom-worker pattern. Create a non-persisting Supabase client from server-only Worker bindings, call the Task 2 adapter, and allow errors to reach Cloudflare observability without logging credentials or booking/customer data. Update both configuration files.
- [ ] Re-run the focused worker/configuration tests; confirm they pass.
- [ ] Run `npm run build`; start `npx wrangler dev --config wrangler.staging.jsonc --test-scheduled`, then call its local scheduled endpoint with `?format=json` using safe local bindings. Stop the development process after observing a successful invocation.
- [ ] Commit: `feat: schedule waiting booking expiry`.

### Task 5: Documentation and full verification

**Files:**
- Modify: `docs/booking-creation.md`
- Verify: all Task 1-4 files

- [ ] Document the waiting-only deadline, ten-minute default, UTC/Bangkok handling, null legacy behavior, and next-one-minute automatic cancellation (not an exact real-time guarantee).
- [ ] Run `npm run verify && npm run build`; confirm TypeScript, ESLint, all Node tests, and the production build pass.
- [ ] Run `git diff --check` and inspect `git status --short`; confirm no whitespace errors and only intended payment-expiry changes.
- [ ] Commit: `docs: document waiting booking expiry`.
