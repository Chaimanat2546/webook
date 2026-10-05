# Dashboard New House Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard’s basic new-house detail with a responsive, server-authorized detail that shows only actual house media, prices, facilities, and operational information.

**Architecture:** Keep `DashboardHouse` as the concise list contract and add a focused rich house-detail contract to `lib/dashboard.ts`. The Dashboard service first verifies admin access and selected-month membership using `newHouses`, then asks the repository for the rich record; a dedicated presentational component renders that safe DTO inside the existing Dashboard detail route.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Tailwind CSS, existing shadcn/ui components, Supabase repository, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-05-dashboard-new-house-detail-design.md`

## Global Constraints

- This Dashboard reporting route does not use the House Workspace Shell.
- Do not add dependencies or expose privileged Supabase clients, secrets, or storage credentials.
- Use actual listing, image, price, and enabled-facility data only; never create review scores, review counts, internal codes, owner names, or extra-bed counts.
- `extra_beds` is an extra-bed price and must be labelled accordingly.
- Keep all authorization in `server/services`; repository methods only query data.
- Use existing semantic design tokens and shadcn/project primitives.
- Preserve the selected-month boundary and the existing link to `/admin/houses/[propertyId]`.

## Review Focus

- An authenticated non-admin must receive `DashboardForbidden` before either month-house or rich-detail data is queried.
- An admin requesting a listing outside the selected month must receive `DashboardItemNotFound` and must not query the rich detail.
- Image display URLs must continue through `buildHouseImageDisplayUrl`, including legacy source URLs, rather than exposing raw or unusable media links.
- `null`/empty optional content must omit only the affected content or render its documented empty state without collapsing primary house facts.
- The rendered UI must never contain star ratings, review counts, `H-` internal codes, an owner name, or an extra-bed quantity.

---

## File Structure

- Modify: `lib/dashboard.ts` — define narrow rich house-detail DTOs used only after list membership authorization.
- Modify: `server/repositories/dashboard.ts` — add query-only rich-detail retrieval and map Supabase rows to DTOs.
- Modify: `server/services/dashboard.ts` — authorize list membership before loading the rich detail and attach it to `DashboardHouseDetail`.
- Create: `components/admin/dashboard/dashboard-house-detail.tsx` — focused responsive presentation for gallery, identity, facts, prices, facilities, operations, and notes.
- Modify: `components/admin/dashboard/dashboard-details.tsx` — delegate the house branch to the focused component while retaining route/back-link behavior.
- Modify: `tests/dashboard.test.ts` — cover repository mapping, authorization order, selected-month handling, and rendered populated/empty states.

### Task 1: Rich data contract and authorized data flow

**Files:**
- Modify: `lib/dashboard.ts:190-254`
- Modify: `server/repositories/dashboard.ts:8-17, 117-145`
- Modify: `server/services/dashboard.ts:41-94`
- Test: `tests/dashboard.test.ts:684-750, 1026-1060`

**Interfaces:**
- Consumes: existing `DashboardHouse`, `DashboardMonth`, `DashboardScope`, `buildHouseImageDisplayUrl`, and `DashboardRepository.newHouses(month)`.
- Produces: `DashboardHouseDetailData` with listing facts, `images`, weekly `prices`, and enabled `facilities`; `DashboardRepository.houseDetail(propertyId)`; `DashboardHouseDetail` carrying `house` and `data`.

- [ ] **Step 1: Write failing service tests for rich-detail authorization and membership**

Add tests that assert a non-admin `loadDashboardHouse` neither calls `newHouses` nor `houseDetail`; an out-of-month/missing list ID calls `newHouses` but never `houseDetail` and throws `DashboardItemNotFound`; and an in-month ID calls `houseDetail` only after list membership is found.

- [ ] **Step 2: Run the focused service tests to verify they fail**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because `DashboardRepository.houseDetail` and the rich detail result do not exist.

- [ ] **Step 3: Write failing repository mapping tests**

Add Supabase-client tests asserting that the listing query requests only the specified detail fields, the image query maps display URLs through `buildHouseImageDisplayUrl`, the price query keeps weekday/base-guests/De Ville/agency/note values, and the facility query keeps enabled entries and optional messages. Include legacy S3-style media input and optional null fields.

- [ ] **Step 4: Run the focused repository tests to verify they fail**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because no rich-detail repository method is implemented.

- [ ] **Step 5: Define `DashboardHouseDetailData` and its focused child interfaces in `lib/dashboard.ts`**

Add explicit interfaces for listing metadata/operations, display images, daily prices, and enabled facilities. Keep `DashboardHouse` unchanged for list and overview consumers. Extend `DashboardHouseDetail` with `data: DashboardHouseDetailData`.

- [ ] **Step 6: Implement `houseDetail(propertyId: string): Promise<DashboardHouseDetailData | null>` in `server/repositories/dashboard.ts`**

Query one listing by its already-authorized `property_id`, then its images, prices, and facilities. Use the existing safe display URL builder for each image, normalize optional scalar values with the existing helpers, preserve day ordering, and return `null` only when the listing is absent. Do not query users/owners, reviews, or bookings.

- [ ] **Step 7: Attach rich data only after selected-month membership is established in `server/services/dashboard.ts`**

In the `house` view branch, find the list record first. If absent, throw `DashboardItemNotFound`; otherwise call `repository.houseDetail(house.propertyId)` only when a valid property ID exists, reject a missing detail as not found, and build the enriched `DashboardHouseDetail`. Keep the existing admin-only check before any new-house reads.

- [ ] **Step 8: Run focused tests to verify the data flow passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS with authorization-order and repository-mapping tests green.

- [ ] **Step 9: Commit the data-flow task**

```bash
git add lib/dashboard.ts server/repositories/dashboard.ts server/services/dashboard.ts tests/dashboard.test.ts
git commit -m "feat: load dashboard house detail data"
```

### Task 2: Responsive factual house-detail presentation

**Files:**
- Create: `components/admin/dashboard/dashboard-house-detail.tsx`
- Modify: `components/admin/dashboard/dashboard-details.tsx:204-224`
- Test: `tests/dashboard.test.ts:336-360`

**Interfaces:**
- Consumes: `DashboardHouseDetail`, `DashboardQuery`, `backHref`, `backLabel`, and existing dashboard formatting helpers.
- Produces: `DashboardHouseDetailView` (or equivalently named focused presentational export) rendered from the house branch of `DashboardDetails`.

- [ ] **Step 1: Write failing render tests for populated rich detail**

Build a rich-detail fixture with gallery images, all seven prices, enabled facilities, insurance, sort order, timestamps, extra-bed price, description, tags, and note. Assert semantic headings/labels, price values, gallery count, current house-management link, and compact facts. Assert the resulting HTML does not contain star/review strings, an `H-` code, an owner-name label, or wording that treats the extra-bed price as a quantity.

- [ ] **Step 2: Write failing render tests for empty optional data**

Use a fixture with no images, prices, enabled facilities, description, tags, note, update date, and extra-bed price. Assert the gallery, price, and facility empty states render and optional content cards/rows are absent without a broken image.

- [ ] **Step 3: Run focused UI tests to verify they fail**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: FAIL because the existing generic `<dl>` detail does not render the rich layout or its empty states.

- [ ] **Step 4: Implement the focused detail view in `components/admin/dashboard/dashboard-house-detail.tsx`**

Compose existing `DashboardTaskHeader`, `Card`, `Badge`, `Button`, and `Table` primitives into the spec’s desktop/mobile order. Render gallery image alt text from the house title and image metadata; render facts, a seven-day price table, enabled facilities, operations, and notes with the documented empty/omit rules. Keep it server-renderable and avoid client state unless an existing project primitive requires it.

- [ ] **Step 5: Delegate the `house` branch from `components/admin/dashboard/dashboard-details.tsx`**

Replace only the house-specific presentation block with the focused view. Preserve `DashboardDetails` behavior for booking and agency branches, selected-month return URL construction, and the existing management URL.

- [ ] **Step 6: Run focused UI tests to verify they pass**

Run: `node --import ./tests/register-server-only.mjs --test tests/dashboard.test.ts`

Expected: PASS with populated, empty, mobile-safe, and truthfulness assertions green.

- [ ] **Step 7: Run type and lint checks**

Run: `npm run typecheck && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 8: Commit the presentation task**

```bash
git add components/admin/dashboard/dashboard-house-detail.tsx components/admin/dashboard/dashboard-details.tsx tests/dashboard.test.ts
git commit -m "feat: present dashboard house details"
```

### Task 3: Full verification and review

**Files:**
- Verify: `lib/dashboard.ts`
- Verify: `server/repositories/dashboard.ts`
- Verify: `server/services/dashboard.ts`
- Verify: `components/admin/dashboard/dashboard-house-detail.tsx`
- Verify: `components/admin/dashboard/dashboard-details.tsx`
- Verify: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: completed tasks 1 and 2.
- Produces: verified implementation matching the approved specification.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests pass; any pre-existing skipped test remains documented by the test runner.

- [ ] **Step 2: Build the application**

Run: `npm run build`

Expected: command exits 0.

- [ ] **Step 3: Inspect the final diff for scope and sensitive-data regressions**

Run: `git diff --check HEAD~2..HEAD && git status --short`

Expected: no whitespace errors; only intentional Dashboard detail/test/documentation changes are present. Do not commit generated build artifacts.

- [ ] **Step 4: Request a fresh code review**

Ask a reviewer to check authorization ordering, Supabase query scope, responsive rendering, and the absence of fabricated customer-facing data before declaring the feature complete.
