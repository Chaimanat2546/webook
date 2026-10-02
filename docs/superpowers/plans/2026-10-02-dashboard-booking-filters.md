# Dashboard Booking Filters Implementation Plan

> **For implementer:** Use the `superpowers:executing-plans` skill to execute this plan task by task.

**Goal:** Add query-backed booking-list filters for an updated-at Bangkok month, search, booking status, and sorting while retaining the existing desktop table, mobile cards, and nine-record pagination.

**Architecture:** Keep URL parsing and links in `lib/`, fetch only the internal fields needed for filtering in the repository, apply booking-list business rules in the dashboard service, and render the controls through a focused client component. The existing custom `ThaiMonthPicker` remains the month-selection UI; no date-range picker is introduced.

**Tech Stack:** Next.js App Router, React/TypeScript, Tailwind CSS, Supabase, Node.js test runner.

---

### Task 1: Define the booking-list query contract and URL serialization

**Files:**
- Modify: `lib/dashboard.ts`
- Modify: `lib/dashboard-routes.ts`
- Modify: `tests/dashboard.test.ts`

**Step 1: Add focused failing tests**

Add route-contract tests covering:

- Booking queries default to the current Bangkok `month`, `status=confirmed`, and `sort=updated-desc`.
- Accepted sorts are `checkin-desc`, `price-desc`, `price-asc`, and `updated-desc`.
- Search text is trimmed and page numbers are normalized.
- `agency` is ignored/rejected for this route; it must not be retained in booking-list links.
- `dashboardBookingsHref` serializes the selected month, search, status, and sort, resets the page for filter changes, and preserves page only for pagination.

**Step 2: Run the focused test to confirm it fails**

Run: `npm test -- --test-name-pattern="dashboard|booking query" tests/dashboard.test.ts`

Expected: FAIL because the booking query has no sort/default-confirmed contract yet.

**Step 3: Implement query types and parser**

In `lib/dashboard.ts`:

- Introduce a `DashboardBookingSort` union and label map for the four agreed values.
- Change `DashboardBookingsQuery` to contain only booking-list controls: `month`, `search`, `status`, `sort`, and `page`.
- Remove `agency` from this route-specific contract.

In `lib/dashboard-routes.ts`:

- Parse the booking route separately from generic dashboard/agency queries.
- Use current Bangkok month as the fallback, `confirmed` as the booking-list status fallback, and `updated-desc` as sort fallback.
- Keep generic dashboard parsing unchanged so overview counts retain their present created-at semantics.
- Update `dashboardBookingsHref` and any legacy/detail helper that forwards booking-list query state to include `sort` and omit `agency`.

**Step 4: Run focused tests**

Run: `npm test -- --test-name-pattern="dashboard|booking query" tests/dashboard.test.ts`

Expected: PASS.

**Step 5: Commit**

Do not commit independently: the worktree contains user changes. Leave this task staged nowhere and continue to the next task.

---

### Task 2: Fetch the internal filter fields and apply booking-list rules

**Files:**
- Modify: `lib/dashboard.ts`
- Modify: `server/repositories/dashboard.ts`
- Modify: `server/services/dashboard.ts`
- Modify: `tests/dashboard.test.ts`

**Step 1: Add failing service/repository-contract tests**

Cover these cases with existing dashboard test fixtures:

- The booking-list month window tests `updated_at`, not `created_at`.
- Search matches exactly the requested data classes: house name, DV code, customer full name, and agency name.
- Default output is confirmed bookings sorted by `updated_at` descending.
- Each named sort is deterministic; null price values remain after priced rows.
- Owner scopes remain constrained to their seller while administrator scope still sees all allowed bookings.

**Step 2: Run the focused test to confirm it fails**

Run: `npm test -- --test-name-pattern="dashboard|booking" tests/dashboard.test.ts`

Expected: FAIL because source rows do not expose updated/customer fields and current filtering uses created-at ordering.

**Step 3: Extend the internal source shape only**

Add `updatedAt`, `customerFirstName`, and `customerLastName` to `DashboardBookingSource`. Do not add customer personally identifiable fields to the public `DashboardBooking` list DTO or client props.

**Step 4: Adjust repository selection safely**

Update the dashboard repository booking query to select:

- `updated_at` for internal filtering/sorting.
- The minimal customer name relation fields needed to compose the search value.

Use the established booking-to-customer relation syntax already used elsewhere in this codebase. Preserve the current explicit seller/owner scope clauses and all booking visibility filters. Make the date-column selector explicit in the repository API, defaulting to `created_at` for existing dashboard callers and using `updated_at` only for the booking-list loader.

**Step 5: Implement service filtering and sorting**

In `server/services/dashboard.ts`:

- Pass the booking-list date selector as `updated_at`; leave overview data loading unchanged.
- Create a booking-list-specific text matcher using only house title, DV code, customer full name, and agency name. Do not silently retain booking-code search for this new filter.
- Filter according to the requested status before sorting and pagination.
- Implement `updated-desc`, `checkin-desc`, `price-desc`, and `price-asc` with stable tie-breakers. Keep null price values at the end for both price sorts.
- Continue returning only the existing public booking row shape and retain `DASHBOARD_BOOKINGS_PAGE_SIZE = 9`.

**Step 6: Run focused tests**

Run: `npm test -- --test-name-pattern="dashboard|booking" tests/dashboard.test.ts`

Expected: PASS.

**Step 7: Commit**

Do not commit independently; continue with the UI task.

---

### Task 3: Build responsive controls around the existing Thai month picker

**Files:**
- Create: `components/admin/dashboard/dashboard-booking-filters.tsx`
- Modify: `components/admin/dashboard/bookings-list.tsx`
- Modify: `tests/dashboard.test.ts`

**Step 1: Add failing UI contract tests**

Verify rendered booking-list markup includes:

- A search field with placeholder/accessible label describing house name, DV, customer, and agency search.
- The project `ThaiMonthPicker`, not a native month input or a new date-range picker.
- Status control defaulting to `ติดจอง` (`confirmed`) and sort control defaulting to `จองล่าสุด` (`updated-desc`).
- No agency dropdown, query field, or filter label.
- Desktop full-width search above the remaining controls, plus mobile compact controls compatible with horizontal overflow.

**Step 2: Run focused test to confirm it fails**

Run: `npm test -- --test-name-pattern="booking filters|dashboard" tests/dashboard.test.ts`

Expected: FAIL because the filters are currently native form controls and include agency handling.

**Step 3: Create the client filter component**

Create `DashboardBookingFilters` as a small client component that:

- Receives the parsed booking query and a URL-building callback or target pathname.
- Uses the existing `ThaiMonthPicker` component for month changes.
- Updates URL state through Next navigation, resetting `page` to 1 for any filter change.
- Provides search submission (and optional clear behavior only if already supported by the design), status selection, and sort selection.
- Uses existing project UI primitives/icons where applicable; do not add packages.

**Step 4: Compose the controls into the list page**

Replace the current filter form in `BookingsList` with `DashboardBookingFilters`.

- On desktop, place a full-width search row above a row containing month, status, and sort controls.
- On mobile, retain the compact search field and make the filter control row horizontally scrollable rather than compressing controls until they collide.
- Keep desktop table behavior, mobile separate-card behavior, empty state, detail links, and pagination links intact.

**Step 5: Run focused UI tests**

Run: `npm test -- --test-name-pattern="booking filters|dashboard" tests/dashboard.test.ts`

Expected: PASS.

**Step 6: Commit**

Do not commit independently; continue to verification.

---

### Task 4: Verify the integrated feature and documentation impact

**Files:**
- Modify if behavior diverges during implementation: `docs/superpowers/specs/2026-10-02-dashboard-booking-filters-design.md`

**Step 1: Run targeted tests**

Run: `npm test -- tests/dashboard.test.ts`

Expected: PASS.

**Step 2: Run static checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS, or only pre-existing unrelated warnings must be reported without alteration.

**Step 3: Review the working diff**

Run: `git diff --check`

Expected: PASS with no whitespace errors.

Run: `git diff -- lib/dashboard.ts lib/dashboard-routes.ts server/repositories/dashboard.ts server/services/dashboard.ts components/admin/dashboard/bookings-list.tsx components/admin/dashboard/dashboard-booking-filters.tsx tests/dashboard.test.ts`

Expected: Changes limited to the agreed booking-list query, internal source data, service logic, responsive controls, and tests.

**Step 4: Update the design spec only if needed**

If implementation requires a material user-visible deviation, amend the design spec to record the exact final behavior. Otherwise no further documentation change is needed because the approved spec already documents the feature contract.

**Step 5: Prepare handoff**

Report the changed files, validation results, and any existing unrelated lint warning. Do not create a commit unless ภู explicitly asks, because the worktree contains unrelated user changes.
