# House Route Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Control house-management routes and Server Actions through the existing `allow_accommodation`, `allow_price`, and `allow_cost` values.

**Architecture:** Add small capability helpers in `server/auth/admin.ts`. The house list requires any house capability, while each list action, direct route, section, and mutation checks the capability for that work. `allow_cost` renders a read-only Agency-price view.

**Tech Stack:** Next.js App Router, React Server Components and Server Actions, TypeScript, Tailwind CSS, shadcn/Radix Dropdown Menu, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-08-31-house-route-permissions-design.md`

## Global Constraints

- Use existing `allow_tools` keys only; do not add a key.
- Do not create or apply a migration; do not change RLS or database policies.
- Preserve the existing `role_id = 1` rating-edit rule.
- `allow_price` wins when it is combined with `allow_cost`.
- `allow_cost` alone sees Agency prices only and must never submit a price write.
- Unauthorized direct house routes return the existing not-found response.
- Preserve `/admin/houses` `returnTo` query behavior.
- Use strict TypeScript with no `any`.

---

## File Structure

- `server/auth/admin.ts` — house capability predicates and the list-route guard.
- `app/admin/layout.tsx`, `components/layout/admin-shell.tsx`, `components/layout/admin-desktop-sidebar.tsx` — Houses visibility separate from Advertisements visibility.
- `app/admin/houses/page.tsx`, `components/admin/houses/house-list.tsx` — house list authorization and filtered per-house menu.
- `app/admin/houses/[propertyId]/page.tsx` — section guards, filtered navigation, and read-only Agency prices.
- `app/admin/houses/[propertyId]/actions.ts` — independent mutation authorization.
- `app/admin/houses/[propertyId]/images/page.tsx`, `app/admin/houses/[propertyId]/images/actions.ts` — accommodation-only image boundary.
- `tests/admin-auth.test.ts`, `tests/house-list-ui.test.ts`, `tests/house-detail-shell-ui.test.ts`, `tests/house-detail-actions.test.ts`, `tests/house-image-actions.test.ts`, `tests/house-images-ui.test.ts` — authorization regressions.

### Task 1: Add central capabilities and separate Houses navigation

**Files:**
- Modify: `server/auth/admin.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- Produces `canAccessHouses(user)`, `canViewHousePrices(user)`, and `requireHouseListAdmin()`.
- `canAccessHouses` permits `allow_accommodation`, `allow_price`, or `allow_cost`.
- `canViewHousePrices` permits `allow_price` or `allow_cost`; existing `canManageHousePrices` remains `allow_price` only.

- [ ] **Step 1: Write the failing test**

```ts
assert.equal(canAccessHouses({ allow_tools: { allow_cost: true } }), true);
assert.equal(canAccessHouses({ allow_tools: { allow_price: true } }), true);
assert.equal(canAccessHouses({ allow_tools: {} }), false);
assert.equal(canViewHousePrices({ allow_tools: { allow_cost: true } }), true);
assert.equal(canManageHousePrices({ allow_tools: { allow_cost: true } }), false);
```

Also assert that the layout passes `canAccessHouses` separately from `canUseAccommodation`, and the sidebar uses the former for Houses and the latter for Advertisements.

- [ ] **Step 2: Verify red**

Run: `node --import ./tests/register-server-only.mjs --test tests/admin-auth.test.ts`

Expected: FAIL because the predicates and sidebar prop do not exist.

- [ ] **Step 3: Implement minimal code**

```ts
export function canAccessHouses(user: Pick<AdminUserForAuth, "allow_tools"> | null): boolean {
  return user?.allow_tools?.allow_accommodation === true
    || user?.allow_tools?.allow_price === true
    || user?.allow_tools?.allow_cost === true;
}

export function canViewHousePrices(user: Pick<AdminUserForAuth, "allow_tools"> | null): boolean {
  return user?.allow_tools?.allow_price === true || user?.allow_tools?.allow_cost === true;
}
```

Add `allow_cost` to `AdminAllowTools`. `requireHouseListAdmin()` calls `requireAdmin()` then `notFound()` when `canAccessHouses` is false. Thread `canAccessHouses` through layout and sidebar without changing Advertisement access.

- [ ] **Step 4: Verify green**

Run: `node --import ./tests/register-server-only.mjs --test tests/admin-auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/auth/admin.ts app/admin/layout.tsx components/layout/admin-shell.tsx components/layout/admin-desktop-sidebar.tsx tests/admin-auth.test.ts
git commit -m "feat: derive house access from allow tools"
```

### Task 2: Authorize the list and filter its per-house menu

**Files:**
- Modify: `app/admin/houses/page.tsx`
- Modify: `components/admin/houses/house-list.tsx`
- Test: `tests/house-list-ui.test.ts`

**Interfaces:**
- Consumes `requireHouseListAdmin`, `canUseAccommodation`, and `canViewHousePrices`.
- `HouseList` receives `canManageAccommodation: boolean` and `canViewPrices: boolean`.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(listSource, /canManageAccommodation: boolean/);
assert.match(listSource, /canViewPrices: boolean/);
assert.match(listSource, /section", "facilities"/);
assert.match(listSource, /section", "prices"/);
assert.match(listSource, /mode", "cover-select"/);
assert.match(pageSource, /requireHouseListAdmin/);
```

Assert that every link adds the existing `returnTo`, accommodation links are conditional on `canManageAccommodation`, and the price link is conditional on `canViewPrices`.

- [ ] **Step 2: Verify red**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-list-ui.test.ts`

Expected: FAIL because the list currently requires accommodation and always shows generic data/image actions.

- [ ] **Step 3: Implement minimal code**

Use `requireHouseListAdmin()` in `HousesPage`, derive capabilities from its `adminUser`, and pass them to `HouseList`. In `HouseActionsMenu`, render these links only when allowed:

```ts
// allow_accommodation: details, facilities, images, cover-select mode
// allow_price or allow_cost: prices section
```

Use `URLSearchParams` for each link, placing `section=facilities`, `section=prices`, or `mode=cover-select` alongside `returnTo`.

- [ ] **Step 4: Verify green**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-list-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/houses/page.tsx components/admin/houses/house-list.tsx tests/house-list-ui.test.ts
git commit -m "feat: filter house list actions by permission"
```

### Task 3: Guard detail sections and render Agency-only prices

**Files:**
- Modify: `app/admin/houses/[propertyId]/page.tsx`
- Test: `tests/house-detail-shell-ui.test.ts`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- `details` and `facilities` consume `canUseAccommodation`.
- `prices` consumes `canViewHousePrices`; its editor consumes `canManageHousePrices`.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(pageSource, /selectedSection === "prices" && !canViewPrices/);
assert.match(pageSource, /selectedSection !== "prices" && !canManageAccommodation/);
assert.match(pageSource, /canViewPrices && !canManagePrices/);
assert.match(pageSource, /ราคาขาย Agency/);
```

Assert that the cost-only branch omits Deville values, omits `saveHousePricesAction`, and renders no submit button.

- [ ] **Step 2: Verify red**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-detail-shell-ui.test.ts tests/admin-auth.test.ts`

Expected: FAIL because the detail route currently calls `requireAccommodationAdmin()` before any section can load.

- [ ] **Step 3: Implement minimal code**

Load the session with `requireAdmin()` and derive `canManageAccommodation`, `canViewPrices`, and `canManagePrices`. Return `notFound()` before loading the house when the selected section is not permitted. Filter section navigation by the same booleans.

For full price access, keep the existing editable form. For `allow_cost` alone, render a seven-day read-only Agency-price list; do not render a Deville input, a form action, hidden price values, or a save button. Keep the rating rule unchanged.

- [ ] **Step 4: Verify green**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-detail-shell-ui.test.ts tests/admin-auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/houses/[propertyId]/page.tsx tests/house-detail-shell-ui.test.ts tests/admin-auth.test.ts
git commit -m "feat: guard house sections by allow tools"
```

### Task 4: Enforce server-action and image boundaries

**Files:**
- Modify: `app/admin/houses/[propertyId]/actions.ts`
- Modify: `app/admin/houses/[propertyId]/images/page.tsx`
- Modify: `app/admin/houses/[propertyId]/images/actions.ts`
- Test: `tests/house-detail-actions.test.ts`
- Test: `tests/house-image-actions.test.ts`
- Test: `tests/house-images-ui.test.ts`

**Interfaces:**
- Details, facilities, images, and cover ordering require `allow_accommodation`.
- Price saving requires `allow_price` only; it does not require `allow_accommodation`.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(priceActionSource, /assertCanManageHousePrices\(canManageHousePrices\(adminUser\)\)/);
assert.doesNotMatch(priceActionSource, /assertCanUseAccommodation\(canUseAccommodation\(adminUser\)\)/);
assert.match(imageActions, /assertCanUseAccommodation\(adminUser\)/);
assert.match(imagePage, /requireAccommodationAdmin\(\)/);
```

Assert separately that details/facilities retain accommodation checks and every image operation retains its accommodation check.

- [ ] **Step 2: Verify red**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-detail-actions.test.ts tests/house-image-actions.test.ts tests/house-images-ui.test.ts`

Expected: FAIL because price saving currently also requires accommodation.

- [ ] **Step 3: Implement minimal code**

Remove the accommodation assertion only from `saveHousePricesAction`; keep its `allow_price` assertion. Keep `HouseImagesPage` and every image Server Action accommodation-only. Do not alter database access or image-storage behavior.

- [ ] **Step 4: Verify green**

Run: `node --import ./tests/register-server-only.mjs --test tests/house-detail-actions.test.ts tests/house-image-actions.test.ts tests/house-images-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/houses/[propertyId]/actions.ts app/admin/houses/[propertyId]/images/page.tsx app/admin/houses/[propertyId]/images/actions.ts tests/house-detail-actions.test.ts tests/house-image-actions.test.ts tests/house-images-ui.test.ts
git commit -m "fix: enforce house mutation permissions"
```

### Task 5: Verify no legacy database policy changes

**Files:**
- Test: all existing tests

**Interfaces:**
- Consumes the completed route and action boundaries.
- Produces verification evidence only; no migration or permission key is created.

- [ ] **Step 1: Run complete verification**

Run: `npm test`

Expected: PASS with no failures.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS and includes `/admin/houses`, `/admin/houses/[propertyId]`, and `/admin/houses/[propertyId]/images`.

- [ ] **Step 2: Verify scope before final handoff**

Run: `git diff --name-only HEAD~4..HEAD`

Expected: no `supabase/migrations/` file and no `supabase` policy file. Confirm that no new `allow_` key appears outside the existing `allow_accommodation`, `allow_price`, and `allow_cost` keys.

