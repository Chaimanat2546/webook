# Quotation Bank Account Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional bank account type to bank-transfer payment masters and quotation snapshots, then render it before the account number in Preview/Public/Print.

**Architecture:** Extend the existing payment-method value object with one allow-listed string field and carry it through the existing normalization, repository, RPC, and snapshot boundaries. Keep one shared Thai label mapper for UI and document rendering. Add one forward-only Supabase migration; do not edit historical migrations.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Supabase PostgreSQL/RPC/RLS, Node test runner, Tailwind/ShadcnUI.

## Global Constraints

- Supported values are exactly `""`, `savings`, `current`, and `fixed`.
- `""` means `ไม่ระบุ`; the field is never required.
- The field applies only to `bank_transfer`; every other payment type normalizes it to `""`.
- Preview/Public/Print use the saved quotation snapshot, never the current payment master.
- Display is `{Thai account type} {account number}` when specified, otherwise only `{account number}`.
- Add a new migration. Do not edit an existing migration or reset shared/production-like databases.
- Reuse the existing payment editor, repository, RPC, and shared quotation document; add no dependency or new abstraction layer.

---

## File Map

- `lib/quotation-payment-methods.ts`: account-type union, Thai labels, defaults, and type-switch clearing.
- `server/services/quotation-payment-methods.ts`: trusted normalization and Thai field validation.
- `server/services/quotations.ts`: quotation RPC payload mapping.
- `server/repositories/quotations.ts`: master/snapshot reads and master save mapping.
- `components/admin/quotations/payment-method-list.tsx`: bank-only select.
- `components/admin/quotations/quotation-document.tsx`: shared Preview/Public/Print text.
- `supabase/migrations/*_quotation_bank_account_type.sql`: columns, constraints, validation, saves, and public serialization.
- `tests/quotation-payment-methods.test.ts`: normalization behavior.
- `tests/quotation-migration.test.ts`: migration contract.
- `tests/quotation-repository-actions.test.ts`: repository/RPC field propagation.
- `tests/quotation-service.test.ts`: quotation snapshot payload.
- `tests/quotation-ui.test.ts`: editor and shared document behavior.
- `docs/quotation-management.md`: user-facing data and snapshot behavior.

---

### Task 1: Payment Account Type Model And Validation

**Files:**
- Modify: `lib/quotation-payment-methods.ts:1-87`
- Modify: `server/services/quotation-payment-methods.ts:1-119`
- Modify: `server/repositories/quotations.ts:215-335`
- Test: `tests/quotation-payment-methods.test.ts`
- Test: `tests/quotation-ui.test.ts:230-265`

**Interfaces:**
- Produces: `PaymentAccountType = "" | "savings" | "current" | "fixed"`.
- Produces: `PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string>`.
- Extends: `QuotationPaymentMethod.accountType: PaymentAccountType`.
- Preserves: all existing payment-type and QR-mode normalization.

- [ ] **Step 1: Add failing model and validation tests**

Add assertions equivalent to:

```ts
assert.equal(emptyPaymentMethod().accountType, "");
assert.equal(PAYMENT_ACCOUNT_TYPE_LABELS.savings, "ออมทรัพย์");
assert.equal(PAYMENT_ACCOUNT_TYPE_LABELS.current, "กระแสรายวัน");
assert.equal(PAYMENT_ACCOUNT_TYPE_LABELS.fixed, "ฝากประจำ");

const bank = preparePaymentMethods([{ ...validBank, accountType: "savings" }])[0];
assert.equal(bank.accountType, "savings");

assert.throws(
  () => preparePaymentMethods([{ ...validBank, accountType: "invalid" }]),
  (error) => error instanceof QuotationValidationError
    && error.fieldErrors["paymentMethods.0.accountType"] === "ประเภทบัญชีไม่ถูกต้อง",
);

const cash = preparePaymentMethods([{ ...validBank, accountType: "fixed", type: "cash" }])[0];
assert.equal(cash.accountType, "");

const changed = updatePaymentMethodType(
  { ...emptyPaymentMethod(), accountType: "current" },
  "promptpay",
);
assert.equal(changed.accountType, "");
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-payment-methods.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because `PaymentAccountType`, labels, and `accountType` do not exist.

- [ ] **Step 3: Add the minimal shared model**

Add to `lib/quotation-payment-methods.ts`:

```ts
export type PaymentAccountType = "" | "savings" | "current" | "fixed";

export const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  "": "ไม่ระบุ",
  current: "กระแสรายวัน",
  fixed: "ฝากประจำ",
  savings: "ออมทรัพย์",
};
```

Add `accountType: PaymentAccountType` to `QuotationPaymentMethod`, initialize it as `""` in `emptyPaymentMethod`, and clear it in `updatePaymentMethodType` whenever `type !== "bank_transfer"`.

- [ ] **Step 4: Normalize and validate at the server boundary**

In `server/services/quotation-payment-methods.ts`:

```ts
const ACCOUNT_TYPES: readonly PaymentAccountType[] = ["", "savings", "current", "fixed"];
const accountTypeValue = text(source.accountType, 40, `${prefix}.accountType`, errors);
const accountType = ACCOUNT_TYPES.includes(accountTypeValue as PaymentAccountType)
  ? accountTypeValue as PaymentAccountType
  : "";
if (accountTypeValue !== accountType) {
  errors[`${prefix}.accountType`] = "ประเภทบัญชีไม่ถูกต้อง";
}
```

Set `accountType` on the normalized method, add `accountType` to the bank-transfer relevant-field set, and force `accountType: ""` in every non-bank branch. Invalid account-type errors must be removed as irrelevant when the submitted payment type is not `bank_transfer`.

- [ ] **Step 5: Keep existing database reads compatible before the migration task**

The TypeScript model becomes required before the database column exists. Add the safe legacy default to both payment mappings in `server/repositories/quotations.ts`:

```ts
accountType: "",
```

Task 3 replaces these two defaults with `stringValue(method.account_type)` after Task 2 creates the column. Add `accountType: ""` to any explicitly typed test fixture reported by TypeScript; do not change inferred fixtures that already flow through `preparePaymentMethods`.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-payment-methods.test.ts tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- lib/quotation-payment-methods.ts server/services/quotation-payment-methods.ts server/repositories/quotations.ts tests/quotation-payment-methods.test.ts tests/quotation-ui.test.ts
git commit -m "feat: add quotation bank account types"
```

---

### Task 2: Forward-Only Database Migration

**Files:**
- Create: `supabase/migrations/*_quotation_bank_account_type.sql` using the exact path returned by the Supabase CLI
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Consumes: snake-case values `account_type = '' | savings | current | fixed`.
- Produces: `account_type` on `quotation_company_payment_methods` and `quotation_payment_methods`.
- Produces: master save, quotation save, and public read RPCs that preserve the field only for bank transfers.

- [ ] **Step 1: Discover the installed CLI command and create the migration**

Run:

```powershell
npx.cmd supabase migration --help
npx.cmd supabase migration new quotation_bank_account_type
```

Expected: a new file ending in `_quotation_bank_account_type.sql`. Use that returned path for every migration edit and commit in this task.

- [ ] **Step 2: Add failing migration contract tests**

Extend `tests/quotation-migration.test.ts` to require:

```ts
assert.match(accountTypeSql, /alter table public\.quotation_company_payment_methods[\s\S]*add column account_type text not null default ''/i);
assert.match(accountTypeSql, /alter table public\.quotation_payment_methods[\s\S]*add column account_type text not null default ''/i);
assert.match(accountTypeSql, /account_type[\s\S]*in\s*\(\s*''\s*,\s*'savings'\s*,\s*'current'\s*,\s*'fixed'\s*\)/i);
assert.match(accountTypeSql, /p_method\s*->>\s*'account_type'/i);
assert.match(accountTypeSql, /insert into public\.quotation_company_payment_methods[\s\S]*account_type/i);
assert.match(accountTypeSql, /insert into public\.quotation_payment_methods[\s\S]*account_type/i);
assert.match(accountTypeSql, /'account_type'[\s\S]*p\.account_type/i);
```

Extend the environment-gated database integration test to save `account_type: "current"`, read the master, save a quotation, change the master to `fixed`, and assert the saved quotation row remains `current`.

- [ ] **Step 3: Run migration tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
```

Expected: FAIL because the generated migration is empty.

- [ ] **Step 4: Add columns and constraints**

Put these statements in the generated migration:

```sql
alter table public.quotation_company_payment_methods
  add column account_type text not null default '',
  add constraint quotation_company_payment_methods_account_type_check
    check (account_type in ('', 'savings', 'current', 'fixed'));

alter table public.quotation_payment_methods
  add column account_type text not null default '',
  add constraint quotation_payment_methods_account_type_check
    check (account_type in ('', 'savings', 'current', 'fixed'));
```

- [ ] **Step 5: Replace the four current RPC-boundary functions**

Copy the complete latest definitions—not abbreviated fragments—from:

- `private.validate_quotation_payment_method(jsonb)` in `20260718170000_quotation_payment_final_boundary.sql`
- `private.save_quotation_company_payment_methods(jsonb)` in the same file
- `private.save_quotation_with_payments(jsonb)` in the same file
- `private.get_public_quotation(uuid)` in `20260718140000_quotation_payment_security_boundary.sql`

Then make these exact additions in the new copies:

```sql
-- validator declaration
v_account_type text := btrim(coalesce(p_method ->> 'account_type', ''));

-- top-level validation condition, before type-specific branches
or v_account_type not in ('', 'savings', 'current', 'fixed')

-- master INSERT column/value
account_type
case when v_type = 'bank_transfer'
  then btrim(coalesce(v_method ->> 'account_type', ''))
  else ''
end

-- quotation snapshot INSERT column/value
account_type
case when v_type = 'bank_transfer'
  then btrim(coalesce(v_method ->> 'account_type', ''))
  else ''
end

-- public JSON object member
'account_type', case when p.type = 'bank_transfer' then p.account_type else '' end
```

Keep the existing `security definer`, fixed `search_path`, permission checks, asset checks, ownership checks, revokes, and grants byte-for-byte unless an added column requires changing an INSERT list.

- [ ] **Step 6: Run static and optional database checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
npx.cmd supabase migration list --local
```

If the local database test environment is already running, also run:

```powershell
$env:RUN_QUOTATION_DB_TESTS = "1"
node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts
Remove-Item Env:RUN_QUOTATION_DB_TESTS
```

Expected: static migration tests PASS; the integration suite either PASSes or is explicitly skipped because the local Supabase environment is unavailable.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- supabase/migrations tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "feat: persist quotation bank account types"
```

---

### Task 3: Repository And Quotation Snapshot Propagation

**Files:**
- Modify: `server/repositories/quotations.ts:62-355`
- Modify: `server/services/quotations.ts:35-175`
- Test: `tests/quotation-repository-actions.test.ts`
- Test: `tests/quotation-service.test.ts`
- Test: `tests/quotation-public-share.test.ts`

**Interfaces:**
- Consumes: `QuotationPaymentMethod.accountType` from Task 1.
- Produces: `account_type` in master and quotation RPC payloads.
- Produces: hydrated `accountType` from both authenticated and public quotation rows.

- [ ] **Step 1: Add failing propagation tests**

Require the repository/service source contracts and prepared payload to include:

```ts
assert.equal(prepared.rpcPayload.payment_methods[0].account_type, "savings");
assert.match(repositorySource, /account_type/);
assert.match(repositorySource, /accountType:\s*stringValue\(method\.account_type\)/);
assert.match(repositorySource, /account_type:\s*method\.accountType/);
```

The public-share test must assert that the repository's shared quotation select includes `account_type`; no second public mapping path should be introduced.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts tests/quotation-public-share.test.ts
```

Expected: FAIL on missing `account_type` propagation.

- [ ] **Step 3: Update repository reads and master saves**

In `server/repositories/quotations.ts`:

```ts
type DatabaseQuotationPaymentMethod = {
  account_type: unknown;
  // existing fields stay unchanged
};
```

Add `account_type` to `quotationSelect` and the company master `.select(...)`. Map both result shapes with:

```ts
accountType: stringValue(method.account_type) as PaymentAccountType,
```

Add this to the master RPC payload:

```ts
account_type: method.accountType,
```

- [ ] **Step 4: Update quotation save payloads**

In `server/services/quotations.ts`, extend the `rpcPayload.payment_methods` type with `account_type: string` and add:

```ts
account_type: method.accountType,
```

Do not derive this value from the bank catalogue or current master during edit; use the normalized method already in the quotation payload.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- server/repositories/quotations.ts server/services/quotations.ts tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts tests/quotation-public-share.test.ts
git commit -m "feat: snapshot quotation bank account types"
```

---

### Task 4: Bank Editor And Shared Document Rendering

**Files:**
- Modify: `components/admin/quotations/payment-method-list.tsx:39-80`
- Modify: `components/admin/quotations/quotation-document.tsx:340-365`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_ACCOUNT_TYPE_LABELS` and `QuotationPaymentMethod.accountType`.
- Produces: one bank-only select and one shared account-number display line.

- [ ] **Step 1: Add failing editor and document tests**

Add source and pure-behavior assertions equivalent to:

```ts
assert.match(paymentEditor, /label="ประเภทบัญชี"/);
assert.match(paymentEditor, /update\("accountType"/);
assert.match(paymentEditor, /<option value="">ไม่ระบุ<\/option>/);
assert.match(paymentEditor, /<option value="savings">ออมทรัพย์<\/option>/);
assert.match(paymentEditor, /<option value="current">กระแสรายวัน<\/option>/);
assert.match(paymentEditor, /<option value="fixed">ฝากประจำ<\/option>/);
assert.doesNotMatch(promptPayEditorScope, /ประเภทบัญชี/);
assert.match(documentSource, /PAYMENT_ACCOUNT_TYPE_LABELS\[method\.accountType\]/);
```

Also require the shared document to build the line from the optional Thai label and account number:

```ts
assert.match(documentSource, /accountTypeLabel[\s\S]*method\.accountNumber/);
assert.match(documentSource, /\[accountTypeLabel, method\.accountNumber\]\.filter\(Boolean\)\.join\(" "\)/);
```

- [ ] **Step 2: Run UI tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the select and shared document line do not exist.

- [ ] **Step 3: Add the bank-only select**

Within the existing `method.type === "bank_transfer"` grid in `payment-method-list.tsx`, add:

```tsx
<Field
  error={error("accountType")}
  field={`paymentMethods.${index}.accountType`}
  label="ประเภทบัญชี"
>
  <select
    className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
    onChange={(event) => update("accountType", event.target.value as T["accountType"])}
    value={method.accountType}
  >
    <option value="">ไม่ระบุ</option>
    <option value="savings">ออมทรัพย์</option>
    <option value="current">กระแสรายวัน</option>
    <option value="fixed">ฝากประจำ</option>
  </select>
</Field>
```

Change the desktop bank grid from four to five columns only at the existing large breakpoint; retain the current one/two-column responsive behavior below it.

- [ ] **Step 4: Format the shared account-number line without a new abstraction**

Inside the existing payment-entry component, derive one local value:

```ts
const accountTypeLabel = method.accountType
  ? PAYMENT_ACCOUNT_TYPE_LABELS[method.accountType]
  : "";
const accountNumberLine = [accountTypeLabel, method.accountNumber]
  .filter(Boolean)
  .join(" ");
```

Replace only the bank-transfer account-number expression:

```tsx
<p className="font-semibold tabular-nums">
  {accountNumberLine}
</p>
```

Because Preview, Public, and Print already use this document component, do not add separate rendering code.

- [ ] **Step 5: Run UI tests, typecheck, and lint**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm.cmd run typecheck
npm.cmd run lint -- --ignore-pattern .worktrees/**
```

Expected: PASS with no new lint warnings.

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- components/admin/quotations/payment-method-list.tsx components/admin/quotations/quotation-document.tsx tests/quotation-ui.test.ts
git commit -m "feat: show bank account types on quotations"
```

---

### Task 5: Documentation And Final Verification

**Files:**
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Documents: optional values, master-to-snapshot behavior, and Preview/Public/Print output.

- [ ] **Step 1: Update the quotation documentation**

Add a short bank-account-type subsection stating:

```markdown
Bank transfers may optionally select ไม่ระบุ, ออมทรัพย์, กระแสรายวัน, or ฝากประจำ. The master value is copied into the quotation snapshot. Preview, Public, and Print show the selected Thai type before the account number on the same line; an unspecified type adds no placeholder.
```

- [ ] **Step 2: Run the complete verification suite**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint -- --ignore-pattern .worktrees/**
npm.cmd run test
npm.cmd run build
git diff --check
```

Expected: typecheck, lint, all non-environment-gated tests, build, and whitespace validation PASS. Record any environment-gated database test as skipped unless it was explicitly run in Task 2.

- [ ] **Step 3: Verify the rendered flow**

At `390`, `768`, `1280`, and `1536` CSS px:

- open the master payment settings and confirm the new select appears only on a bank transfer;
- save `ออมทรัพย์`, create a quotation from that default master, and confirm its snapshot displays `ออมทรัพย์ {เลขที่บัญชี}`;
- change the master to `ฝากประจำ` and confirm the already-saved quotation still displays `ออมทรัพย์`;
- set the quotation snapshot to `ไม่ระบุ` and confirm Preview/Print show only the account number;
- change a bank method to PromptPay and confirm the account type disappears and saves as empty;
- confirm there is no document-level horizontal overflow.

- [ ] **Step 4: Commit Task 5**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: document quotation bank account types"
```

---

## Final Review Gate

Review `git diff 7a1ac23..HEAD` against `docs/superpowers/specs/2026-07-18-quotation-bank-account-type-design.md`. Do not merge until Critical and Important findings are fixed and the verification suite is rerun after the last fix.
