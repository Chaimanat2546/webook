# Quotation Input Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the approved quotation numbering, tax ID, office, VAT, optional-field, and always-visible item-control rules without rewriting existing documents.

**Architecture:** Keep one normalized `QuotationPayload` shared by editor and document surfaces. Validate at the server boundary and repeat durable rules with non-validating PostgreSQL constraints that protect new writes without scanning or rewriting legacy rows.

**Tech Stack:** Next.js, React, TypeScript, Tailwind/ShadcnUI, Supabase PostgreSQL, `node:test`

## Global Constraints

- Do not implement the deferred five-item master/catalog.
- Do not add dependencies or deploy/apply changes to a remote database.
- Do not edit existing migrations; create one new migration with the installed Supabase CLI.
- Preserve existing document numbers and readable legacy snapshots.
- Use native radio and input controls, mobile first.

---

### Task 1: Shared validation and types

**Files:**
- Modify: `lib/quotation-types.ts`
- Modify: `server/services/quotations.ts`
- Test: `tests/quotation-service.test.ts`

**Interfaces:**
- Produces: `OfficeType = "unspecified" | "head_office" | "branch"`
- Produces: server-normalized VAT pairs `taxable/7`, `taxable/0`, or `none/0`

- [ ] Add failing service tests for both 13-digit tax IDs, unspecified offices, branch requirements, and the three VAT choices.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts` and confirm failures describe the missing rules.
- [ ] Add the smallest shared regex/enum checks and preserve the current head-office defaults.
- [ ] Re-run the service test and confirm it passes.

### Task 2: Editor and seller settings

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: the expanded `OfficeType` and normalized VAT pairs from Task 1
- Produces: native office radio controls and a single VAT choice control

- [ ] Replace source assertions for the removed settings menu with failing assertions for always-visible discount/VAT controls, digit-limited tax inputs, radio office inputs, disabled branch inputs, and `(ถ้ามี)` subject copy.
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts` and confirm the new assertions fail.
- [ ] Remove the item visibility state/toggles/confirmations and render both controls directly.
- [ ] Map VAT choices directly: `7 -> taxable/7`, `0 -> taxable/0`, `none -> none/0`.
- [ ] Render office radios and always-mounted disabled branch inputs for seller settings, seller snapshot, and customer snapshot.
- [ ] Re-run the UI test and confirm it passes.

### Task 3: Preview, Print, Public, and PDF output

**Files:**
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-pdf.tsx`
- Test: `tests/quotation-pdf.test.ts`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `OfficeType` and existing `QuotationDocumentViewModel`
- Produces: blank VAT cells for `none`, visible `0%`, and conditional optional metadata

- [ ] Add failing assertions that empty reference/subject rows are absent, unspecified offices produce no office label, `0%` remains visible, and `none` produces no cell copy.
- [ ] Run the focused PDF/UI tests and confirm the assertions fail.
- [ ] Update both renderers without changing their existing layout boundaries.
- [ ] Re-run the focused tests and confirm they pass.

### Task 4: Non-destructive database rules

**Files:**
- Create: `supabase/migrations/*_quotation_input_rules.sql`
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Produces: `private.next_quotation_number(date)` returning `QO-YYYYMMDD0001`
- Produces: new-write constraints for office types, tax IDs, branch numbers, and VAT pairs

- [ ] Add failing static migration assertions and update the integration payload to contain complete seller/customer snapshots.
- [ ] Run the migration test and confirm the new migration is missing.
- [ ] Run the installed CLI help, then create the migration with `supabase migration new quotation_input_rules`.
- [ ] Add only `create or replace function private.next_quotation_number` and named `NOT VALID` constraints; do not update or truncate rows.
- [ ] Re-run migration tests. If local Supabase credentials are configured, run `RUN_QUOTATION_DB_TESTS=1 npm test -- tests/quotation-database-integration.test.ts`.

### Task 5: Documentation and final verification

**Files:**
- Modify: `docs/quotation-management.md`
- Modify: `docs/manuals/quotation/README.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1-4
- Produces: current operator/developer documentation

- [ ] Replace obsolete optional-control, tax, office, numbering, and reference copy in the two existing docs.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Inspect `git diff --check` and the final scoped diff.
