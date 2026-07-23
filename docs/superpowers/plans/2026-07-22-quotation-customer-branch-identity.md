# Quotation Customer Branch Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow one juristic tax ID to have one main-office customer and multiple uniquely numbered branch customers without weakening inactive duplicate protection or individual uniqueness.

**Architecture:** Keep one ข้อมูลลูกค้า row per quotation-selectable location. PostgreSQL partial unique indexes remain the race-safe authority; the repository mirrors the same identity rules for friendly duplicate feedback. Existing server-only service-role writes, RLS reads, DBD flow, and five-field quotation snapshots remain unchanged.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgreSQL/RLS, Node.js `node:test`.

## Global Constraints

- Apply schema changes only to local Supabase; do not touch linked or remote databases.
- Do not edit existing migrations; create one new migration with the installed Supabase CLI.
- Keep exact 13-ASCII-digit tax-ID validation.
- Treat `head_office` and `unspecified` as the same juristic main identity.
- Preserve branch numbers as trimmed strings, including leading zeros.
- Keep inactive rows inside uniqueness checks and preserve inactive reactivation flow.
- Keep individual tax IDs unique across individual rows.
- Add no dependencies; only the main agent edits.

---

### Task 1: Branch-aware ข้อมูลลูกค้า identity

**Files:**
- Create: `supabase/migrations/*_quotation_customer_branch_identity.sql`
- Modify: `server/repositories/quotation-customers.ts`
- Modify: `app/admin/quotations/customers/actions.ts`
- Modify: `components/admin/quotations/customers/customer-form.tsx`
- Modify: `components/admin/quotations/customers/customer-picker-dialog.tsx`
- Modify: `tests/quotation-customer-migration.test.ts`
- Modify: `tests/quotation-customer-database-integration.test.ts`
- Modify: `tests/quotation-customer-repository-behavior.test.ts`
- Modify: `tests/quotation-customer-repository-actions.test.ts`
- Modify: `tests/quotation-customer-service.test.ts`
- Modify: `tests/quotation-customer-ui.test.ts`
- Modify: `docs/quotation-management.md`
- Modify: `docs/superpowers/specs/2026-07-22-quotation-customer-master-dbd-design.md`

**Interfaces:**
- Replace `findQuotationCustomerByTaxId(client, taxId)` with `findQuotationCustomerByIdentity(client, input)`.
- Juristic branch identity is `customer_type + tax_id + trimmed branch_number`.
- Juristic non-branch identity is `customer_type + tax_id + main`.
- Individual identity is `customer_type + tax_id`.

- [x] **Step 1: Write failing tests**

Add assertions that main plus distinct branches succeed, duplicate branch identity resolves the existing active/inactive row, branch whitespace is normalized without removing leading zeros, individuals remain unique, and branch labels render in duplicate/picker UI.

- [x] **Step 2: Verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-migration.test.ts tests/quotation-customer-repository-behavior.test.ts tests/quotation-customer-repository-actions.test.ts tests/quotation-customer-service.test.ts tests/quotation-customer-ui.test.ts
```

Expected: failures show the tax-only constraint/lookup and missing branch labels.

- [x] **Step 3: Implement the minimum fix**

Create the migration with `npx.cmd --no-install supabase migration new quotation_customer_branch_identity`. Normalize existing branch values, replace the tax-only constraint with three partial unique indexes, and add canonical branch checks. Change the repository/action duplicate lookup to the same identity rules and show branch identity in the existing duplicate and picker displays.

- [x] **Step 4: Verify GREEN and full gates**

Run focused tests, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build`.

- [x] **Step 5: Apply and verify local only**

Run `npx.cmd --no-install supabase migration up --local --include-all --yes`, verify `migration list --local`, then run `tests/quotation-customer-database-integration.test.ts` with credentials derived from `supabase status -o env`. Never use `--linked` or a remote DB URL.

- [x] **Step 6: Review and commit**

Run the required read-only `webook_reviewer`, fix only evidence-backed Critical/Important findings, rerun affected checks, and commit the branch-aware identity change.
