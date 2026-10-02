# Dashboard UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract reusable Dashboard detail, summary, tab, and list-toolbar primitives and migrate Booking to them without changing its UI or behavior.

**Architecture:** Add focused presentational components under `components/admin/dashboard/`. Keep `DashboardDetails` as the booking-specific client orchestrator for tab state and deferred customer loading; the extracted layout components only compose already-rendered slots. Keep list-filter state and routing in `DashboardBookingFilters`, wrapping its existing controls with the reusable toolbar layout.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict mode, Tailwind CSS, shadcn/ui, Lucide Icons, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-02-dashboard-ui-primitives-design.md`

## Global Constraints

- Preserve Booking labels, spacing, links, route query behavior, authorization, and deferred customer loading exactly.
- Do not add dependencies, data fetching, Server Actions, or tabs for documents/history.
- Keep Server Components as the default; `DashboardTabs` is the only new client boundary.
- Use explicit TypeScript interfaces; do not use `any`.
- Run `npm run build:pwa` whenever source code changes before production build verification.

## Review Focus

- Desktop and mobile retain their distinct reading order: mobile header/summary/tabs/content; desktop header/tabs/content/summary.
- Selecting the customer tab still calls the existing authorized deferred loader only once and preserves its loading/error UI.
- The tab strip cannot render a disabled or inactive-placeholder tab.
- Toolbar extraction preserves search submit, month change reset behavior, desktop popover, and mobile bottom sheet.
- Empty booking result, nine-row pagination, and booking detail links retain their current behavior after JSX moves.

---

## File Structure

- Create: `components/admin/dashboard/dashboard-detail-layout.tsx` — responsive slots for booking-style detail pages.
- Create: `components/admin/dashboard/dashboard-summary-card.tsx` — standard desktop summary card frame.
- Create: `components/admin/dashboard/dashboard-tabs.tsx` — typed, enabled-only interactive tab strip.
- Create: `components/admin/dashboard/dashboard-list-toolbar.tsx` — list form and responsive filter-row frame.
- Modify: `components/admin/dashboard/dashboard-details.tsx` — consume detail layout, summary card, and tabs.
- Modify: `components/admin/dashboard/dashboard-booking-filters.tsx` — consume list toolbar while retaining all filter state and controls.
- Modify: `tests/dashboard.test.ts` — component-level and booking integration regression coverage.

### Task 1: Detail layout and summary-card primitives

**Files:**
- Create: `components/admin/dashboard/dashboard-detail-layout.tsx`
- Create: `components/admin/dashboard/dashboard-summary-card.tsx`
- Modify: `tests/dashboard.test.ts`

**Interfaces:**
- Produces `DashboardDetailLayout({ desktopHeader, mobileHeader, tabs, desktopContent, desktopSummary, mobileContent, mobileSummary }: DashboardDetailLayoutProps): ReactNode`.
- Produces `DashboardSummaryCard({ title, status, children }: DashboardSummaryCardProps): ReactNode`.
- `DashboardDetailLayout` takes only `ReactNode` slots and has no client directive or data dependency.

- [ ] **Step 1: Write the failing layout regression test**

Add a test that renders the new primitives with distinct slot text and asserts desktop and mobile containers, `max-w-7xl`, and summary-card title/status/children are present. Assert no client-only state or data props are required.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because the primitive modules do not exist.

- [ ] **Step 3: Implement the two presentational primitives**

Create the exact interfaces above. Preserve the existing Booking class names: `mx-auto min-w-0 max-w-7xl space-y-5`, mobile `lg:hidden`, and desktop two-column `lg:grid-cols-[minmax(0,1fr)_20rem]`. Implement `DashboardSummaryCard` with existing `Card`, `CardHeader`, `CardTitle`, and `CardContent` composition.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the primitive task**

```bash
git add components/admin/dashboard/dashboard-detail-layout.tsx components/admin/dashboard/dashboard-summary-card.tsx tests/dashboard.test.ts
git commit -m "feat: add dashboard detail layout primitives"
```

### Task 2: Enabled-only dashboard tabs

**Files:**
- Create: `components/admin/dashboard/dashboard-tabs.tsx`
- Modify: `tests/dashboard.test.ts`

**Interfaces:**
- Produces `DashboardTabs<T extends string>({ ariaLabel, tabs, value, onValueChange, className }: DashboardTabsProps<T>): ReactNode`.
- `DashboardTab<T>` has `label: string`, `icon: LucideIcon`, and `value: T`.
- `DashboardTabs` is a Client Component and renders `role="tablist"` and enabled `role="tab"` buttons only.

- [ ] **Step 1: Write the failing tab regression test**

Render tabs `booking`, `customer`, and `costs`; assert their labels, tab roles, and `aria-selected` state. Assert the output has no `disabled` attribute and does not contain document/history labels.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because `DashboardTabs` does not exist.

- [ ] **Step 3: Implement `DashboardTabs`**

Use the typed interface above and the current Booking tab button classes. Call `onValueChange(tab.value)` on click. Do not add unavailable tabs or data-loading logic.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the tab primitive task**

```bash
git add components/admin/dashboard/dashboard-tabs.tsx tests/dashboard.test.ts
git commit -m "feat: add dashboard detail tabs"
```

### Task 3: Migrate booking detail to the shared primitives

**Files:**
- Modify: `components/admin/dashboard/dashboard-details.tsx`
- Modify: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes `DashboardDetailLayout`, `DashboardSummaryCard`, and `DashboardTabs` from Tasks 1–2.
- Keeps `selectBookingTab(next: "booking" | "customer" | "costs"): void` as the sole owner of customer lazy loading.

- [ ] **Step 1: Write the failing Booking integration test**

Extend the existing booking detail rendering test to assert the extracted component source is used and keep existing assertions for mobile summary, summary-house link, customer loading marker, active tabs, and no disabled tabs.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because Booking still owns the duplicated layout, summary-card, and tab JSX.

- [ ] **Step 3: Replace booking-specific structural JSX with primitives**

Import and compose the three primitives while leaving `BookingSummaryContent`, booking tab panels, customer loading/error behavior, and all booking data formatting in `DashboardDetails`. Preserve rendered headings, links, data attributes, and responsive CSS classes.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS, including numeric booking-ID customer loading coverage.

- [ ] **Step 5: Commit the Booking detail migration**

```bash
git add components/admin/dashboard/dashboard-details.tsx tests/dashboard.test.ts
git commit -m "refactor: compose booking detail from dashboard primitives"
```

### Task 4: List toolbar primitive and Booking migration

**Files:**
- Create: `components/admin/dashboard/dashboard-list-toolbar.tsx`
- Modify: `components/admin/dashboard/dashboard-booking-filters.tsx`
- Modify: `tests/dashboard.test.ts`

**Interfaces:**
- Produces `DashboardListToolbar({ children, onSubmit }: DashboardListToolbarProps): ReactNode`.
- `onSubmit` is `FormEventHandler<HTMLFormElement>` and `children` contains the unchanged Booking search field and responsive filter row.
- `DashboardBookingFilters` continues to own `search`, `navigate`, popover/sheet open state, and all controls.

- [ ] **Step 1: Write the failing toolbar regression test**

Assert the toolbar renders one form with the existing search aria-label, month picker, desktop-only status/sort controls, desktop advanced-filter trigger, and mobile advanced-filter sheet trigger.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because the Booking filter form has not adopted `DashboardListToolbar`.

- [ ] **Step 3: Implement and adopt `DashboardListToolbar`**

Create the form wrapper with the current `mb-4 space-y-2` outer layout and receive the existing `onSubmit`. Move only structural form and filter-row wrappers into it; preserve the existing `DashboardBookingFilters` child controls and their exact responsive classes.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS with Booking search, filter, popover, and sheet behavior intact.

- [ ] **Step 5: Commit the toolbar migration**

```bash
git add components/admin/dashboard/dashboard-list-toolbar.tsx components/admin/dashboard/dashboard-booking-filters.tsx tests/dashboard.test.ts
git commit -m "refactor: share dashboard booking toolbar layout"
```

### Task 5: Full verification and handoff

**Files:**
- Modify: `public/sw.js` — regenerated PWA artifact when source changes.

**Interfaces:**
- Consumes all prior tasks; produces no new runtime interface.

- [ ] **Step 1: Regenerate the PWA artifact**

Run: `npm run build:pwa`

Expected: PWA precache generation succeeds and updates `public/sw.js` only if generated output differs.

- [ ] **Step 2: Run project verification**

Run: `npm test`

Expected: full Node test suite passes, with only the existing intentional skip if present.

Run: `npm run typecheck`

Expected: TypeScript exits 0.

Run: `npm run lint`

Expected: no lint errors; record any pre-existing warning separately.

Run: `npm run build`

Expected: Next production build exits 0.

- [ ] **Step 3: Manually verify the local booking route**

Open `/admin/dashboard/bookings/242?month=2026-10&status=confirmed&sort=updated-desc`; confirm only the three enabled tabs appear and the customer tab loads its associated customer details.

- [ ] **Step 4: Review the final diff and commit generated output**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add public/sw.js
git commit -m "build: refresh PWA service worker"
```
