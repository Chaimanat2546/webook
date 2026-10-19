# Business Dashboard Time Windows Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend every business dashboard card to the three existing date/time modes and deploy/test through staging CI/CD.

**Architecture:** Retain the existing route → service → repository → authorized RPC flow. Reuse the website time picker and time parsing utilities; business clocks have their own URL parameters. Add a migration for SQL clock filtering and true hourly counts.

**Tech Stack:** Next.js, React, TypeScript, Supabase PostgreSQL, Node Test Runner, Recharts, GitHub Actions/OpenNext.

**Spec:** docs/superpowers/specs/2026-10-19-business-dashboard-time-windows-design.md

## Global Constraints

- Asia/Bangkok; whole hours; start inclusive/end exclusive; 24:00 is end-only.
- Booking updated_at and new-house created_at; existing authorization and calendar exclusion remain enforced.
- No new dependencies; no edits to existing migrations; deployment only through branch staging CI/CD.

## Review Focus

- Reject malformed/partial clocks at URL and RPC boundaries.
- Retain clocks through lists, paging, filters and Back links.
- Filter house previews/counts before pagination, including midnight/end boundaries.
- Keep SQL aggregate totals and hourly counts reconciled without changing check-in override or owner scope.
- Keep explicit website analytics scope independent of business filter changes.

## Tasks

- [x] Write failing query/navigation/service/UI/SQL tests for the three modes and the review cases.
- [x] Extend dashboard contracts, input parsing, links, services and typed RPC result parsing.
- [x] Add the new clock-filtering/hourly SQL migration and exercise it against PostgreSQL.
- [x] Reuse time-aware pickers and render real hourly booking axes with consistent card time context.
- [x] Run focused and full checks, build, independent review and update dashboard documentation.
- [ ] Commit/push staging, follow CI migration/build/deploy and validate all business cards on live Staging.

## Pre-deployment Evidence

- New core/navigation/UI/independent-analytics tests: 8 passing; initial missing-clock/UI cases failed before implementation.
- Disposable PostgreSQL 17 suite: 22 passing, including recurring windows, owner scope, midnight/full-day counts, invalid clocks, calendar exclusion and 30,000-row regression fixtures. The focused clock tests were rerun after adding parser/empty/check-in/full-day assertions.
- `npm run build`: passed. `npm run verify`: 1,125 passed, 4 skipped; existing lint warnings only.
- Independent read-only review: no actionable findings. The staging workflow also runs the real PostgreSQL contract suite before build/deployment.
- Deployment and live QA follow the implementation commit; final run URL and evidence are reported in the chat.
