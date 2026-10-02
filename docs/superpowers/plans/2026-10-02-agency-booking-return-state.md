# Agency Booking Return State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Return booking details opened from an agency detail to the same agency and filters.

**Architecture:** Add a typed, allowlisted agency-origin context to agency booking links. The booking detail route validates it with the agency detail query parser and uses the canonical agency detail href for its back link; ordinary booking links remain unchanged.

**Tech Stack:** Next.js App Router, TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-02-agency-booking-return-state-design.md`

## Global Constraints

- Never accept arbitrary return URLs.
- Preserve existing booking authorization and canonical routes.
- Preserve all validated agency detail filters, including amount and date ranges.

### Task 1: Add allowlisted agency-origin booking links

**Files:**
- Modify: `lib/dashboard-routes.ts`
- Test: `tests/dashboard-navigation.test.ts`

- [ ] Write a failing test showing an agency-origin booking href includes `fromAgency` and all agency-detail query state, while normal booking href remains unchanged.
- [ ] Implement `dashboardAgencyBookingDetailHref` to serialize only typed agency-detail state and `parseDashboardBookingOrigin` to validate it.
- [ ] Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard-navigation.test.ts`
- [ ] Commit: `git commit -m "feat: retain agency booking origin"`

### Task 2: Use agency origin for the booking-detail back link

**Files:**
- Modify: `app/admin/dashboard/bookings/[bookingId]/page.tsx`
- Test: `tests/dashboard.test.ts`

- [ ] Write a failing route render test for a booking opened from agency detail; assert its back link targets the agency detail with retained filters.
- [ ] Parse origin after authorization and use `dashboardAgencyDetailHref` plus the agency back label when present; retain ordinary bookings behavior otherwise.
- [ ] Run focused route tests, then `npm run typecheck && npm test`.
- [ ] Commit: `git commit -m "feat: return booking details to agency source"`
