# Business Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Execution method is Native, as previously selected by the user.

**Goal:** Implement the approved compact business dashboard with complete booking, agency-sales and new-house list/detail flows.

**Architecture:** Keep `/admin/dashboard` as a server-rendered entry point with an allowlisted view query. The server service scopes and aggregates the monthly source, then returns only bounded list pages, preview rows and the selected authorized detail. Compose reusable feature components from existing UI primitives.

**Tech Stack:** Next.js 16.3.4 App Router, React, strict TypeScript, Tailwind, existing shadcn/ui, Lucide, Supabase, Node.js Test Runner, Cloudflare/OpenNext.

**Spec:** `docs/superpowers/specs/2026-09-30-business-dashboard-redesign.md`.

## Global Constraints

- Default month is the current month in Asia/Bangkok; one month applies to all views.
- Booking count includes all statuses. Sales and agency sales remain confirmed-only integer-satang totals.
- Overview previews are three rows per section. List page size is 10; this is a data limit, not a screen-fit guarantee.
- Owners receive only their authorized house data, with no agency or new-house payload. Admin-only views fail closed for owners.
- Reuse the current admin shell and existing UI primitives. No new dependency or schema migration is planned.
- Preserve all existing dirty changes. Do not commit unrelated files or erase the current dashboard work.
- No invented growth, profit or occupancy values; calculation information stays in a small disclosure.
- Build/PWA generation and PWA reproducibility tests run sequentially.
- Only `npm run deploy:cf:staging` may deploy Staging; verify the exact targets in the spec. Never print secrets.

## Review Focus

1. Deep links to foreign items or admin-only views: fail closed without exposing whether the foreign record exists (Task 2).
2. Filters and pagination through agency drilldown: preserve the full-month headline and share denominator (Tasks 2 and 4).
3. Zero sales, missing prices and unknown statuses: no NaN/Infinity, zero-division shares or hidden count discrepancy (Tasks 2 and 3).
4. Long Thai names, large money values and 100+ records at 320px: readable status/money, bounded previews and no horizontal overflow (Tasks 3 and 4).
5. Direct detail entry and Back navigation: retain month/filter/page and restore list context without external return URLs (Tasks 1 and 4).

## File map

| File | Responsibility |
| --- | --- |
| `lib/dashboard.ts` | Existing DTOs, typed views/query, safe detail contracts |
| `lib/dashboard-navigation.ts` (new) | Allowlisted report links and fallback Back links |
| `lib/dashboard-calculations.ts` (new) | Share percentage and date-only stay-night calculations |
| `server/services/dashboard.ts` | Authorized aggregation, previews, filtered pages and selected details |
| `server/repositories/dashboard.ts` | Preserve scoped monthly Supabase reads; change only if a required safe field is absent |
| `app/admin/dashboard/page.tsx` | Validate query, authenticate and select the view |
| `app/admin/dashboard/loading.tsx` | Loading structure matching the new compact screen |
| `components/admin/dashboard/dashboard-view.tsx` | Shared header/scope/month and view composition |
| `components/admin/dashboard/dashboard-overview.tsx` (new) | Summary and three preview sections |
| `components/admin/dashboard/dashboard-summary.tsx` (new) | Sales and clickable status distribution |
| `components/admin/dashboard/dashboard-rows.tsx` (new) | Shared responsive booking, agency and new-house rows |
| `components/admin/dashboard/dashboard-lists.tsx` (new) | Search/filter forms and shared bounded Pagination composition |
| `components/admin/dashboard/dashboard-details.tsx` (new) | Booking, agency and house details |
| `components/admin/dashboard/dashboard-back-link.tsx` (new) | Small client wrapper/Back link for source scroll/focus restoration |
| `components/admin/dashboard/agency-sales.tsx` | Adapt the existing feature to a compact preview; remove whole-array client filtering from active composition |
| `tests/dashboard.test.ts` | Service authorization, totals, pagination and rendered behavior |
| `tests/dashboard-navigation.test.ts` (new) | Query/link/back and calculations behavior |
| `docs/dashboard.md` | Final reporting, navigation and architecture documentation |

`agency-chart.tsx` and `components/ui/chart.tsx` are not used by the new layout. Preserve existing dependency and unrelated changes; removal is not required for this plan.

## Task 1: Define validated view and navigation contracts

**Files:** `lib/dashboard.ts`, new `lib/dashboard-navigation.ts`, new `lib/dashboard-calculations.ts`, `tests/dashboard-navigation.test.ts`.

**Interfaces:**

- `DashboardViewName = 'overview' | 'bookings' | 'agencies' | 'houses' | 'booking' | 'agency' | 'house'`.
- Extend `DashboardQuery` with `view`, `from: 'overview' | 'bookings' | 'agencies' | 'houses'`, `bookingId`, `houseId`, `agencySearch`, `houseSearch`, `agenciesPage`. Retain `month/status/search/agency/page/housesPage`.
- Detail IDs default to empty strings and are bounded single strings; repeated arrays are rejected. `agency='unassigned'` denotes the null-agency bucket. Missing required IDs in detail views reject validation.
- `dashboardHref(query: DashboardQuery, changes: Partial<DashboardQuery>): string` builds a same-origin relative dashboard URL from allowlisted keys; omit start/end and default empty filters. Reset the affected page when filter values change.
- `dashboardBackHref(query: DashboardQuery): string` restores the allowlisted `from` view, preserving its filters/pages and dropping selected detail IDs.
- `dashboardShare(amountCents: number, totalCents: number): number | null` returns null for zero total.
- `dashboardNights(checkIn: string, checkOut: string): number | null` compares valid YYYY-MM-DD dates with UTC date-only arithmetic; invalid/nonpositive stays return null.

- [x] Write behavior tests for default overview/current Bangkok month, all seven allowlisted views, required IDs, array/unknown-view rejection and legacy booking-filter URLs selecting `bookings` when `view` is absent.
- [x] Pin Back behavior: a booking detail entered from waiting page two returns to the same month/status/search/page; a direct detail uses a safe dashboard fallback. No user-provided return URL is accepted.
- [x] Pin calculations: `dashboardShare(2500,10000) === 25`, zero denominator returns null; Sep 30 to Oct 2 is two nights, leap-day stays work, invalid dates return null.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/dashboard-navigation.test.ts` and verify new behavior fails before implementation.
- [x] Implement the interfaces, validation and pure helpers. Default `view` is overview for a bare/month-only URL; explicit booking filters without a view preserve old links. Legacy `housesPage` without a view selects houses. Month changes reset list/detail selection.
- [x] Run navigation and existing dashboard tests, adapting old query-object expectations to the new validated defaults.
- [x] Review the focused diff. Record a task commit only after the existing dirty baseline is deliberately included or preserved; never stage the workspace wholesale.

## Task 2: Produce scoped summaries, bounded lists and authorized details

**Files:** `lib/dashboard.ts`, `server/services/dashboard.ts`, `tests/dashboard.test.ts`; repository only if needed for a safe field.

**Interfaces:**

- Add `DashboardOverview { recentBookings: DashboardBooking[]; topAgencies: DashboardAgency[]; recentHouses: DashboardHouse[]; agencyCount: number; newHouseCount: number }` to the report. Owner values for admin-only arrays/counts are empty/zero.
- Change admin `agencies` to `DashboardPage<DashboardAgency>`; retain paginated `houses`. Only bounded rows cross the UI boundary.
- Add `DashboardHouseSales { propertyId: string; houseTitle: string; count: number; amountCents: number }`.
- Add nullable `detail` discriminated union: booking with safe `DashboardBooking` and optional admin-only `{ id: string | null; name: string }`; agency with `DashboardAgency`, `sharePercent: number | null`, `houseCount` and `topHouses: DashboardHouseSales[]`; house with `DashboardHouse`.
- Keep `loadDashboard(repository, actorId, raw, now): Promise<DashboardReport>`. Export a `DashboardItemNotFound` error for missing/foreign detail items; reuse `DashboardForbidden` for owner admin-view requests.

- [x] Write tests using 25 waiting, 5 confirmed, 2 cancelled, 1 repair and 1 null-status rows: count 34; filter pages contain only matching rows; full-month confirmed totals remain constant. Assert three preview rows independent of active list filters.
- [x] Test owner direct access to agency/house views and foreign booking detail; assert no foreign record or agency field appears anywhere in owner JSON.
- [x] Test 100 agencies: overview only three, list only ten, correct filtered total, zero/missing prices handled and full-month share denominator preserved.
- [x] Test agency detail reconciliation: its total equals the sum of its confirmed bookings; house groups use DV identity rather than title; top houses are limited to four and house count includes all contributing houses. Test unassigned bucket and duplicate house names.
- [x] Run dashboard tests and observe failures before implementing new report behavior.
- [x] Aggregate from the existing authorized full-month source, preserve integer-satang overflow checking, derive previews before list filters, paginate lists at 10, and look up selected details within the authorized month. Apply admin-only fields after authorization.
- [x] Derive owner preview only from scoped bookings. Sort using the spec's stable ordering. Unknown/missing/foreign details use the same not-found path.
- [x] Run dashboard/navigation tests and inspect serialized owner reports. Review before advancing.

## Task 3: Implement the approved overview and reusable rows

**Files:** `dashboard-view.tsx`, new overview/summary/rows components, `agency-sales.tsx`, route and loading files, relevant dashboard rendering tests.

**Interfaces:**

- `DashboardOverviewView({ report, query }: { report: DashboardReport; query: DashboardQuery })` consumes the Task 2 overview DTO.
- `DashboardSummary({ report, query })` shows sales and status distribution; unknown status is visible when nonzero.
- `DashboardBookingRow({ booking, href })`, `DashboardAgencyRow({ agency, sharePercent, href })`, `DashboardHouseRow({ house, href })` consume safe DTOs and relative URLs.
- Keep `DashboardHeader({ month, scope })` compatible with loading/error callers. Shared wrapper routes to overview/list/detail using the validated view.

- [x] Add rendered behavior tests for three overview rows and links leading to complete lists/details, all-status distribution, unknown legacy status visibility, owner admin-section omission and zero-sale share rendering.
- [x] Run the relevant rendering tests, then build the overview from existing Card/Badge/Button primitives and Lucide. Reuse row components in every preview. No prototype-only role switch or example data enters the app.
- [x] Match the approved layout: one combined sales/status surface, admin agency/new-house columns, latest booking section; mobile stacks and wraps names while keeping amounts/status visible. Use short “ปิดซ่อม” in compact rows and full status wording in details.
- [x] Show complete names; do not use rank-only chart labels. Preview remainder counts come from full totals. Currency keeps exact satang; do not copy prototype rounding into calculations.
- [x] Adapt the loading skeleton to the overview; preserve error/missing-price states.
- [x] Verify rendered behavior and inspect browser layouts at 320/390/768/1024/1440 with long names and large amounts. Record screenshots for review. No required data is hidden solely to achieve equal card height.
- [x] Review this independently visible overview deliverable before adding the remaining interactions.

## Task 4: Build list/detail navigation and contextual Back

**Files:** new lists/details/back-link components, route composition, `tests/dashboard.test.ts`, `tests/dashboard-navigation.test.ts`.

**Interfaces:**

- `DashboardLists({ report, query })` uses the bounded report page selected by `view`; GET forms preserve month/view and appropriate filters.
- `DashboardDetails({ detail, query })` consumes the Task 2 union, never an unscoped client lookup.
- `DashboardNavigationContext({ scopeKey, children }: { scopeKey: string; children: ReactNode })` records source URL, scroll offset and origin row ID when a dashboard detail link is clicked. Store only navigation state in a scope-keyed session entry, not booking/customer payloads. Rows expose stable DOM IDs and a detail-link marker.
- `DashboardBackLink({ href, label }: { href: string; label: string })` uses the allowlisted Task 1 Back URL. Its click marks a pending return; the wrapper restores scroll/focus once the exact source URL is rendered. Direct entry works as a normal link without stored state.
- All list/detail links use Task 1 URL helpers. A booking detail retains source-view query context; agency-to-bookings sets confirmed status and selected agency, page one.

- [x] Test rendered links and forms for month/filter/page retention, filtered total/range, safe fallback and empty states. Test repeated/invalid URL fields at the page boundary.
- [x] Implement complete booking/agency/house lists using shared rows, Input/Button and existing Pagination. Search is server-side GET navigation; clamp pages after filtering. Label booking row amount “ยอดจอง”, distinct from confirmed sales summaries.
- [x] Implement details with the approved fields, date-only nights, admin-only agency name, missing prices, repair amount placeholder and top-four agency house contributions.
- [x] Use full dashboard subviews rather than nested growing disclosures. The existing Sheet/Dialog options are not needed for the chosen interaction.
- [x] Implement the client wrapper and Back link above around the server-rendered views. Scope-key the navigation state, require exact source-URL matching, consume the pending return once, and clear stale state on month/scope change. Use the standard history behavior for browser Back; explicit Back always follows the validated source URL and restores recorded scroll/focus when available.
- [x] Verify in browser: overview -> status list -> page two -> booking -> Back; agency -> house contributions -> confirmed bookings; house history -> item -> Back; direct URL refresh; owner forbidden deep link; empty search; switching month from a detail.
- [x] Verify 100+ rows never become one expanded overview; no desktop/mobile horizontal overflow and all controls work by keyboard. Review links and scope again.

## Task 5: Document, verify and prepare Staging release

**Files:** `docs/dashboard.md`, plan checklist; generated `public/sw.js` through the build command.

- [x] Update dashboard documentation to describe views, previews, page size, Back behavior and unchanged sales/count rules. Remove obsolete descriptions of the old long expanded layout.
- [x] Review the final feature diff against every spec section, including data redaction, share calculations, date boundaries, stable ordering, missing values and error handling.
- [x] Run focused dashboard/navigation tests and typecheck/lint. Address new errors; document existing warnings by filename.
- [x] Run `npm run build`, then `npm run verify` sequentially. Require successful exit codes and no failed tests; report intentional skips. Do not regenerate PWA concurrently with its reproducibility test.
- [x] Review final screenshots in light/dark at target widths. Ensure the real app matches the approved layout and has all three information areas for Admin.
- [x] Record release-ready file changes and checks. Preserve pre-existing dirty work; only stage/commit the agreed dashboard changes and any required generated PWA output.
- [x] When implementation is authorized for release, verify Staging Supabase/account targets without exposing secrets; deploy using `npm run deploy:cf:staging`.
- [x] Verify the compiled bundle contains Staging project reference `sxvkhzhqtrpxgzumsswl` and no Production reference `rqizfiayvcbozlzuvbok`; inspect deployment exit code/version.
- [ ] Smoke-test live Staging overview, status filter, agency search/pagination/drilldown, new-house history, deep-link Back and owner scope. Confirm totals reconcile before handing off the Staging URL. No DB seeding or schema changes are needed.

Task 5 acceptance note: all release/build/deploy checks and Admin live smoke flows passed; the final smoke checkbox remains open only for a signed-in real-owner Staging check. No existing owner identity with a valid DV is available, and account/permission changes are outside this plan. See `docs/superpowers/reports/2026-09-30-business-dashboard-verification.md` for evidence and limitations.

## Planning self-review

- All three requested information areas have overview, complete list and selected-item coverage.
- All-status booking count and confirmed-only sales remain separate and tested.
- Native execution is preserved; no new execution-method decision is required.
- Every new DTO/helper has a consuming task; no arbitrary external return URL or privileged client access is planned.
- Existing repo reads already provide the data needed; no database migration, extra dependency or speculative business metric is included.
- The current turn changes documentation only. Implementation begins after the user reviews this concrete plan and asks to proceed.
