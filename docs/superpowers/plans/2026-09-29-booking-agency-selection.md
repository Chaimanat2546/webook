# Booking Agency Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a role-1 booking administrator select a numeric agency ID for a booking, while preserving the existing agency and bank-account data.

**Architecture:** Migrate `public.agents.id` and its `public.agent_accounts.agent_id` foreign key from UUID to generated bigint IDs, retaining the prior UUID only long enough to map existing relationships. Reuse `public.bookings.agent_id` as the persisted selection; server-side authorization and validation enforce that only role-1 administrators may change it and that it names an active agent. The booking dialog receives a small, serialized agency list and conditionally renders the existing native select control.

**Tech Stack:** PostgreSQL/Supabase migrations and RPCs, Next.js App Router Server Actions, React, TypeScript, Node.js Test Runner.

**Spec:** User-approved design in this conversation on 2026-09-29.

## Global Constraints

- Preserve existing `agents` and `agent_accounts` rows when converting identifiers.
- Use `agents.id` numeric values as the booking select value; do not use `agent_accounts.agent_id` as the UI value.
- Only `public.users.role_id = 1` may view or mutate a booking agency.
- Preserve booking behavior for non-administrators and existing bookings with a null agency.
- Keep Server Action authentication, authorization, and validation at the server boundary.
- No new dependency; use existing components and native select styling.

## Review Focus

- Existing agent-account relationships retain their agent after the UUID-to-bigint migration.
- A forged non-admin save cannot set, clear, or replace a booking agency.
- An inactive or nonexistent agent ID is rejected even when sent directly to the Server Action.
- Booking update RPC input cannot include an unvalidated or omitted agency field.
- Existing booking `agent_id` numeric data is preserved without adding a foreign key that could reject legacy rows.

---

### Task 1: Preserve agency relationships while assigning numeric IDs

**Files:**
- Create: `supabase/migrations/20260929090000_agents_numeric_ids.sql`
- Test: `tests/agency-numeric-id-migration.test.ts`

**Interfaces:**
- Produces: `public.agents.id bigint` and `public.agent_accounts.agent_id bigint`, with the original pairwise relationships preserved.

- [ ] **Step 1: Write the failing migration integration test**

Create UUID-keyed sample agents and agent accounts, run the migration, and assert each account points to the corresponding numeric agent ID and each agent name remains present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agency-numeric-id-migration.test.ts`

Expected: FAIL because the numeric-ID migration does not exist.

- [ ] **Step 3: Implement the numeric ID migration**

Create `supabase/migrations/20260929090000_agents_numeric_ids.sql` to assign a stable generated bigint ID to every existing agent, remap `agent_accounts`, replace the UUID primary/foreign key pair, and preserve old booking numeric values.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agency-numeric-id-migration.test.ts`

Expected: PASS.

### Task 2: Authorize and persist the booking agency

**Files:**
- Modify: `lib/house-bookings.ts`
- Modify: `server/auth/bookings.ts`
- Modify: `server/repositories/house-bookings.ts`
- Modify: `server/services/house-bookings.ts`
- Modify: `app/admin/houses/[propertyId]/bookings/actions.ts`
- Modify: `supabase/migrations/20260929090000_agents_numeric_ids.sql`
- Test: `tests/house-booking-service.test.ts`
- Test: `tests/house-booking-database.test.ts`

**Interfaces:**
- Consumes: numeric `agents.id` from Task 1.
- Produces: `BookingAgency { id: string; name: string }`, an admin-only agency list action, and validated `agent_id` in booking create/update inputs.

- [ ] **Step 1: Write failing service and RPC tests**

Assert that an allowed active numeric agency is persisted, and that an inactive, missing, or unauthorized agency selection is rejected without changing the booking.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/house-booking-service.test.ts tests/house-booking-database.test.ts`

Expected: FAIL because agency values are currently excluded from parser, service, and RPC allowlists.

- [ ] **Step 3: Implement agency list, role guard, validation, and RPC persistence**

Use the trusted session user to determine `role_id = 1`; return only active agencies to the select action. Extend repository/service input handling and both booking RPCs so `agent_id` is an exact optional numeric field, and validate it against active `agents` only for administrators.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/house-booking-service.test.ts tests/house-booking-database.test.ts`

Expected: PASS.

### Task 3: Render the administrator-only agency selector

**Files:**
- Modify: `components/admin/houses/bookings/booking-editor.tsx`
- Test: `tests/booking-agency-selector.test.ts`
- Modify: `docs/house-bookings.md`

**Interfaces:**
- Consumes: the authorized agency-list Server Action from Task 2 and booking `agent_id`.
- Produces: an agency select above the customer section in the booking dialog, visible only when the action reports the current user is a role-1 administrator.

- [ ] **Step 1: Write the failing UI behavior test**

Assert the form model sends the selected numeric agency ID and that the selector is absent for a non-administrator result.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/booking-agency-selector.test.ts`

Expected: FAIL because no selector or agency-list state exists.

- [ ] **Step 3: Implement the selector using existing dialog styling**

Load the authorized list when the editor opens, render the optional select immediately above the customer picker only for role-1 administrators, and bind it to `agent_id` in the existing draft/save flow.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/booking-agency-selector.test.ts`

Expected: PASS.

- [ ] **Step 5: Document the permission and persistence behavior**

Update `docs/house-bookings.md` with the numeric agency migration and role-1 selector behavior.

### Task 4: Verify the integrated change

**Files:**
- Verify: modified migrations, booking modules, UI, tests, and documentation.

- [ ] **Step 1: Run targeted verification**

Run: `npm test -- tests/agency-numeric-id-migration.test.ts tests/house-booking-service.test.ts tests/house-booking-database.test.ts tests/booking-agency-selector.test.ts`

Expected: PASS.

- [ ] **Step 2: Run project verification**

Run: `npm run typecheck && npm run lint && npm test`

Expected: PASS, with any intentional skips reported.

- [ ] **Step 3: Request a fresh code review**

Review migration data preservation, authorization boundaries, RPC allowlists, and the dialog state flow before handoff.
