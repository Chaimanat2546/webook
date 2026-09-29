# Booking Agent Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let role-1 administrators select and persist an active numeric Agent for a booking.

**Architecture:** A new Production-aligned migration converts Agent identity from UUID to bigint and extends both existing booking RPCs with strict `agent_id` validation. The booking domain, repository, service, action, and editor carry the nullable ID; database authorization remains final.

**Tech Stack:** Supabase PostgreSQL/RPC, Next.js App Router Server Actions, React, TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-29-booking-agent-selection-design.md`

## Global Constraints

- Production schema inspected on 2026-09-29 is the only schema source of truth.
- Create one new migration; never edit an existing migration.
- Convert `agents.id` and `agent_accounts.agent_id` to bigint without losing relationships.
- Keep `bookings.agent_id` nullable and add an `on delete set null` FK.
- Only `public.users.role_id = 1` may assign, alter, or clear Agent selection.
- Apply and deploy Staging only, after an explicit schema/apply confirmation.

## Review Focus

- UUID-to-bigint conversion preserves all agent-account links — Task 1 database test.
- Forged non-administrator selection is rejected on create and update — Task 1 database test.
- Inactive Agents cannot be newly assigned — Tasks 1 and 2 tests.
- Historical inactive selection stays readable — Task 2 tests.
- Non-administrators never render or submit a selector — Task 3 tests.

### Task 1: Numeric Agent schema and booking RPCs

**Files:**
- Create: `supabase/migrations/20260929150000_booking_agent_numeric_id.sql`
- Create: `tests/booking-agent-migration.test.ts`
- Modify: `tests/house-booking-database.test.ts`

**Interfaces:**
- Consumes: the exact Production table/RPC shapes recorded in the spec.
- Produces: bigint `agents.id` / `agent_accounts.agent_id`, an Agent FK from booking, and two booking RPCs accepting nullable `agent_id`.

- [ ] Write failing migration and RPC tests: migrate UUID Agents/accounts, preserve relationships, validate active Agent and role-1 actor on create/update.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/booking-agent-migration.test.ts`; verify failure because the new migration/validation is absent.
- [ ] Implement one transactional migration that maps UUID Agents to bigint IDs, rebuilds dependent account constraints/indexes, adds `bookings.agent_id` FK, and replaces the exact Production RPC signatures with `agent_id` allowlist, active-Agent, and role-1 checks while preserving all snapshot/booking behavior.
- [ ] Re-run the focused test and verify pass.
- [ ] Commit schema/tests: `git add supabase/migrations/20260929150000_booking_agent_numeric_id.sql tests/booking-agent-migration.test.ts tests/house-booking-database.test.ts && git commit -m "feat: persist numeric booking agents"`.

### Task 2: Agent domain, repository, and service authorization

**Files:**
- Create: `lib/booking-agency.ts`
- Modify: `lib/house-bookings.ts`
- Modify: `server/auth/admin.ts`
- Modify: `server/auth/bookings.ts`
- Modify: `server/repositories/house-bookings.ts`
- Modify: `server/services/house-bookings.ts`
- Create: `tests/booking-agency-selector.test.ts`
- Modify: `tests/house-booking-service.test.ts`

**Interfaces:**
- Consumes: Task 1 numeric Agent/RPC contract.
- Produces: `BookingAgency`, `bookingAgencyChoices`, authorized Agent listing, and create/update payloads carrying nullable `agent_id`.

- [ ] Write failing tests for administrator-only active choices, null choice, inactive historical Agent display, malformed ID rejection, and create/update payload forwarding.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/booking-agency-selector.test.ts tests/house-booking-service.test.ts`; verify expected failure.
- [ ] Implement parsing, repository selection/validation, trusted authorization, and service guards. Keep database checks as the final authorization layer.
- [ ] Re-run the focused tests and verify pass.
- [ ] Commit application contract: `git add lib/booking-agency.ts lib/house-bookings.ts server/auth/admin.ts server/auth/bookings.ts server/repositories/house-bookings.ts server/services/house-bookings.ts tests/booking-agency-selector.test.ts tests/house-booking-service.test.ts && git commit -m "feat: authorize booking agent selection"`.

### Task 3: Administrator-only editor selector

**Files:**
- Modify: `app/admin/houses/[propertyId]/bookings/actions.ts`
- Modify: `components/admin/houses/bookings/booking-editor.tsx`
- Modify: `docs/house-bookings.md`
- Modify: `tests/booking-house-information.test.ts`
- Modify: `tests/booking-agency-selector.test.ts`

**Interfaces:**
- Consumes: Task 2 Agent choices and authorization contracts.
- Produces: a native Agent select above `BookingCustomerPicker`, visible only for role 1.

- [ ] Write failing action/UI tests for no choices without authorization, select placement above customer, and the “ไม่ระบุเอเจนซี่” option.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/booking-agency-selector.test.ts tests/booking-house-information.test.ts`; verify expected failure.
- [ ] Add the result-shaped action and editor state. Load choices only for authorized users, add `agent_id` to their draft/payload, and document the numeric ID and Administrator-only behavior.
- [ ] Re-run the focused tests and verify pass.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/house-booking-database.test.ts`; fix any failure before commit.
- [ ] Commit UI/docs: `git add app/admin/houses/[propertyId]/bookings/actions.ts components/admin/houses/bookings/booking-editor.tsx docs/house-bookings.md tests/booking-house-information.test.ts tests/booking-agency-selector.test.ts && git commit -m "feat: show booking agent selector for administrators"`.

### Task 4: Staging gate, seed data, and deployment

**Files:** No source changes unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1–3 and Staging project `sxvkhzhqtrpxgzumsswl`.
- Produces: applied Staging migration, clearly labeled fake Agents, and Staging deployment.

- [ ] Re-dump Production Agent/RPC schema and present it plus the one proposed migration; wait for explicit confirmation before apply.
- [ ] Run `supabase db push --project-ref sxvkhzhqtrpxgzumsswl --dry-run --skip-vault`, then only after confirmation run `supabase db push --project-ref sxvkhzhqtrpxgzumsswl --skip-vault --yes`.
- [ ] Create clearly labeled fake active Agents on Staging, verify selected numeric ID persists on a test booking, and never copy Production Agent/account data.
- [ ] After explicit deployment authorization, run `npm run deploy:cf:staging` and verify the build bundle contains only the Staging Supabase reference.
