# Notification Infinite Scroll Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Approved infinite scrolling with `(created_at, id)` cursors and an explicit new-notification button.

**Architecture:** Keep detail/read/Push contracts. Add a cursor feed RPC, typed repository/service/API and a shared provider for full mobile page and desktop Sheet. Poll the latest batch and authorization/read-state window without replacing the visible feed. Accepting new items resets to the newest batch; loading more appends older rows without duplicates.

**Tech Stack:** Existing Next.js/React/TypeScript/Supabase, IntersectionObserver; no new dependencies.

**Spec:** User approved cursor pagination, infinite scroll, and a button when new items arrive in this chat.

## Global Constraints
- Retain prior UI changes, Bangkok date grouping, global unread/read-all, current recipient authorization, existing Push consent and responsive containers.
- New migration only; no remote migration/deployment. Cursor must preserve PostgreSQL microseconds and UUID tie ordering.
- Filter change and explicit refresh invalidate stale requests; polling must not reset scroll or append unseen new items.

## Review Focus
- Equal timestamps, inserts/deletions between batches and exhausted results.
- Overlapping load/poll/read/filter changes and late unauthorized responses.
- Revocation of a loaded item's access while preserving the remaining feed.
- Partial-load errors keep prior content; retry does not append duplicates.
- Mobile document scrolling and desktop nested scrolling, keyboard fallback, no observer retry loop.

### Task 1: Cursor feed contract
- [x] Add failing cursor validation and SQL integration tests.
- [x] Add types/parser, new authorized RPC, repository, service and API.
- [x] Verify real SQL: ties, new rows, category cursor, grants and revocation.

### Task 2: Provider and UI
- [x] Add failing provider and UI tests for append, new-item detection/acceptance, errors and stale requests.
- [x] Replace page state with cursor loading; retain rows during poll and reconcile access/read state.
- [x] Add native observer, load/retry fallback and new-items button to shared inbox.
- [x] Verify mobile/desktop fixture and targeted tests.

### Task 3: Review and complete
- [x] Independent code review; fix material findings with regression tests.
- [x] Update docs; regenerate PWA and run build/typecheck/lint/tests.
- [x] Record real verification limits and deployment prerequisite.

## Completion evidence
- Independent review resolved the frozen display clock, bounded revalidation payloads (100 rows/chunk) and exhausted-feed late commits.
- Build/typecheck pass. Lint: 0 errors, 11 baseline warnings. Default tests: 1273 pass/4 opt-in skips. Disposable PostgreSQL: 21 pass.
- Actual provider/local API fixture at 390px/1280px: automatic append, unchanged scroll on new arrival, explicit acceptance reset, retry deduplication, desktop inner-scroll and category reset observed.
- No remote migrations or deployment; apply 20261026100000_notification_cursor_feed.sql before releasing.
