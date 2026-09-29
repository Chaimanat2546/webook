# Production Booking Agent UUID Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Production booking Agent references directly from a legacy bigint to UUID without ever changing `agents.id` or `agent_accounts.agent_id` away from UUID.

**Architecture:** Keep the approved booking snapshot migration intact. Replace the Staging-only numeric conversion body at migration version `20260929150000` with the direct UUID conversion that affects only `bookings.agent_id` and the booking RPCs. Retain version `20260929160000` as an explicit no-op so Staging's already-recorded history remains compatible while new databases and Production have no bigint Agent transition.

**Tech Stack:** Supabase PostgreSQL migrations and RPCs, PostgreSQL 17 Docker integration tests, Node.js Test Runner, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-29-production-booking-agent-uuid-migration-design.md`

## Global Constraints

- Production schema at `https://rqizfiayvcbozlzuvbok.supabase.co` is the only schema source of truth.
- Never alter `public.agents.id` or `public.agent_accounts.agent_id` in the direct migration; both remain UUID.
- A legacy numeric `bookings.agent_id` has no safe UUID mapping and must become `NULL`.
- Preserve service-role-only execution and role-ID-1 authorization for explicit Agent assignment changes.
- Do not apply any Production migration until a fresh Production schema/data summary and explicit confirmation are obtained.
- Do not deploy Cloudflare Production as part of this work.

## Review Focus

- A pre-existing foreign key on `bookings.agent_id` must be removed before its bigint column is replaced, then recreated as UUID `ON DELETE SET NULL`.
- A legacy numeric booking Agent reference must become `NULL`; it must never be coerced, fabricated, or linked to an arbitrary UUID Agent.
- Existing UUID Agent and Agent Account identities, account uniqueness, index, and policy must remain valid after the migration.
- A non-admin actor omitting `agent_id` from an update preserves the existing UUID association; supplying any changed/cleared value is rejected.
- An inactive, malformed, or deleted Agent cannot remain or be assigned through the RPCs.

---

### Task 1: Rewrite the migration sequence for a direct UUID end state

**Files:**
- Modify: `supabase/migrations/20260929150000_booking_agent_numeric_id.sql`
- Modify: `supabase/migrations/20260929160000_restore_booking_agent_uuid.sql`
- Modify: `docs/house-bookings.md`

**Interfaces:**
- Consumes: Production-shaped `public.agents(id uuid)`, `public.agent_accounts(agent_id uuid)`, and `public.bookings(agent_id bigint)`.
- Produces: `public.bookings(agent_id uuid)` with `bookings_agent_id_fkey` referencing `public.agents(id) ON DELETE SET NULL`, plus UUID-aware `admin_create_house_booking` and `admin_update_house_booking` RPCs.

- [ ] **Step 1: Rewrite `20260929150000_booking_agent_numeric_id.sql` as a direct migration**

Keep Agent and Agent Account tables untouched. Add `agent_id_uuid uuid` to `public.bookings`, leave every legacy numeric reference null in that new column, drop any old booking Agent foreign key, replace the bigint column, and create the UUID foreign key with `ON DELETE SET NULL`. Use the final UUID RPC bodies with `v_agent uuid`, optional `agent_id` parsing, role-ID-1 authorization, active Agent validation, and service-role-only grants.

- [ ] **Step 2: Replace `20260929160000_restore_booking_agent_uuid.sql` with a documented no-op**

The file must contain only a comment explaining that version is retained because Staging already recorded it. It must not contain DDL, DML, RPC replacement, or UUID generation.

- [ ] **Step 3: Update `docs/house-bookings.md` database-readiness language**

Describe the direct UUID migration and remove wording that says the Production path first uses a numeric-ID migration or that the UUID correction maps numeric Staging identities.

- [ ] **Step 4: Commit the migration-history rewrite**

```bash
git add supabase/migrations/20260929150000_booking_agent_numeric_id.sql supabase/migrations/20260929160000_restore_booking_agent_uuid.sql docs/house-bookings.md
git commit -m "fix: migrate booking agents directly to UUID"
```

### Task 2: Prove the direct migration with a Production-shaped database test

**Files:**
- Modify: `tests/booking-agent-migration.test.ts`

**Interfaces:**
- Consumes: the rewritten migration files and a Docker PostgreSQL fixture whose Agent IDs and Agent Account references begin as UUID and whose booking Agent column begins as bigint.
- Produces: regression coverage proving no Agent identity conversion occurs and the UUID RPC contract works.

- [ ] **Step 1: Write the failing direct-migration regression test**

Replace the two-stage numeric-to-UUID setup with execution of versions `140`, rewritten `150`, and no-op `160`. Assert `pg_typeof(agents.id)` and `pg_typeof(agent_accounts.agent_id)` are UUID before and after version `150`, the original Agent and Account UUIDs remain identical, `LEGACY.agent_id is null`, and the no-op migration contains no `alter table`, `create or replace function`, or `gen_random_uuid`.

- [ ] **Step 2: Run test to verify it fails against the previous migration bodies**

Run: `$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/booking-agent-migration.test.ts`

Expected: FAIL because version `150` changes Agent IDs to bigint and version `160` is not a no-op.

- [ ] **Step 3: Adapt the UUID RPC assertions to the direct end state**

Keep tests for admin active-Agent assignment, invalid/malformed UUIDs, non-admin create/update rejection, omission preservation, explicit clear, and `ON DELETE SET NULL`. Remove only assertions that depended on a temporary numeric Agent identity or generated replacement UUID.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/booking-agent-migration.test.ts`

Expected: PASS with all direct-migration and RPC cases green.

- [ ] **Step 5: Commit the regression coverage**

```bash
git add tests/booking-agent-migration.test.ts
git commit -m "test: cover direct booking agent UUID migration"
```

### Task 3: Validate the existing Staging end state and repository migration history

**Files:**
- Modify: none

**Interfaces:**
- Consumes: the committed migration sequence and Staging project `sxvkhzhqtrpxgzumsswl`.
- Produces: read-only evidence that Staging retains its applied versions and currently matches the desired UUID end state.

- [ ] **Step 1: Inspect migration versions on Staging and Production without mutation**

Run `supabase migration list` against both configured project refs. Confirm Staging has versions `20260929140000`, `20260929150000`, and `20260929160000`, while Production has none before the future apply.

- [ ] **Step 2: Inspect Staging schema and booking RPC argument signatures**

Use a read-only SQL query through the authenticated Supabase CLI to verify `agents.id`, `agent_accounts.agent_id`, and `bookings.agent_id` are UUID; verify the booking foreign key delete action is `SET NULL`; and verify the two RPC signatures retain their public argument types.

- [ ] **Step 3: Record the evidence in the completion report**

Report only types, migration versions, constraints, and RPC signatures. Do not print database credentials or environment-variable values.

### Task 4: Run repository verification and prepare the Production approval gate

**Files:**
- Modify: generated PWA assets only if `npm run build:pwa` changes their checked-in revision

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: fresh verification evidence and a Production-ready schema/data summary; it does not mutate Production.

- [ ] **Step 1: Run static checks and the focused database suites**

Run:

```bash
npm run typecheck
npm run lint
$env:RUN_BOOKING_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/house-booking-database.test.ts tests/booking-agent-migration.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 2: Regenerate the PWA revision and run the full test suite**

Run:

```bash
npm run build:pwa
npm test
```

If PWA output changes, inspect it and commit the generated revision in the same verification commit; otherwise leave the working tree unchanged.

- [ ] **Step 3: Re-inspect Production immediately before the apply request**

Read Production schema types, constraints, migration versions, Agent/Account counts, and the count of non-null numeric booking references. State the exact target: `https://rqizfiayvcbozlzuvbok.supabase.co` on Cloudflare account `7c1d945e149fc6fad2124176124d8f33` (database migration only; no Cloudflare deployment).

- [ ] **Step 4: Stop and obtain a fresh explicit Production-apply confirmation**

Summarize that version `140` adds booking snapshot time fields, version `150` changes only `bookings.agent_id bigint` to UUID and nulls the currently unmappable numeric references, and version `160` is a no-op. Do not run `supabase db push` until the user confirms this exact current-state summary.
