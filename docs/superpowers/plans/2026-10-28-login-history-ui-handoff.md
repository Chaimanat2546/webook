# Login and History UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the approved Pencil Login/location/History flows with root-only viewing, background evidence saves and accurate filtering/pagination.

**Architecture:** Reuse the existing Next.js Server Actions, session-bound location API, service/repository separation and Supabase table. Tighten RLS and listing authority in a new migration; add allowlisted query filters before pagination. Compose existing UI primitives using a scoped Royal/Azure theme.

**Tech Stack:** Next.js 16.4.2, React 19, strict TypeScript, Tailwind 4, existing shadcn primitives, Supabase, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-28-login-history-ui-handoff-design.md`

## Global Constraints

- UI follows supplied Pencil frames and handoff; user chat decisions override earlier behavior.
- History viewing requires exact UID mapping and `role_id = 1`; location collection remains available to session owners.
- No new table, column or location status; only a new migration for RLS and RPC behavior.
- Failed background saves leave `pending`; never invent a successful/denied result.
- No visible persistence progress/results/retry, troubleshooting route, or numeric retention disclosure in the journey.
- `ช่วงวันที่ไม่ถูกต้อง กรุณาเลือกใหม่` is the exact date error.
- Existing components, no npm dependency changes, preserve original transparent logo.
- Scoped Royal/Azure styling; 390px and 360px plus desktop and keyboard/reflow verification.
- No remote migration/deployment, merge or push in this task.

## Review Focus

- Non-root users trying empty search, direct SQL, old RPC signature or no-module-access shortcut must receive no history.
- Detached saves must survive component unmount without attaching results to a changed account/session.
- Sort/status must apply before pagination, with deterministic ties and matching totals.
- Invalid URL criteria must preserve correction controls and never broaden the data query.
- Form failure must retain the identifier and separate invalid credentials from transport errors without leaking credentials.

### Task 1: Root-only history and complete-dataset filters

**Files:** `lib/login-history.ts`, `server/repositories/login-history.ts`, `server/services/login-history.ts`, new migration, `tests/login-history-validation.test.ts`, `tests/login-history-list.test.ts`, `tests/login-history-repository.test.ts`, Supabase SQL fixtures/tests and DB runner.

**Interfaces:** `HistoryFilter` gains `status: LoginLocationStatus | null` and `sort: 'latest' | 'oldest'`. `parseHistoryFilter(query)` validates both and exposes a distinguishable invalid-date reason. Repository listing rejects `scope.kind !== 'root-admin'`; scope lookup remains exact UID. Existing DTO/page shape is retained.

- [x] Write failing tests for non-root empty searches, all existing statuses, invalid status/sort, latest/oldest defaults, invalid date reason and RPC payload.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/login-history-validation.test.ts tests/login-history-list.test.ts tests/login-history-repository.test.ts`; confirm the new cases fail for missing behavior.
- [x] Implement typed validation/repository arguments and root-only list service boundary.
- [x] Add a migration replacing SELECT policy and listing function: exact root check, allowlisted status/order, shared filtered count, deterministic time/UUID order before pagination, no surviving self-access overload.
- [x] Update executable DB tests for non-root direct/RPC denial, roots reading, ordinary users still attaching their own evidence, every status/order across pages, ties, invalid values and date bounds; adapt the fixture runner to apply the new migration.
- [x] Run focused tests and safe local DB suites; record environment limits rather than claiming an unrun DB test passed.

### Task 2: Immediate continuation and detached evidence saves

**Files:** `components/auth/login-location-request.ts`, `components/auth/login-location-prompt.tsx`, `app/login/location/page.tsx`, `app/login/location/check/route.ts`, location client/navigation/check tests.

**Interfaces:** The location flow reports dispatch/continuation independently of save settlement. Existing API `POST /api/login-history/location` stays unchanged. Detached transport uses JSON keepalive and a network deadline; geolocation cancellation remains separate from an already dispatched request.

- [x] Write failing behavioral tests: skip continues before an unresolved save; each geolocation outcome continues; cancellation after dispatch does not abort persistence; callbacks cancelled before dispatch never save; reload marker continues without another read.
- [x] Run the location client/navigation test files and observe missing behavior.
- [x] Implement bounded detached transport and continuation, preserving fresh-fix safeguards and current-session API validation. Remove normal-journey retry/error/result UI and Staging probe route/links.
- [x] Run location client, API, navigation and auth regression tests.

### Task 3: Login UI01 and shared scoped design system

**Files:** `app/login/page.tsx`, `app/login/actions.ts`, new focused `components/auth/login-form.tsx`, shared auth shell/theme/font support, `app/globals.css`, login tests.

**Interfaces:** Typed form state returned by a Server Action for expected validation/credential/transport failures. Preserve successful audit creation/navigation. Shared auth shell uses original logo, scoped tokens and approved Latin/Thai font stack. No global recolor.

- [x] Add failing login behavior tests for typed invalid versus request errors, identifier preservation, success redirect and no credential serialization beyond the request.
- [x] Run login action tests to establish RED; implement typed action state and real labelled client form with show/hide, pending-disabled fields and useful error focus.
- [x] Implement UI01 card geometry and UI02 branding against native frames; load Plus Jakarta Sans locally without npm changes and retain Noto Sans Thai fallback.
- [x] Verify focused action/render tests and typecheck. Inspect actual UI before claiming visual completion.

### Task 4: History journal, six bounded states and mobile filter Sheet

**Files:** `app/admin/login-history/page.tsx`, `loading.tsx`, focused components under `components/admin/login-history/`, shared admin header/sidebar/navigation/no-access contracts, History/navigation tests.

**Interfaces:** URL criteria `q/from/to/status/sort/page/pageSize`; draft status/order Sheet applies atomically and resets page 1. Page loader authorizes before records and returns distinct forbidden/invalid-date/load-failure states with criteria intact. Shared header has explicit in-scope styling. Pagination uses the existing total/page/pageSize DTO.

- [x] Add failing tests for non-root direct navigation, correct empty-state classification, invalid URL controls, retry/pagination query retention and computed range helper including out-of-range pages.
- [x] Run focused tests to establish RED; implement root-only navigation flag from exact UID authority without making History a default landing destination.
- [x] Build journal date grouping, actual accuracy/status labels and existing desktop support. Build scoped shared 62px mobile header with real logo, Bangkok date and notification bell.
- [x] Implement separate date picker, search and status/order filter Sheet (desktop Popover), visible selected summaries, clear/reset and deterministic URL updates.
- [x] Implement skeletons preserving controls, distinct empty variants, inline date validation/focus, same-criteria retry and pagination container/helper. Prevent stale results from replacing newer criteria.
- [x] Add expired-session messaging to Login while preserving normal first visit and explicit logout.
- [x] Run History, navigation and relevant auth tests; exercise all UI04 states in browser.

### Task 5: Integrated validation, review and documentation

**Files:** `docs/login-history.md`, verification report and the implemented files/tests.

- [x] Run `npm run verify` and `npm run build`, using a safe local public configuration without exposing environment secrets.
- [x] Exercise actual pages with fictional Auth/data at 390px, 360px and desktop: Login states, permission outcomes/skip, History records/loading/empty/filtered-empty/date-error/load-failure, Sheet, pagination and session expiry.
- [x] Check keyboard labels/focus, live announcements and 200% reflow; compare screenshots to supplied native frames, recording any test limitations explicitly.
- [x] Update operating documentation for root-only viewing, background best-effort saves, filter/order contracts and removal of numeric retention UI. Keep purge documentation truthful.
- [x] Dispatch one fresh whole-change reviewer per executing-plans/requesting-code-review. Reproduce material findings with failing tests, fix, and rerun relevant/full checks as needed.
- [x] Leave changes reviewable in the attached workspace; do not deploy, merge or push. Commit focused completed changes only after verification, with final status and migration applicability explicit.

## Execution outcome

Executed inline in the attached `codex/login-history-ui` worktree. See `docs/superpowers/reports/2026-10-28-login-history-ui-verification.md` for observed checks and limits. The SQL suites could not run because no local Docker/PostgreSQL server was available; database execution remains a pre-deployment gate. No remote migration/deployment, merge or push was performed.
