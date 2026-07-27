# Quotation Settings UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete MVP 3 of the approved quotation UX polish for seller, payment, and certification settings without changing persistence or security boundaries.

**Architecture:** Keep the existing server-rendered settings route and selected-section data loading. Add one small client navigation guard for mutation-based dirty state, then recompose the three existing client forms with responsive layout, local asset previews, Toast feedback, and first-error focus. Reuse all existing actions, upload helpers, UI primitives, and payment/certification state.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Sonner, existing dnd-kit packages, Node test runner.

## Global Constraints

- Do not change ownership, user linkage, quotation snapshots, RLS, upload APIs, actions, repositories, services, database schema, or migrations.
- Keep `company`, `payments`, and `certification` as independent URL-selected sections and independent save operations.
- Keep selected-section-only server loading.
- Use mutation-based dirty tracking; successful save resets only the mounted section.
- Show a local image preview immediately; an upload failure must revoke the temporary preview and reveal the previously saved asset without changing its stored value.
- Keep quotation-mode payment editing behavior unchanged; settings-only layout changes must be gated by `mode="master"`.
- Add no dependency.

---

### Task 1: Guard Dirty Section Navigation

**Files:**
- Create: `components/admin/quotations/quotation-settings-dirty.tsx`
- Modify: `app/admin/quotations/settings/company/page.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: `QuotationSettingsDirtyProvider`, `QuotationSettingsNavLink`, and `useQuotationSettingsDirty()` with `{ dirty, markDirty, markSaved }`.
- Consumes: existing real URL links, current section id, and each mounted section's successful save result.

- [ ] **Step 1: Write the failing navigation test**

Add a source-contract test that requires the provider, guarded links, `beforeunload`, `window.confirm`, current-link bypass, `onChangeCapture={markDirty}` for the seller form, wrapped payment/certification mutations, and `markSaved()` only in successful result branches.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="guards dirty quotation settings navigation" tests/quotation-ui.test.ts
```

Expected: FAIL because settings navigation uses plain `Link` and the forms have no shared dirty state.

- [ ] **Step 3: Implement the minimum guard**

Create a client context that stores one boolean, registers `beforeunload` only while dirty, and renders a Next `Link` whose click handler does nothing for the current URL but otherwise calls:

```ts
if (dirty && !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากส่วนนี้หรือไม่")) {
  event.preventDefault();
}
```

Wrap the existing local sidebar/mobile link row and selected content with the provider. Mark dirty from the existing form/list/certification mutations and call `markSaved()` only after the corresponding save action succeeds.

- [ ] **Step 4: Verify GREEN**

Run the focused test and then `npm.cmd run typecheck`.

- [ ] **Step 5: Commit**

```powershell
git add app/admin/quotations/settings/company/page.tsx components/admin/quotations/quotation-settings-dirty.tsx components/admin/quotations/company-profile-form.tsx tests/quotation-ui.test.ts
git commit -m "feat: guard dirty quotation settings"
```

### Task 2: Recompose Seller And Payment Settings

**Files:**
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Modify: `components/admin/quotations/payment-method-list.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing seller form fields, logo normalization/preview, `PaymentMethodList`, payment add/remove/reorder helpers, and save actions.
- Produces: flat seller field groups, settings-only payment cards, semantic field spans, first-error focus, Toast feedback, and separate action footers.

- [ ] **Step 1: Write failing seller/payment tests**

Require:

```ts
assert.match(form, /data-settings-group="registration"/);
assert.match(form, /data-settings-action-footer/);
assert.match(form, /toast\.success/);
assert.match(form, /focusFirstSettingsError/);
assert.match(payments, /mode === "master"/);
assert.doesNotMatch(payments, /mode === "master"[^]*lg:grid-cols-5/);
```

Also assert the conditional branch-number field and existing quotation-mode path remain present.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="flat seller settings|responsive master payment settings|settings save feedback" tests/quotation-ui.test.ts
```

Expected: FAIL because seller content is split across nested Cards, master payment rows use the five-column grid, and settings saves have no Toast/focus helper.

- [ ] **Step 3: Implement seller composition**

Keep one outer settings surface. Replace nested Cards with heading/separator groups using semantic spans: company name and address wide; tax id, phone, office type, and branch number content-sized; branch number remains conditional. Keep the current logo object URL lifecycle. Add a separated footer with live status left and a content-width Save button right, changing to full width below `sm`.

On failed save, preserve inline errors, show one summary Toast, then focus the first visible `[data-field]` or named control referenced by the returned field-error order. On success, show success Toast and clear dirty state.

- [ ] **Step 4: Implement settings-only payment composition**

For `mode="master"`, render each payment method as a rounded bordered Card-like article, allow header controls to wrap, and use natural column spans. Bank transfer must use no five-column grid at tablet; keep name/instructions wider than account type/number. Preserve quotation mode classes and every existing add/remove/reorder/upload behavior.

Add the same action-footer, pending disable, Toast, and first-error focus behavior to `PaymentMethodsSettings` without touching the save action.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-payment-methods.test.ts tests/quotation-payment-assets.test.ts
npm.cmd run typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add components/admin/quotations/company-profile-form.tsx components/admin/quotations/payment-method-list.tsx tests/quotation-ui.test.ts
git commit -m "feat: polish quotation seller and payment settings"
```

### Task 3: Polish Certification Assets And Complete MVP 3

**Files:**
- Modify: `components/admin/quotations/certification-fields.tsx`
- Modify: `components/admin/quotations/quotation-png-image-input.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Modify: `docs/quotation-management.md`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing PNG normalization, immediate upload action, saved asset URL, and certification state updater.
- Produces: responsive signer groups, compact stamp row, upload-time local preview with saved-value fallback, nearby error plus Toast, and certification action footer.

- [ ] **Step 1: Write failing certification/preview tests**

Require two-column signer layout from `md`, lightweight groups, a compact stamp row, and local preview creation before awaiting upload. Require the catch path to clear/revoke only the temporary object URL and leave `value` unchanged. Require certification save/upload Toasts and save disabled while upload fields are busy.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="compact certification settings|previews certification assets before upload|certification settings feedback" tests/quotation-ui.test.ts
```

Expected: FAIL because the current preview is assigned only after upload succeeds and certification uses heavier nested fieldsets without Toast feedback.

- [ ] **Step 3: Implement minimum certification polish**

Keep issuer and approver stacked on mobile and `md:grid-cols-2`; replace heavy nested fieldsets with lighter bordered groups, keep each signature preview in its signer group, and render the stamp as one compact asset row. Preserve all labels, error ids, state updates, and upload action.

In `QuotationPngImageInput`, create/set the temporary preview after client normalization but before awaiting `onChange(normalized)`. If upload rejects, revoke and clear the temporary URL so the existing saved `value` remains visible; show the existing inline error and one Toast summary. Revoke superseded/unmounted object URLs exactly once.

Add the certification action footer and first-error focus. Disable Save while saving or while `uploadingFields.size > 0`.

- [ ] **Step 4: Update documentation**

Document guarded URL navigation, mutation-based dirty state, independent section saves, responsive settings layouts, local preview fallback, Toast plus inline errors, and the unchanged DB/API/security boundaries in `docs/quotation-management.md`.

- [ ] **Step 5: Verify focused and full checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-assets.test.ts tests/quotation-payment-assets.test.ts tests/quotation-payment-methods.test.ts tests/quotation-repository-actions.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Manually verify `/admin/quotations/settings/company` at 390, 768, 1280, and 1536 pixels: no page-level horizontal overflow; mobile link row scrolls intentionally; active links and focus are visible; each save remains independent.

- [ ] **Step 6: Commit**

```powershell
git add components/admin/quotations/certification-fields.tsx components/admin/quotations/quotation-png-image-input.tsx components/admin/quotations/company-profile-form.tsx docs/quotation-management.md tests/quotation-ui.test.ts
git commit -m "feat: polish quotation certification settings"
```

## Self-Review

- Spec coverage: navigation, seller, payment, certification, actions/feedback, responsive acceptance, and unchanged backend boundaries are covered.
- Placeholder scan: no deferred implementation placeholder is present; orphan asset cleanup remains intentionally outside this UX-only MVP.
- Type consistency: all changes consume current component/action types; the only new interface is the dirty-state context.
