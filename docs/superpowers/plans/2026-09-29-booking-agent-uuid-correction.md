# Booking Agent UUID Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct booking Agent selection so UUID Agent IDs are preserved from Production through the database, RPCs, application, and editor.

**Architecture:** A forward Supabase migration follows the already-applied numeric-ID migration and maps its Agent, account, and booking references back to UUIDs atomically. The booking layers retain their current responsibilities, but parse and forward UUID `agent_id` values instead of numeric strings.

**Tech Stack:** Supabase PostgreSQL/RPC, Next.js App Router Server Actions, React, TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-29-booking-agent-uuid-correction-design.md`

## Global Constraints

- Production schema remains the only source of truth and Production is never changed.
- Do not edit `20260929150000_booking_agent_numeric_id.sql`; add one forward migration.
- `agents.id`, `agent_accounts.agent_id`, and `bookings.agent_id` finish as UUID values.
- Preserve post-numeric-migration Agent/account/booking links; leave original unmappable Production bigint booking values null.
- Only `public.users.role_id = 1` may explicitly set, change, or clear an Agent.
- Inspect Production and obtain explicit approval before applying the corrective migration to Staging.
- Staging deployment is a separate explicit authorization.

## Review Focus

- Existing Staging booking selection maps to its corrected UUID Agent — Task 1 database test.
- A legacy Production bigint booking reference never becomes an arbitrary UUID — Task 1 database test.
- Malformed UUID input produces the controlled booking error instead of raw cast output — Task 1 database test.
- Non-administrator omissions preserve an Agent while forged UUID changes fail — Tasks 1 and 2 tests.
- Editor submits UUID values only when role 1 can manage the selector — Task 2 tests.

---

### Task 1: Forward UUID schema correction and RPCs

**Files:**

- Create: `supabase/migrations/20260929160000_restore_booking_agent_uuid.sql`
- Modify: `tests/booking-agent-migration.test.ts`

**Interfaces:**

- Consumes: the numeric-ID schema produced by `20260929150000_booking_agent_numeric_id.sql`.
- Produces: UUID `agents.id`, UUID `agent_accounts.agent_id`, UUID `bookings.agent_id`, and unchanged booking RPC signatures accepting optional UUID `agent_id` JSON.

- [ ] Write the failing database test: apply both migrations and assert UUID types, preserved account and booking Agent links, null legacy booking reference, role-1 active UUID assignment, and safe rejection of malformed/inactive UUID values.
- [ ] Run `$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/booking-agent-migration.test.ts`; expect failure because the forward UUID correction migration is missing.
- [ ] Create transactional `20260929160000_restore_booking_agent_uuid.sql`: recreate affected constraints, policy, and index; map every numeric Agent ID to a generated UUID; rewrite account and booking references through that map; restore UUID keys and booking `on delete set null` FK; replace both RPC bodies with UUID validation.
- [ ] Re-run the database test; expect pass.
- [ ] Commit schema/tests with `git commit -m "fix: restore booking agent UUIDs"`.

### Task 2: UUID application contract and selector

**Files:**

- Modify: `lib/house-bookings.ts`
- Modify: `lib/booking-agency.ts`
- Modify: `server/repositories/house-bookings.ts`
- Modify: `server/services/house-bookings.ts`
- Modify: `components/admin/houses/bookings/booking-editor.tsx`
- Modify: `tests/booking-agency-selector.test.ts`
- Modify: `tests/house-booking-service.test.ts`
- Modify: `tests/booking-house-information.test.ts`
- Modify: `docs/house-bookings.md`

**Interfaces:**

- Consumes: Task 1 UUID database/RPC contract.
- Produces: `BookingAgency.id`, `Booking.agent_id`, `BookingCreate.agent_id`, and `BookingUpdate.agent_id` as UUID strings or null; administrator-only editor selection continues unchanged visually.

- [ ] Change Agent fixtures to UUIDs and write failing tests for valid UUID forwarding, numeric/malformed rejection, historic UUID readability, and role-1-only native selector placement above `BookingCustomerPicker`.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/booking-agency-selector.test.ts tests/house-booking-service.test.ts tests/booking-house-information.test.ts`; expect failure because numeric `bookingId` parsing is still used for Agent fields.
- [ ] Add a strict UUID parser used only for Agent fields; preserve optional-update behavior, repository active-Agent query, service authorization, and existing native selector composition. Update documentation to describe UUIDs.
- [ ] Re-run focused tests; expect pass.
- [ ] Commit application changes with `git commit -m "fix: use UUID booking agent references"`.

### Task 3: Verification and Staging correction gate

**Files:** No source changes unless verification identifies a defect.

**Interfaces:**

- Consumes: Tasks 1–2 and Staging project `sxvkhzhqtrpxgzumsswl`.
- Produces: a corrected Staging database, preserved test selection, and verified implementation.

- [ ] Run `npm run build:pwa`, `npm run typecheck`, `npm run lint`, `npm test`, and `$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/house-booking-database.test.ts tests/booking-agent-migration.test.ts`.
- [ ] Reinspect Production Agent/account/booking/RPC metadata, report the UUID source schema and Staging-only correction, then wait for explicit confirmation.
- [ ] After approval, run `supabase db push --project-ref sxvkhzhqtrpxgzumsswl --dry-run --skip-vault`, then `supabase db push --project-ref sxvkhzhqtrpxgzumsswl --yes --skip-vault`. Verify Staging Agent rows and booking ID 4 preserve their UUID relationship.
- [ ] Deploy only after separate authorization with `npm run deploy:cf:staging`, then verify the compiled bundle references Staging and no Production Supabase project reference.
