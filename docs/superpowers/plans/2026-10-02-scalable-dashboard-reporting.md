# Scalable Dashboard Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Move dashboard reporting, aggregates, charts, agency views, and paginated lists to consistent PostgreSQL-backed date scopes.

**Architecture:** New read-only RPCs build a date-scoped base relation in PostgreSQL, derive filter-independent metrics, then return only a bounded filtered page. Repository contracts map typed result data; services no longer aggregate unbounded booking rows in Next.js.

**Tech Stack:** PostgreSQL/Supabase RPC, Next.js, React, TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-02-scalable-dashboard-reporting-design.md`

## Global Constraints

- Monthly booking reporting uses `updated_at`; stay range uses `check_in`.
- Summary metrics precede status/search/amount filters.
- Booking count is all statuses; sales/share/charts are confirmed-only.
- No unbounded booking data enters Next.js; preserve server authorization.

### Task 1: Add dashboard reporting indexes and RPC contracts

**Files:**
- Create: `supabase/migrations/20261002110000_scalable_dashboard_reporting.sql`
- Test: `tests/dashboard-migration.test.ts`

- [ ] Write failing migration tests for RPC boundary, validation, fixed search path, grants, and date/agency indexes.
- [ ] Add read-only RPCs that return overview aggregates/charts/agency groups and bounded booking/agency pages from one scoped relation.
- [ ] Verify large-fixture query plans with `EXPLAIN (ANALYZE, BUFFERS)`.
- [ ] Commit: `feat: add scalable dashboard reporting rpc`

### Task 2: Introduce typed RPC repository contracts

**Files:**
- Modify: `lib/dashboard.ts`
- Modify: `server/repositories/dashboard.ts`
- Test: `tests/dashboard.test.ts`

- [ ] Write failing repository mapping tests for summary, chart, status, agency, and page result fields.
- [ ] Add typed RPC result parsing and replace paged full-row reads with bounded RPC calls.
- [ ] Run repository tests; commit `feat: map dashboard reporting rpc`.

### Task 3: Migrate overview and booking workflows

**Files:**
- Modify: `server/services/dashboard.ts`
- Modify: relevant dashboard route components only if contracts require it
- Test: `tests/dashboard.test.ts`

- [ ] Write failing tests proving monthly overview, booking list, booking detail context, status totals, daily chart, and sales use `updated_at` consistently.
- [ ] Replace in-memory aggregate paths with RPC-backed service methods; preserve booking-detail authorization and stay-range semantics.
- [ ] Run focused tests; commit `feat: unify dashboard reporting source`.

### Task 4: Migrate agency list/detail and align summary UI

**Files:**
- Modify: `server/services/dashboard.ts`
- Modify: `components/admin/dashboard/dashboard-details.tsx`
- Modify: `docs/dashboard.md`
- Test: `tests/dashboard.test.ts`

- [ ] Write failing tests for agency counts from all statuses, confirmed sales/share, filter-independent cards, and bounded list pages.
- [ ] Use RPC agency result contracts and update card labels/copy to make total bookings versus confirmed sales explicit.
- [ ] Run typecheck, lint, full tests, build, and migration verification; commit `docs: align scalable dashboard reporting`.
