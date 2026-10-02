# Scalable Agency Booking Dashboard RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Move agency dashboard aggregation and pagination into a single indexed PostgreSQL RPC.

**Architecture:** A new migration creates the validated, bounded RPC and indexes. The dashboard repository maps one JSON RPC response; the service uses it for agency details while preserving the existing UI contract.

**Tech Stack:** PostgreSQL/Supabase RPC, Next.js, TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-02-dashboard-agency-booking-rpc-design.md`

## Global Constraints

- Never fetch an unbounded agency booking set into Next.js.
- Summary uses date-scoped data before list-only filters.
- Preserve server authorization and owner denial.

### Task 1: Create indexed dashboard RPC migration

**Files:**
- Create: `supabase/migrations/20261002100000_dashboard_agency_bookings.sql`
- Test: `tests/dashboard-migration.test.ts`

- [ ] Write failing migration contract tests for function inputs, fixed search path, grants, and indexes.
- [ ] Create RPC returning summary, all-agency confirmed total, filtered total, and a bounded row page; add date/agency indexes.
- [ ] Run focused migration tests and inspect `EXPLAIN` on large seeded data.
- [ ] Commit: `feat: add scalable agency dashboard rpc`

### Task 2: Map the RPC in the dashboard repository and service

**Files:**
- Modify: `server/repositories/dashboard.ts`
- Modify: `server/services/dashboard.ts`
- Modify: `lib/dashboard.ts`
- Test: `tests/dashboard.test.ts`

- [ ] Write failing repository/service tests proving a single RPC response produces summary and one page without full booking reads.
- [ ] Add typed repository contract and replace agency detail's duplicate full dataset loads with the RPC.
- [ ] Test date modes, status/search/amount filters, missing prices, share, and agency isolation.
- [ ] Commit: `feat: load agency dashboard through rpc`

### Task 3: Align UI copy and document scalable semantics

**Files:**
- Modify: `components/admin/dashboard/dashboard-details.tsx`
- Modify: `docs/dashboard.md`
- Test: `tests/dashboard.test.ts`

- [ ] Add failing render tests for total booking-count summary and filter-independent cards.
- [ ] Update summary labels/copy and documentation to reflect source scope and list-only filters.
- [ ] Run `npm run typecheck && npm run lint && npm test && npm run build`.
- [ ] Commit: `docs: describe scalable agency dashboard summary`
