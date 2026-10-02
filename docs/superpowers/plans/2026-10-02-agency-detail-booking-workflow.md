# Agency Detail Booking Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an agency detail show its existing monthly sales summary followed by the complete reusable booking-list workflow, scoped to that agency.

**Architecture:** Keep parent agency-list state and detail booking-list state in separate query keys, then adapt the latter to `DashboardBookingsQuery` for shared UI. Refactor the dashboard service so the summary keeps its existing created-date confirmed-sales definition while the agency booking rows use the same updated/check-in filtering, status, search, sort, and paging rules as the booking screen.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-02-agency-detail-booking-workflow-design.md`

## Global Constraints

- Keep `/admin/dashboard/agencies/[agencyId]`; do not add routes or dependencies.
- Derive the fixed agency scope solely from `[agencyId]` on the server.
- Default the detail booking workflow to `confirmed`; allow every existing booking status and filter.
- Keep the existing confirmed-sales summary above the booking workflow, based on the selected month's `created_at` data.
- Preserve the current booking list's table, mobile cards, controls, empty states, booking links, and visual-only amount fields.
- Use strict TypeScript with explicit contracts; do not use `any`.

## Review Focus

- An agency detail URL with `status=all` must still return only that route's agency bookings; pin this in Task 2 service tests.
- A check-in range must switch only the booking rows to `check_in`, not redefine the summary; pin this in Task 2 service tests.
- Parent `search`/`page` and detail `bookingSearch`/`bookingsPage` must remain independent; pin this in Task 1 route tests.
- Invalid, duplicate, and foreign query parameters must reject rather than silently changing scope; pin this in Task 1 route tests.
- Mobile output must retain cards and the desktop output must retain the booking table after reuse; pin this in Task 3 render tests.

---

## File Structure

- `lib/dashboard-routes.ts` — parse and serialize agency-detail parent and booking query namespaces; create booking UI/link adapters.
- `lib/dashboard.ts` — describe agency-detail booking filter state with the established booking status/sort types.
- `server/services/dashboard.ts` — authorize agency details, preserve summary aggregation, and filter booking rows by fixed agency with ordinary booking rules.
- `components/admin/dashboard/dashboard-booking-filters.tsx` — accept a typed navigation adapter without duplicating filter UI.
- `components/admin/dashboard/bookings-list.tsx` — accept typed filter, pager, and booking-link adapters while retaining its markup.
- `components/admin/dashboard/dashboard-details.tsx` — retain only the agency header/summary responsibility and compose the shared booking list below it.
- `app/admin/dashboard/agencies/[agencyId]/page.tsx` — parse route state, load the agency-scoped report, and pass serializable route state to the client detail component.
- `tests/dashboard-navigation.test.ts` — route parsing, serialization, resets, and foreign-key rejection.
- `tests/dashboard.test.ts` — service isolation/filter behavior and static UI composition coverage.
- `docs/dashboard.md` — document agency-detail booking behavior and its query-state split.

### Task 1: Define and verify agency-detail booking route state

**Files:**
- Modify: `lib/dashboard.ts`
- Modify: `lib/dashboard-routes.ts`
- Test: `tests/dashboard-navigation.test.ts`

**Interfaces:**
- Consumes: `DashboardAgenciesQuery`, `DashboardBookingsQuery`, `DashboardBookingSort`, and `DASHBOARD_STATUSES`.
- Produces: `DashboardAgencyDetailQuery` with `bookingSearch`, `bookingsPage`, `status`, optional `checkInFrom`/`checkInTo`, and `sort: DashboardBookingSort`; `dashboardAgencyDetailHref(query, agencyId, changes?)`; `dashboardAgencyDetailBookingQuery(query): DashboardBookingsQuery`; and `dashboardAgencyBookingDetailHref(query, agencyId, bookingId): string`.

- [ ] **Step 1: Write failing route tests for default and complete agency-detail booking filters**

Add tests that parse `month=2026-09`, parent `search`/`agencySort`/`page`, detail `status=waiting`, `bookingSearch=DV-201`, `checkInFrom=2026-09-03`, `checkInTo=2026-09-05`, `sort=price-asc`, and `bookingsPage=3`; assert the adapter produces the corresponding `DashboardBookingsQuery` with `search: "DV-201"` and `page: 3`.

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test -- --test-name-pattern="agency detail" tests/dashboard-navigation.test.ts`

Expected: FAIL because agency details do not parse the booking status/date range or expose the adapter.

- [ ] **Step 3: Implement the typed route model and href helpers in `lib/dashboard-routes.ts`**

Use `bookingSearch` and `bookingsPage` only for the detail workflow; preserve parent `month`, `search`, `agencySort`, and `page`. Apply the same allowlist, date-pair validation, default `confirmed`, default `updated-desc`, and reset-to-page-one behavior as `dashboardBookingsHref`; keep the route agency ID in the pathname only.

- [ ] **Step 4: Add rejection and reset tests**

Assert a booking filter change resets only `bookingsPage`, a parent agency filter change resets only parent `page`, and duplicate, invalid, or foreign fields (`agency`, `view`, `bookingId`) throw.

- [ ] **Step 5: Run route tests to verify they pass**

Run: `npm test -- --test-name-pattern="agency detail|agency routes" tests/dashboard-navigation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard.ts lib/dashboard-routes.ts tests/dashboard-navigation.test.ts
git commit -m "feat: add agency detail booking filters"
```

### Task 2: Apply booking-list semantics under fixed agency scope

**Files:**
- Modify: `server/services/dashboard.ts`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `DashboardAgencyDetailQuery` route state from Task 1.
- Produces: `loadDashboardAgency(repository, actorId, query: DashboardAgencyDetailQuery, agencyId: string): Promise<DashboardReport>`, with `report.detail.kind === "agency"` carrying the existing summary and `report.bookings` carrying the shared list page.

- [ ] **Step 1: Write failing service tests for fixed-agency, all-status booking data**

Create rows for two agencies plus unassigned data; request `status: "all"` for `agency-a` and assert every returned booking has `agency.id === "agency-a"`, including waiting/cancelled rows, while the summary remains confirmed-only.

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `npm test -- --test-name-pattern="agency detail lists|fixed-agency" tests/dashboard.test.ts`

Expected: FAIL because the current detail list is confirmed-only and uses independent sorting/filtering.

- [ ] **Step 3: Refactor `loadDashboardAgency` and `DashboardLoadOptions` to use `DashboardBookingsQuery`**

Load the summary using the current selected-month `created_at` behavior. Load visible booking rows using the same options as `loadDashboardBookings` (`updated_at`, or `check_in` for a complete date range; status, text search, `DashboardBookingSort`, page size 9), then filter by `agencyId` before pagination. Validate the agency against the authorized summary scope and preserve `unassigned` matching `agentId === null`.

- [ ] **Step 4: Add date/search/sort/paging service tests**

Assert check-in date mode, `bookingSearch`, `price-desc`, page two, and a no-match filtered state produce the same row behavior as the booking list without changing the summary card totals.

- [ ] **Step 5: Run the service tests to verify they pass**

Run: `npm test -- --test-name-pattern="agency detail lists|fixed-agency|agency booking search" tests/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/dashboard.ts tests/dashboard.test.ts
git commit -m "feat: scope agency bookings to booking workflow"
```

### Task 3: Make the booking workflow reusable without visual divergence

**Files:**
- Modify: `components/admin/dashboard/dashboard-booking-filters.tsx`
- Modify: `components/admin/dashboard/bookings-list.tsx`
- Modify: `components/admin/dashboard/dashboard-details.tsx`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: Task 1's href/query adapters and Task 2's agency-scoped `DashboardReport`.
- Produces: `DashboardBookingFilters` and `BookingsList` optional adapter props that accept `DashboardBookingsQuery` changes and return agency-detail URLs; agency details render `BookingsList` below their summary.

- [ ] **Step 1: Write failing static render tests for shared agency booking UI**

Render the agency detail with rows and assert the summary card markup occurs before the booking toolbar; assert the desktop booking-table headings, mobile booking cards, status controls, and agency booking-detail links match the shared list output.

- [ ] **Step 2: Run the render tests to verify they fail**

Run: `npm test -- --test-name-pattern="agency detail.*booking|booking workflow" tests/dashboard.test.ts`

Expected: FAIL because `DashboardDetails` renders a custom agency booking form/table/cards.

- [ ] **Step 3: Add optional navigation adapters to `DashboardBookingFilters` and `BookingsList`**

Keep the default behavior as the existing booking route. For agency detail, accept a `(changes: Partial<DashboardBookingsQuery>) => string` callback and a `(bookingId: string) => string` callback, then use them for filter navigation, pager links, and booking rows. Do not copy or rewrite the desktop/mobile markup.

- [ ] **Step 4: Compose `BookingsList` from the agency branch of `DashboardDetails`**

Remove the agency-only booking form, custom rows, and custom pager. Keep `DashboardTaskHeader` and the existing agency summary card before the shared `BookingsList`; create the Task 1 query and href callbacks inside this client component from `agencyQuery` and `report.detail.agency.id` (including `unassigned`), so no function crosses the Server Component boundary.

- [ ] **Step 5: Run render tests to verify they pass**

Run: `npm test -- --test-name-pattern="agency detail.*booking|booking workflow" tests/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/dashboard/dashboard-booking-filters.tsx components/admin/dashboard/bookings-list.tsx components/admin/dashboard/dashboard-details.tsx tests/dashboard.test.ts
git commit -m "feat: reuse booking list in agency details"
```

### Task 4: Wire the route and document the behavior

**Files:**
- Modify: `app/admin/dashboard/agencies/[agencyId]/page.tsx`
- Modify: `docs/dashboard.md`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: Task 1's `parseDashboardAgencyDetailQuery` and Task 2's `loadDashboardAgency` signature.
- Produces: an agency detail page that maps serializable route state to the shared booking workflow and preserves the parent-list back link.

- [ ] **Step 1: Write a failing route composition test**

Assert an agency detail with no booking parameters passes `status: "confirmed"`, `sort: "updated-desc"`, empty booking search, and page one to the loader/UI contract while preserving parent agency-list return state.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="agency detail.*default" tests/dashboard.test.ts`

Expected: FAIL because the page passes the old positional booking search/page/sort arguments.

- [ ] **Step 3: Update `app/admin/dashboard/agencies/[agencyId]/page.tsx` and `docs/dashboard.md`**

Pass the complete detail query to `loadDashboardAgency` and `DashboardDetails`, without passing callbacks across the Server Component boundary. Document that summary uses monthly confirmed created-date data while the booking list uses booking-filter date rules and a fixed route agency scope.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --test-name-pattern="agency detail.*default" tests/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the final verification suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

Expected: type check, tests, and production build pass; lint has no new errors (document any pre-existing warning separately).

- [ ] **Step 6: Commit**

```bash
git add app/admin/dashboard/agencies/[agencyId]/page.tsx docs/dashboard.md tests/dashboard.test.ts
git commit -m "docs: describe agency booking detail filters"
```
