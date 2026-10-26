# Compact Notifications and Read-on-open Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Approved compact notification UI with global read-all after a visible inbox successfully opens.

**Architecture:** Reuse the authenticated read RPC and cursor provider. Mounted inboxes register a cancellable viewing session. The first accepted latest snapshot is marked read globally through its server cutoff; background polls/filter changes after that do not consume pending new items. Explicitly accepting new items marks the accepted cutoff. Direct detail navigation marks only its authorized item via a client action, never GET/prefetch.

**Tech Stack:** Existing React/Next.js, TypeScript, shadcn, Intl and Node tests. No dependencies or migrations.

**Spec:** Approved design in this chat: open = read all including unloaded history; 56px header, chips only, three-line cards, no read buttons or decorative green dot.

## Global Constraints
- Preserve cursor append, new-item prompt, authorization, responsive containers and Push settings.
- Do not read on hidden/background activity, failed loading or closing before a snapshot finishes.
- Do not clear the unread count before server acknowledgement.
- Keep essential event meaning, iCal origin, house title, DV, stay range and relative time.

## Review Focus
- Strict Mode/open-close-open races, failed reads and delayed requests.
- Global cutoff preserves PostgreSQL microseconds and includes unloaded/all-category rows.
- New arrivals remain unread until explicit acceptance; filter and poll do not silently read them.
- Direct Push detail entry reads only that item and still validates account identity.
- Long Thai titles, date ranges crossing month/year, touch targets and nested desktop scrolling.

### Task 1: Read lifecycle
- [x] Add failing provider tests for open, close, background, acceptance and failure.
- [x] Register stable inbox sessions and reuse the read action after accepted snapshots.
- [x] Replace detail read button with a read-on-view marker and expected-actor validation.
- [x] Run provider/action tests.

### Task 2: Compact UI
- [x] Add failing render/date tests for concise cards, iCal and removed controls.
- [x] Reduce headers, retain only filter chips and simplify cards/date headings.
- [x] Use shared primitives; keep whole-card navigation and keyboard focus.
- [x] Render mobile/desktop with the actual provider/local API fixture.

### Task 3: Verify and document
- [x] Independent review and material fixes.
- [x] Update docs and generated PWA; run build, typecheck, lint and tests.
- [x] Record verification and leave changes reviewable; no deployment requested for this revision.

## Completion evidence
- Independent review resolved pending acceptance across filters; browser QA resolved Sheet/page resize session cancellation. Both have regression tests.
- Build/typecheck pass; lint: 0 errors and 11 baseline warnings; default tests: 1285 pass and 4 opt-in skips. PostgreSQL cutoff/revocation checks: 2 pass.
- Synthetic actual-provider browser checks: 360/390/1280px, 56px headers, approximately 88px desktop cards, global read on opening, pending new items, category acceptance, resize and cursor append.
- Existing read RPC reused; no migration/dependency change or deployment.
