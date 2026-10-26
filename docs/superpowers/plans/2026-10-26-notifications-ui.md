# Notifications UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mobile full-page notifications and desktop Sheet sharing the approved reference design and existing event data.

**Architecture:** Reuse NotificationsProvider and shadcn primitives. Add validated server-side category filtering before pagination through a new RPC, keeping recipient authorization and global unread counts.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, Supabase, Node test runner.

**Spec:** Approved design in this chat: full mobile page, desktop side panel, existing data only.

## Global Constraints
- No dependencies, deployment, fabricated amounts, slip actions, SMS/LINE claims or new notification events.
- Reuse existing navigation, permission checks, Push consent and read cutoff.
- Bangkok date groups; accessible labels, keyboard focus, empty/error/loading states.

## Review Focus
- Category filtering occurs before LIMIT/OFFSET; unread count remains global.
- Changing filters must not display previous category responses.
- Unread and read state are independent of event and current booking status.
- Mobile header is not duplicated; bottom navigation stays usable.
- Unknown counts and load errors must not appear as an empty inbox.

### Task 1: Filtered inbox
- [x] Add parser and grouping tests; run and observe failure.
- [x] Add filter type/parser, authorized filtered SQL RPC and repository/API/provider wiring.
- [x] Verify parser, pagination, count and scope with relevant tests.

### Task 2: Shared responsive inbox
- [x] Update UI expectations for category controls, date groups, real actions and empty states.
- [x] Extract shared inbox and event cards; reuse Sheet on desktop and add mobile route.
- [x] Integrate bell and mobile header; keep navigation and Push settings.
- [x] Verify UI tests and typecheck.

### Task 3: Review and verification
- [x] Review diff, run lint, tests and build, update notification documentation.
- [x] Record verification limits; leave changes reviewable in the existing feature checkout.

## Outcome
- Reviewed by a separate reviewer; stale post-read query race fixed and regression-tested.
- Build/typecheck pass; lint: 0 errors, 11 existing warnings.
- Default tests: 1262 pass, 4 opt-in skips; disposable PostgreSQL: 19 pass.
- Synthetic browser fixture checked at 360/390/768/1280px. Full authenticated browser navigation and real device Push remain untested.
- No deployment or remote migration application performed.
