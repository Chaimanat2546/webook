# Dashboard Route Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overloaded dashboard view query with dedicated overview, booking, agency, house, and detail routes.

**Architecture:** Keep repository reads and aggregation rules server-side. Add focused route parsers and service loaders, render them in a shared Dashboard shell, and give each list/detail route only its own query state.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Tailwind, shadcn/ui, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-dashboard-route-separation-design.md`

## Global Constraints

- Preserve Bangkok month boundaries, confirmed-sales definitions, ten-row pagination, and repository-only Supabase access.
- Do not add dependencies or client-side monthly report filtering.
- Agency display data remains admin-only; owners cannot access agency or house-history routes.
- Keep desktop booking table/mobile booking cards and omit booking code from list columns.

## Review Focus

- Legacy URLs retain only destination-relevant filters after redirect.
- Owner agency/house requests are denied before repository reads.
- Detail Back preserves its parent list query without session storage.
- A month change resets route-local filters and pagination.
- Missing and foreign details have the same response and expose no agency data.

---

### Task 1: Define canonical route contracts

**Files:**
- Modify: `lib/dashboard.ts`
- Create: `lib/dashboard-routes.ts`
- Modify: `lib/dashboard-navigation.ts`
- Test: `tests/dashboard-navigation.test.ts`

**Interfaces:**
- Produces `DashboardOverviewQuery`, `DashboardBookingsQuery`, `DashboardAgenciesQuery`, `DashboardHousesQuery`, route parsers, `dashboardRouteHref()`, and a legacy-to-canonical mapper.

- [ ] **Step 1: Write failing tests for route queries and hrefs**

Cover accepted route-specific parameters, rejected foreign parameters, month reset, canonical hrefs, and old `view/from` conversion.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern "dashboard route"`

Expected: FAIL because canonical route helpers do not exist.

- [ ] **Step 3: Implement route-local parsers and href builders**

Keep Bangkok parsing in shared utilities; remove `view`, `from`, `housesPage`, and `agenciesPage` from canonical contracts.

- [ ] **Step 4: Implement the pure legacy URL mapping helper**

Map each validated legacy list/detail state to its canonical path and discard irrelevant filters.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --test-name-pattern "dashboard route"`

```bash
git add lib/dashboard.ts lib/dashboard-routes.ts lib/dashboard-navigation.ts tests/dashboard-navigation.test.ts
git commit -m "refactor: add dashboard route query contracts"
```

### Task 2: Split dashboard loaders by use case

**Files:**
- Modify: `server/services/dashboard.ts`
- Modify: `server/repositories/dashboard.ts`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Produces `loadDashboardOverview`, `loadDashboardBookings`, `loadDashboardBookingDetail`, `loadDashboardAgencies`, `loadDashboardAgencyDetail`, `loadDashboardHouses`, and `loadDashboardHouseDetail`.

- [ ] **Step 1: Write failing focused-loader tests**

Prove each loader projects only its route DTO, booking agencies are admin-only, and denied owner routes make no admin-only reads.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern "dashboard.*route|owner.*agency|owner.*house"`

- [ ] **Step 3: Extract shared authorization and aggregation helpers**

Keep scope resolution, source validation, month filtering, sales aggregation, agency grouping, and house grouping private in `server/services/dashboard.ts`.

- [ ] **Step 4: Implement each focused loader and verify GREEN**

Run: `npm test -- --test-name-pattern "dashboard.*route|owner.*agency|owner.*house"`

- [ ] **Step 5: Commit**

```bash
git add server/services/dashboard.ts server/repositories/dashboard.ts tests/dashboard.test.ts
git commit -m "refactor: split dashboard report loaders"
```

### Task 3: Build canonical server routes and shared shell

**Files:**
- Modify: `app/admin/dashboard/page.tsx`
- Create: `app/admin/dashboard/bookings/page.tsx`
- Create: `app/admin/dashboard/bookings/[bookingId]/page.tsx`
- Create: `app/admin/dashboard/agencies/page.tsx`
- Create: `app/admin/dashboard/agencies/[agencyId]/page.tsx`
- Create: `app/admin/dashboard/houses/page.tsx`
- Create: `app/admin/dashboard/houses/[id]/page.tsx`
- Create: `components/admin/dashboard/dashboard-shell.tsx`
- Modify: `components/admin/dashboard/dashboard-view.tsx`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes Task 1 query contracts and Task 2 loaders.
- Produces canonical server pages inside `DashboardShell`.

- [ ] **Step 1: Write failing page tests**

Bundle every page with the auth fixture; assert canonical headings/links, owner denial, and missing/foreign detail 404 behavior.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern "dashboard canonical pages"`

- [ ] **Step 3: Implement `DashboardShell` and pages**

Move the heading/month form into the shell. Each page parses only its own query, invokes its focused loader, and uses `notFound()` for inaccessible details.

- [ ] **Step 4: Remove the `DashboardView` route switch and verify GREEN**

Run: `npm test -- --test-name-pattern "dashboard canonical pages"`

- [ ] **Step 5: Commit**

```bash
git add app/admin/dashboard components/admin/dashboard/dashboard-shell.tsx components/admin/dashboard/dashboard-view.tsx tests/dashboard.test.ts
git commit -m "feat: add canonical dashboard routes"
```

### Task 4: Separate UI workflows and remove duplicate components

**Files:**
- Modify: `components/admin/dashboard/dashboard-overview.tsx`
- Modify: `components/admin/dashboard/dashboard-lists.tsx`
- Modify: `components/admin/dashboard/dashboard-details.tsx`
- Modify: `components/admin/dashboard/dashboard-rows.tsx`
- Create: `components/admin/dashboard/bookings-list.tsx`
- Create: `components/admin/dashboard/agencies-list.tsx`
- Create: `components/admin/dashboard/new-houses-list.tsx`
- Create: `components/admin/dashboard/dashboard-list-primitives.tsx`
- Delete: `components/admin/dashboard/agency-sales.tsx`
- Delete: `components/admin/dashboard/dashboard-back-link.tsx`
- Delete: `lib/dashboard-return.ts`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes Task 1 href helpers and Task 2 DTOs.
- Produces one focused component per list, with shared presentational primitives only.

- [ ] **Step 1: Write failing UI composition tests**

Assert overview links are canonical, each form has only local filters, bookings render semantic desktop table/mobile cards, and obsolete client-side agency/return components are not imported.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern "dashboard list composition|dashboard overview links"`

- [ ] **Step 3: Extract presentation primitives and focused lists**

Move pagination and empty state to route-neutral primitives. Build `BookingsList`, `AgenciesList`, and `NewHousesList` with server-driven forms, rows, and route-local links.

- [ ] **Step 4: Simplify overview/details and delete duplicates**

Use direct canonical links and route-local back links. Delete `agency-sales.tsx`, `dashboard-back-link.tsx`, `lib/dashboard-return.ts`, and unused `view/from` helpers after zero-import verification.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --test-name-pattern "dashboard list composition|dashboard overview links"`

```bash
git add components/admin/dashboard lib/dashboard-return.ts tests/dashboard.test.ts
git commit -m "refactor: separate dashboard list workflows"
```

### Task 5: Redirect old URLs and verify the complete migration

**Files:**
- Modify: `app/admin/dashboard/page.tsx`
- Modify: `docs/dashboard.md`
- Modify: `tests/dashboard-navigation.test.ts`
- Modify: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes Task 1 legacy mapping and canonical routes from Tasks 2–4.
- Produces compatibility redirects and current dashboard documentation.

- [ ] **Step 1: Write failing legacy redirect tests**

Cover old overview/list/detail URLs, dropped irrelevant state, and malformed legacy inputs.

- [ ] **Step 2: Verify RED and implement redirect-only legacy behavior**

Run: `npm test -- --test-name-pattern "legacy dashboard redirect"`

Render overview only for the canonical overview URL; otherwise redirect the old `view` URL to Task 1's target.

- [ ] **Step 3: Update documentation and verify focused tests**

Run: `npm test -- --test-name-pattern "legacy dashboard redirect|dashboard canonical pages|dashboard list composition"`

- [ ] **Step 4: Run final verification**

Run: `npm run build:pwa && npm run typecheck && npm run lint && npm test && npm run build`

Expected: all commands pass; only the existing `worker.ts` lint warning may remain.

- [ ] **Step 5: Commit**

```bash
git add app/admin/dashboard/page.tsx docs/dashboard.md tests/dashboard-navigation.test.ts tests/dashboard.test.ts
git commit -m "refactor: redirect legacy dashboard URLs"
```

## Self-review

- Every approved route, loader, UI boundary, redirect, authorization rule, and verification requirement maps to Tasks 1–5.
- Query contracts are established before service loaders, and loaders before routes/components that consume them.
- All Review Focus failure modes have explicit test coverage in Tasks 1, 2, 3, or 5.
- The plan avoids changes to sales rules, storage, unrelated admin modules, and dependencies.
