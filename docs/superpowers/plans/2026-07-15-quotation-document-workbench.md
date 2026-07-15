# Quotation Document Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved full-width quotation workbench with compact metadata, sortable line items, two discount levels, per-item VAT, withholding tax, `บาท` copy, and saved-only Public Read-only sharing.

**Architecture:** Keep one `QuotationPayload` and one decimal-safe calculator as the source of truth for Editor, Preview/Print, persistence, and Public Read-only. Extend the existing transactional Supabase RPC for withholding totals and expose public data only through a token-scoped private security-definer function plus an explicitly granted public invoker wrapper; do not grant anonymous table access. Recompose the existing editor with the installed dnd-kit packages and one responsive sortable item tree so desktop and mobile never mount duplicate controls.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, existing shadcn primitives, `@dnd-kit/react`, `@dnd-kit/helpers`, Supabase PostgreSQL/RLS/RPC, Node test runner.

## Global Constraints

- Create/Edit is full-width responsive; only Preview/Print and the shared public preview use the A4 document renderer.
- Customer snapshots contain only name, address, tax ID, office type, and conditional branch number.
- Remove customer contact name, phone, email, shipping address, and service location from UI, types, validation, stored snapshot JSON, Preview/Print, and Public Read-only.
- Keep seller profile and seller snapshot behavior unchanged.
- Keep internal ISO currency `THB`, but every user-facing label and monetary suffix must use `บาท`; never display `THB`, `THB — บาท`, or the `฿` symbol.
- Do not expose a currency or inclusive/exclusive price-mode control. New quotations remain `vat_exclusive`; legacy stored mode values remain readable internally.
- Keep per-item discounts and VAT. Document discount supports `%` and `บาท` and is enabled by a checkbox.
- Withholding tax is an optional percentage applied to the total after all discounts and before VAT.
- The line-item `รวม` value is after item discount, before document discount, and before VAT.
- Public Share is enabled only after the first successful save and always reads the latest saved database values.
- Use an unguessable UUID public token. Soft-deleted quotations must return no public data.
- Keep internal notes out of Preview/Print and Public Read-only.
- Reuse existing React, Tailwind, shadcn, money utilities, and installed dnd-kit packages; add no dependency and no global theme change.
- Create a new migration with the Supabase CLI. Do not edit existing migrations, reset the database, or grant `anon`/`authenticated` direct `SELECT` on quotation tables.
- Put every security-definer function in the private schema with a fixed `search_path`; the exposed public wrapper remains security invoker.
- Add explicit function grants because Supabase no longer guarantees automatic Data API exposure for newly created functions.
- Preserve the user's unrelated changes in `docs/superpowers/specs/2026-07-14-quotation-management-design.md` and `supabase/snippets/Untitled query 577.sql`.

---

## File Map

### Domain and validation

- Modify `lib/quotation-types.ts`: reduce `CustomerSnapshot`; add nullable withholding rate.
- Modify `lib/quotation-calculator.ts`: expose pre-VAT item/net totals, withholding total, and amount due.
- Modify `server/services/quotations.ts`: normalize the reduced snapshot, subject, disabled discounts, and withholding rate; prepare trusted RPC totals.

### Persistence and public access

- Create with `supabase migration new`: the CLI-generated migration whose suffix is `_quotation_workbench_totals_public_share.sql`.
- Modify `server/repositories/quotations.ts`: load/save public tokens and withholding rate; fetch token-scoped public payloads.
- Modify `app/admin/quotations/actions.ts`: return the saved public token and revalidate the public route.

### Editor and documents

- Modify `components/admin/quotations/quotation-editor.tsx`: compact metadata, one sortable responsive item list, inline totals, action placement, and share-copy behavior.
- Modify `components/admin/quotations/quotation-document.tsx`: reduced customer data, subject, approved totals, pre-VAT line totals, and `บาท` labels.
- Modify `components/admin/quotations/quotation-list.tsx`: replace currency-symbol formatting with number plus `บาท`.
- Modify `app/admin/quotations/new/page.tsx`: pass a null public token.
- Modify `app/admin/quotations/[id]/page.tsx`: pass the stored public token.
- Create `app/q/[token]/page.tsx`: no-login Public Read-only page using the shared document renderer.

### Tests and documentation

- Modify `tests/quotation-calculator.test.ts`.
- Modify `tests/quotation-service.test.ts`.
- Modify `tests/quotation-repository-actions.test.ts`.
- Modify `tests/quotation-migration.test.ts`.
- Modify `tests/quotation-database-integration.test.ts`.
- Modify `tests/quotation-ui.test.ts`.
- Create `tests/quotation-public-share.test.ts`.
- Modify `docs/quotation-management.md`, `README.md`, and `docs/architecture.md`.

---

### Task 1: Reduce the payload and extend the trusted calculator

**Files:**

- Modify: `lib/quotation-types.ts:1-49`
- Modify: `lib/quotation-calculator.ts:1-174`
- Modify: `server/services/quotations.ts:10-157`
- Modify: `server/repositories/quotations.ts:154-202`
- Modify: `components/admin/quotations/quotation-editor.tsx:24-35,147`
- Modify: `components/admin/quotations/quotation-document.tsx:4-16`
- Test: `tests/quotation-calculator.test.ts`
- Test: `tests/quotation-service.test.ts`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**

- Consumes: existing `DiscountType`, `PriceMode`, `VatTreatment`, `formatThaiBahtText()`, `CustomerSnapshot`, and quotation validation helpers.
- Produces: `QuotationPayload.withholdingTaxRate: string | null`, `QuotationLineCalculation.netAmount`, and `QuotationCalculation.netSubtotal`, `withholdingTaxTotal`, and `amountDue` for all later tasks.

- [ ] **Step 1: Write failing calculator tests for the approved totals**

Add `withholdingTaxRate: null` to `baseInput()` and add this test:

```ts
it("keeps line totals before VAT and calculates withholding after discounts", () => {
  const result = calculateQuotation(baseInput({
    documentDiscountType: "percent",
    documentDiscountValue: "10",
    items: [{
      ...baseInput().items[0],
      discountType: "percent",
      discountValue: "10",
    }],
    withholdingTaxRate: "3.00",
  }));

  assert.equal(result.lines[0]!.netAmount, "18000.00");
  assert.equal(result.netSubtotal, "18000.00");
  assert.equal(result.documentDiscountTotal, "1800.00");
  assert.equal(result.taxableTotal, "16200.00");
  assert.equal(result.vatTotal, "1134.00");
  assert.equal(result.grandTotal, "17334.00");
  assert.equal(result.withholdingTaxTotal, "486.00");
  assert.equal(result.amountDue, "16848.00");
});

it("ignores withholding when its rate is null", () => {
  const result = calculateQuotation(baseInput({ withholdingTaxRate: null }));
  assert.equal(result.withholdingTaxTotal, "0.00");
  assert.equal(result.amountDue, result.grandTotal);
});
```

- [ ] **Step 2: Write failing service tests for the reduced customer and restored subject**

Change `validPayload()` to use the final customer shape and add
`withholdingTaxRate: null`. Replace the legacy-subject test with:

```ts
it("keeps only quotation customer fields and persists the subject", () => {
  const input = {
    ...validPayload(),
    customer: {
      ...validPayload().customer,
      contactName: "remove",
      email: "remove@example.test",
      phone: "remove",
      serviceLocation: "remove",
      shippingAddress: "remove",
    },
    subject: "งานบ้านพัก 3 คืน",
  };

  const prepared = prepareQuotationPayload(input);
  assert.deepEqual(prepared.payload.customer, {
    address: "Customer address",
    branchNumber: "",
    name: "Customer",
    officeType: "head_office",
    taxId: "",
  });
  assert.equal(prepared.payload.subject, "งานบ้านพัก 3 คืน");
  assert.equal(prepared.rpcPayload.subject, "งานบ้านพัก 3 คืน");
});

it("validates an enabled withholding percentage", () => {
  assert.throws(
    () => prepareQuotationPayload({ ...validPayload(), withholdingTaxRate: "100.01" }),
    (error) => error instanceof QuotationValidationError
      && Boolean(error.fieldErrors.withholdingTaxRate),
  );
});
```

Remove the customer-email assertion from the invalid-date test; seller email
validation remains covered by seller tests.

- [ ] **Step 3: Run the focused tests and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-service.test.ts
```

Expected: FAIL because the new calculation fields are undefined, customer
contact keys remain, and subject is still forced empty.

- [ ] **Step 4: Replace the customer and payload interfaces**

Use these exact public shapes in `lib/quotation-types.ts`:

```ts
export interface CustomerSnapshot {
  address: string;
  branchNumber: string;
  name: string;
  officeType: OfficeType;
  taxId: string;
}

export interface QuotationPayload {
  currency: "THB";
  customer: CustomerSnapshot;
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  id: string | null;
  internalNotes: string;
  issueDate: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
  publicNotes: string;
  reference: string;
  seller: SellerSnapshot;
  subject: string;
  validUntil: string;
  validityDays: string;
  withholdingTaxRate: string | null;
}
```

Remove `sku` from `QuotationItemInput`; persistence may continue writing an
empty legacy SKU value without exposing it as application input.

- [ ] **Step 5: Extend the calculator with the final interfaces and formulas**

Use these exact additions:

```ts
export interface QuotationCalculationInput {
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
  withholdingTaxRate: string | null;
}

export interface QuotationLineCalculation extends QuotationItemInput {
  discountAmount: string;
  documentDiscountAllocation: string;
  grossAmount: string;
  lineTotal: string;
  netAmount: string;
  taxableAmount: string;
  vatAmount: string;
}

export interface QuotationCalculation {
  amountDue: string;
  documentDiscountTotal: string;
  grandTotal: string;
  itemDiscountTotal: string;
  lines: QuotationLineCalculation[];
  netSubtotal: string;
  subtotal: string;
  taxableTotal: string;
  vatSummary: VatSummaryLine[];
  vatTotal: string;
  withholdingTaxTotal: string;
}
```

Inside `calculateQuotation()`:

1. Parse `withholdingTaxRate` only when non-null and reject values over
   `PERCENT_DENOMINATOR`.
2. Store each item's `afterItemDiscount` as `netAmount` for VAT-exclusive rows.
   For a legacy VAT-inclusive taxable row, back VAT out of this pre-document-
   discount value with the existing `roundDiv()` helper.
3. Keep the current proportional document-discount allocation and VAT logic.
4. Add `netAmount` to the calculation-line result.
5. Extend the local `sum()` field union with `netAmount`.
6. Compute the final values exactly as follows:

```ts
const grandTotal = sum("lineTotal");
const taxableTotal = sum("taxableAmount");
const withholdingTax = roundDiv(
  taxableTotal * withholdingRate,
  PERCENT_DENOMINATOR,
);

return {
  amountDue: formatScaled(grandTotal - withholdingTax, MONEY_SCALE),
  documentDiscountTotal: formatScaled(documentDiscount, MONEY_SCALE),
  grandTotal: formatScaled(grandTotal, MONEY_SCALE),
  itemDiscountTotal: formatScaled(sum("discountAmount"), MONEY_SCALE),
  lines,
  netSubtotal: formatScaled(sum("netAmount"), MONEY_SCALE),
  subtotal: formatScaled(sum("grossAmount"), MONEY_SCALE),
  taxableTotal: formatScaled(taxableTotal, MONEY_SCALE),
  vatSummary: [...vatGroups.values()].map((row) => ({
    taxableAmount: formatScaled(row.taxableAmount, MONEY_SCALE),
    vatAmount: formatScaled(row.vatAmount, MONEY_SCALE),
    vatRate: row.vatRate,
    vatTreatment: row.vatTreatment,
  })),
  vatTotal: formatScaled(sum("vatAmount"), MONEY_SCALE),
  withholdingTaxTotal: formatScaled(withholdingTax, MONEY_SCALE),
};
```

- [ ] **Step 6: Normalize only the approved customer, subject, discounts, and withholding in the service**

Make these exact behavioral changes in `server/services/quotations.ts`:

```ts
const customer: CustomerSnapshot = {
  address: bounded(stringValue(customerSource, "address"), 2_000, "customer.address", errors),
  branchNumber: branchNumber(customerSource, customerOffice, "customer.branchNumber", errors),
  name: bounded(stringValue(customerSource, "name"), 200, "customer.name", errors),
  officeType: customerOffice,
  taxId: bounded(stringValue(customerSource, "taxId"), 200, "customer.taxId", errors),
};

const withholdingTaxRate = source.withholdingTaxRate == null
  ? null
  : numeric(
      stringValue(source, "withholdingTaxRate"),
      PERCENT,
      "withholdingTaxRate",
      errors,
      true,
    );
```

- Delete `source.subject = ""` and preserve `bounded(stringValue(source,
  "subject"), 200, "subject", errors)` in the final payload.
- When document discount type is null, normalize its value to `"0"`; otherwise
  validate the selected `%` or money value.
- When an item discount type is null, normalize its value to `"0"`.
- Add `withholdingTaxRate` to `QuotationPayload` and `withholding_tax_rate` to
  the RPC payload.
- Add `withholdingTaxTotal` and `amountDue` to RPC totals.
- Keep RPC `sku` as the constant empty string for the legacy non-null column.
- Generate amount-in-words from `calculation.amountDue`.
- Add `withholdingTaxRate: null` to `emptyQuotationPayload()` and reduce its
  empty customer object to the final shape.

Update the repository customer mapper to return only the reduced shape and,
until Task 2 wires the database column, return `withholdingTaxRate: null` from
`quotationRowToPayload()`.

Remove the three customer-contact controls from the editor and document now so
the reduced type compiles. Remove their source-test assertions and assert they
are absent from both files.

- [ ] **Step 7: Run focused tests and typecheck**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-service.test.ts tests/quotation-ui.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```powershell
git add -- lib/quotation-types.ts lib/quotation-calculator.ts server/services/quotations.ts server/repositories/quotations.ts components/admin/quotations/quotation-editor.tsx components/admin/quotations/quotation-document.tsx tests/quotation-calculator.test.ts tests/quotation-service.test.ts tests/quotation-ui.test.ts
git commit -m "feat: extend quotation totals and customer snapshot"
```

---

### Task 2: Add the migration, persistence, and token-scoped public RPC

**Files:**

- Create: CLI-generated `supabase/migrations/*_quotation_workbench_totals_public_share.sql`
- Modify: `server/repositories/quotations.ts:40-305`
- Modify: `app/admin/quotations/actions.ts:18-75`
- Test: `tests/quotation-migration.test.ts`
- Test: `tests/quotation-database-integration.test.ts`
- Test: `tests/quotation-repository-actions.test.ts`

**Interfaces:**

- Consumes: Task 1 `PreparedQuotation.rpcPayload`, reduced `CustomerSnapshot`, and calculated withholding totals.
- Produces: `SavedQuotation.publicToken`, `getPublicQuotationByToken(supabase, token)`, stored `public_token`, `withholding_tax_rate`, `withholding_tax_total`, and `amount_due` for Tasks 4-5.

- [ ] **Step 1: Write failing migration and repository tests**

In `tests/quotation-migration.test.ts`, locate the migration by the exact suffix
`_quotation_workbench_totals_public_share.sql` and assert:

```ts
assert.match(workbenchSql, /public_token uuid not null default gen_random_uuid\(\)/i);
assert.match(workbenchSql, /withholding_tax_rate numeric\(5,2\)/i);
assert.match(workbenchSql, /withholding_tax_total numeric\(14,2\)/i);
assert.match(workbenchSql, /amount_due numeric\(14,2\)/i);
assert.match(workbenchSql, /customer_snapshot\s*=\s*customer_snapshot\s*-\s*array\[/i);
assert.match(workbenchSql, /private\.get_public_quotation/i);
assert.match(workbenchSql, /public\.get_public_quotation/i);
assert.match(workbenchSql, /grant execute on function public\.get_public_quotation\(uuid\) to anon, authenticated/i);
assert.doesNotMatch(workbenchSql, /grant select on (?:public\.)?(?:quotations|quotation_items) to anon/i);
const publicReadSql = workbenchSql.slice(
  workbenchSql.indexOf("create or replace function private.get_public_quotation"),
  workbenchSql.indexOf("create or replace function public.get_public_quotation"),
);
assert.doesNotMatch(publicReadSql, /internal_notes/i);
```

In `tests/quotation-repository-actions.test.ts`, add:

```ts
it("loads public quotations only through the token RPC", () => {
  assert.match(repository, /\.rpc\("get_public_quotation"/);
  assert.match(repository, /publicToken/);
  assert.match(repository, /public_token/);
  assert.doesNotMatch(repository, /serviceRole/i);
});
```

- [ ] **Step 2: Run the tests and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-repository-actions.test.ts
```

Expected: FAIL because the migration and public repository function do not
exist.

- [ ] **Step 3: Create the migration with the installed Supabase CLI**

Use the repo-local CLI and the existing Windows profile workaround:

```powershell
$env:USERPROFILE="C:\tmp"
$SUPABASE=".\node_modules\.bin\supabase.cmd"
& $SUPABASE migration new quotation_workbench_totals_public_share
```

Expected: the CLI prints one new migration path ending in
`_quotation_workbench_totals_public_share.sql`. Edit that returned file; do not
invent or rename its timestamp.

- [ ] **Step 4: Add the financial columns and sanitize existing JSON**

Start the generated migration with:

```sql
alter table public.quotations
  add column public_token uuid not null default gen_random_uuid(),
  add column withholding_tax_rate numeric(5,2)
    check (withholding_tax_rate is null or withholding_tax_rate between 0 and 100),
  add column withholding_tax_total numeric(14,2) not null default 0
    check (withholding_tax_total >= 0),
  add column amount_due numeric(14,2) not null default 0
    check (amount_due >= 0),
  add constraint quotations_public_token_key unique (public_token);

update public.quotations
set amount_due = grand_total,
    customer_snapshot = customer_snapshot - array[
      'contactName', 'contact_name', 'phone', 'email',
      'shippingAddress', 'shipping_address',
      'serviceLocation', 'service_location'
    ]::text[];
```

- [ ] **Step 5: Replace the private save function with the same transaction plus the new fields**

Use `create or replace function private.save_quotation(p_payload jsonb)` with
the existing signature and authorization/numbering/item loop. Make these exact
insert/update additions; do not change the public wrapper signature:

```sql
-- Add to both the INSERT column/value lists:
withholding_tax_rate,
withholding_tax_total,
amount_due

nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
(p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
(p_payload #>> '{totals,amountDue}')::numeric

-- Add to the UPDATE SET list:
withholding_tax_rate = nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
withholding_tax_total = (p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
amount_due = (p_payload #>> '{totals,amountDue}')::numeric
```

Keep `document_number`, `public_token`, creation metadata, and the return table
unchanged during updates.

- [ ] **Step 6: Add the private public-read function and invoker wrapper**

Append this token-scoped shape. The selected JSON must not contain
`internal_notes`, deleted rows, customer contact keys, or the token itself:

```sql
create or replace function private.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', q.id,
    'document_number', q.document_number,
    'issue_date', q.issue_date,
    'valid_until', q.valid_until,
    'validity_days', q.validity_days,
    'reference', q.reference,
    'subject', q.subject,
    'currency', q.currency,
    'price_mode', q.price_mode,
    'seller_snapshot', q.seller_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', q.customer_snapshot ->> 'customer_name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', q.customer_snapshot ->> 'tax_id', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', q.customer_snapshot ->> 'office_type', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', q.customer_snapshot ->> 'branch_number', '')
    ),
    'document_discount_type', q.document_discount_type,
    'document_discount_value', q.document_discount_value,
    'withholding_tax_rate', q.withholding_tax_rate,
    'public_notes', q.public_notes,
    'quotation_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'position', i.position,
        'name', i.name,
        'description', i.description,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'discount_type', i.discount_type,
        'discount_value', i.discount_value,
        'vat_treatment', i.vat_treatment,
        'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i
      where i.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null;
$$;

create or replace function public.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select private.get_public_quotation(p_token);
$$;

revoke all on function private.get_public_quotation(uuid) from public;
revoke all on function public.get_public_quotation(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.get_public_quotation(uuid) to anon, authenticated;
grant execute on function public.get_public_quotation(uuid) to anon, authenticated;
```

- [ ] **Step 7: Wire repository reads and save-token lookup**

Make these interface and repository changes:

```ts
export interface SavedQuotation {
  documentNumber: string;
  id: string;
  publicToken: string;
}
```

- Include `public_token` and `withholding_tax_rate` in `quotationSelect` and
  `DatabaseQuotationRow`.
- Map `withholdingTaxRate` to null or its string value.
- Return `{ documentNumber, payload, publicToken }` from `getQuotationById()`.
- After `save_quotation` succeeds, select `public_token` from the saved active
  quotation by id. Throw `Quotation save returned no public token` if missing.
- Return that token from `saveQuotation()` without changing the transactional
  RPC's return signature.
- Add this public repository entry point:

```ts
export async function getPublicQuotationByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ documentNumber: string; payload: QuotationPayload } | null> {
  const { data, error } = await supabase.rpc("get_public_quotation", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as DatabaseQuotationRow & { document_number: unknown };
  return {
    documentNumber: stringValue(row.document_number),
    payload: quotationRowToPayload({ ...row, internal_notes: "" }),
  };
}
```

Extend the successful `QuotationActionResult` with `publicToken`; the existing
`{ ...saved, ok: true }` return then carries it automatically. Revalidate
`/q/${encodeURIComponent(saved.publicToken)}` after save.

- [ ] **Step 8: Extend the local integration test**

Add `withholding_tax_rate: "3.00"`, `withholdingTaxTotal: "3.00"`, and
`amountDue: "104.00"` to the raw 100+7 fixture. Add an unauthenticated client
using the anon key and verify:

```ts
it("persists withholding and exposes only saved public data", async () => {
  const created = await save(allowed, payload(null));
  const stored = await allowed
    .from("quotations")
    .select("public_token,withholding_tax_rate,withholding_tax_total,amount_due")
    .eq("id", created.id)
    .single();
  assert.equal(stored.error, null, stored.error?.message);
  assert.equal(stored.data.withholding_tax_rate, 3);
  assert.equal(stored.data.withholding_tax_total, 3);
  assert.equal(stored.data.amount_due, 104);

  const publicRead = await anonymous.rpc("get_public_quotation", {
    p_token: stored.data.public_token,
  });
  assert.equal(publicRead.error, null, publicRead.error?.message);
  assert.equal(publicRead.data.document_number, created.document_number);
  assert.equal("internal_notes" in publicRead.data, false);
  assert.deepEqual(Object.keys(publicRead.data.customer_snapshot).sort(), [
    "address", "branchNumber", "name", "officeType", "taxId",
  ]);

  const updated = payload(created.id);
  updated.reference = "LATEST-SAVED";
  await save(allowed, updated);
  const latest = await anonymous.rpc("get_public_quotation", {
    p_token: stored.data.public_token,
  });
  assert.equal(latest.data.reference, "LATEST-SAVED");

  await allowed.rpc("soft_delete_quotation", { p_id: created.id });
  const deleted = await anonymous.rpc("get_public_quotation", {
    p_token: stored.data.public_token,
  });
  assert.equal(deleted.data, null);
});
```

- [ ] **Step 9: Apply locally and run database checks**

```powershell
$env:USERPROFILE="C:\tmp"
$SUPABASE=".\node_modules\.bin\supabase.cmd"
& $SUPABASE migration up --local
& $SUPABASE migration list --local
& $SUPABASE db lint --local --fail-on error
```

Then run the integration test with the existing local environment procedure in
`README.md`; never print credentials and do not run `db reset`:

```powershell
$env:RUN_LOCAL_SUPABASE_TESTS='1'
node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts
Remove-Item Env:RUN_LOCAL_SUPABASE_TESTS
```

Expected: migration applied, database lint exits 0, and the public-read test
passes for anon while direct anon quotation-table reads remain unavailable.

- [ ] **Step 10: Run focused tests, typecheck, and commit Task 2**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-repository-actions.test.ts tests/quotation-database-integration.test.ts
npm run typecheck
git add -- supabase/migrations server/repositories/quotations.ts app/admin/quotations/actions.ts tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts tests/quotation-repository-actions.test.ts
git commit -m "feat: persist quotation withholding and public tokens"
```

Expected: PASS. Stage only the newly generated migration under
`supabase/migrations`; do not stage `supabase/snippets/Untitled query 577.sql`.

---

### Task 3: Build the compact metadata and one sortable responsive item ledger

**Files:**

- Modify: `components/admin/quotations/quotation-editor.tsx:1-209`
- Test: `tests/quotation-ui.test.ts:60-245`

**Interfaces:**

- Consumes: `QuotationPayload`, `QuotationLineCalculation.netAmount`, existing `positions()`, installed `DragDropProvider`, `move()`, and `useSortable()`.
- Produces: one mounted control tree per item, keyboard-operable `handleRef`, saved `position` ordering, compact metadata roles, and bottom-left Add Item placement.

- [ ] **Step 1: Replace obsolete UI assertions with failing final-layout assertions**

Assert all of the following in `tests/quotation-ui.test.ts`:

```ts
assert.doesNotMatch(editor, /customer\.contactName|customer\.phone|customer\.email/);
assert.doesNotMatch(editor, /field="currency"|data-field="currency"|THB — บาท/);
assert.doesNotMatch(editor, /field="priceMode"|data-field="priceMode"/);
assert.match(editor, /field="subject"[\s\S]*label="เรื่อง \/ ชื่องาน"/);
assert.match(editor, /DragDropProvider/);
assert.match(editor, /useSortable/);
assert.match(editor, /handleRef/);
assert.match(editor, /move\(current\.items, event\)/);
assert.match(editor, /aria-label=\{`ลากเพื่อจัดลำดับรายการ/);
assert.doesNotMatch(editor, /ItemActionMenu|ArrowUp|ArrowDown|เลื่อนขึ้น|เลื่อนลง/);
assert.match(editor, /data-sortable-item/);
assert.equal(editor.match(/data-item-details/g)?.length, 1);
assert.ok(editor.indexOf("data-sortable-items") < editor.indexOf("เพิ่มรายการ"));
assert.match(editor, /calculation\?\.lines\[index\]\?\.netAmount/);
```

Update field-size assertions to require only `compact`, `date`, `identifier`,
`money`, `name`, `address`, with maxima `max-w-28`, `max-w-40`, `max-w-56`,
`max-w-32`, `max-w-96`, and `max-w-[36rem]`.

- [ ] **Step 2: Run the UI test and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL on the currency/price-mode/customer controls, old overflow menu,
duplicate desktop/mobile item trees, and missing drag provider.

- [ ] **Step 3: Add compact field roles and final metadata controls**

Use:

```ts
type FieldSize = "fluid" | "compact" | "date" | "identifier" | "money" | "name" | "address";

const fieldSizeClassNames = {
  fluid: "w-full",
  compact: "w-full sm:max-w-28",
  date: "w-full sm:max-w-40",
  identifier: "w-full sm:max-w-56",
  money: "w-full sm:max-w-32",
  name: "w-full sm:max-w-96",
  address: "w-full sm:max-w-[36rem]",
} satisfies Record<FieldSize, string>;
```

- Keep customer name, address, tax ID, office type, and conditional branch
  number only.
- Replace the document-section `THB` badge with `บาท`.
- Remove the currency field and price-mode selector completely.
- Add optional `subject` labelled `เรื่อง / ชื่องาน` in document metadata.
- Keep reference in document metadata.
- Keep the current branch-number clearing callbacks.

- [ ] **Step 4: Replace the table/card duplication with one sortable item component**

Import:

```ts
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Download, Eye, GripVertical, MoreHorizontal, Printer, Share2, Trash2 } from "lucide-react";
```

Remove `onMove` from `ItemProps`, remove `moveItem()` and `ItemActionMenu`, and
add a single component with one sortable registration:

```tsx
function SortableQuotationItem(props: ItemProps) {
  const { index, item, onRemove } = props;
  const { handleRef, isDragging, ref } = useSortable({
    group: "quotation-items",
    id: item.id,
    index,
  });

  return <article
    className={cn(
      "rounded-md border p-3 xl:grid xl:grid-cols-[2.5rem_minmax(16rem,1fr)_5rem_5rem_7.5rem_9rem_9rem_8.5rem_2.5rem] xl:items-start xl:gap-2 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-0 xl:py-2",
      isDragging && "opacity-60",
    )}
    data-sortable-item
    ref={ref}
  >
    <header className="mb-3 flex items-center justify-between xl:contents">
      <div className="flex items-center gap-1 xl:col-start-1 xl:row-start-1">
        <Button
          aria-label={`ลากเพื่อจัดลำดับรายการ ${index + 1}`}
          ref={handleRef}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <GripVertical aria-hidden="true" />
        </Button>
        <span className="font-mono text-xs text-muted-foreground xl:sr-only">{index + 1}</span>
      </div>
      <Button
        aria-label={`ลบรายการ ${index + 1}`}
        className="xl:col-start-9 xl:row-start-1"
        disabled={props.totalItems === 1}
        onClick={onRemove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </header>
    <div className="xl:col-start-2 xl:row-start-1"><ItemDetailsControls {...props} /></div>
    <div data-item-detail-grid className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:contents">
      <div className="xl:col-start-3 xl:row-start-1"><ItemQuantityControl {...props} labelled /></div>
      <div className="xl:col-start-4 xl:row-start-1"><ItemUnitControl {...props} labelled /></div>
      <div className="xl:col-start-5 xl:row-start-1"><ItemPriceControls {...props} labelled /></div>
      <div className="xl:col-start-6 xl:row-start-1"><ItemDiscountControls {...props} labelled /></div>
      <div className="xl:col-start-7 xl:row-start-1"><ItemVatControls {...props} labelled /></div>
    </div>
    <p className="mt-3 border-t pt-2 text-right font-medium xl:col-start-8 xl:row-start-1 xl:mt-0 xl:border-0 xl:pt-2">
      <span className="xl:sr-only">รวม </span>{props.calculation?.lines[index]?.netAmount ?? "—"}
    </p>
  </article>;
}
```

Keep desktop column labels in a matching `hidden xl:grid` header. Do not render
a second responsive copy of the controls.

- [ ] **Step 5: Wire drag completion and move Add Item to the lower-left**

Wrap the item map:

```tsx
<DragDropProvider
  onDragEnd={(event) => {
    if (event.canceled) return;
    changed("items");
    setPayload((current) => ({
      ...current,
      items: positions(move(current.items, event) as QuotationItemInput[]),
    }));
  }}
>
  <div className="grid gap-3 xl:gap-0" data-sortable-items>
    {payload.items.map((item, index) => (
      <SortableQuotationItem key={item.id} {...itemProps(item, index)} />
    ))}
  </div>
</DragDropProvider>
<Button className="text-blue-700" onClick={addItem} size="sm" type="button" variant="outline">
  เพิ่มรายการ
</Button>
```

Keep `positions()` after drag, add, and delete so save persists the visible
order. Add Item must appear after the sortable list inside `03 รายการ`.

- [ ] **Step 6: Run UI tests and typecheck**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add sortable quotation item workbench"
```

---

### Task 4: Implement the approved totals and document output

**Files:**

- Modify: `components/admin/quotations/quotation-editor.tsx:43-46,210-229`
- Modify: `components/admin/quotations/quotation-document.tsx:1-18`
- Modify: `components/admin/quotations/quotation-list.tsx:12-67`
- Test: `tests/quotation-ui.test.ts`
- Test: `tests/quotation-calculator.test.ts`

**Interfaces:**

- Consumes: Task 1 `netSubtotal`, `taxableTotal`, `grandTotal`, `withholdingTaxTotal`, `amountDue`, `netAmount`, and `formatThaiBahtText()`.
- Produces: exact inline total rows shared conceptually by Editor and read-only documents, checkbox-controlled document discount/withholding inputs, and user-facing `บาท` copy.

- [ ] **Step 1: Write failing final-total and document assertions**

Add assertions for the exact order and absence of legacy copy:

```ts
for (const label of [
  "รวมเป็นเงิน",
  "ส่วนลด",
  "ราคาหลังหักส่วนลด",
  "VAT",
  "จำนวนเงินรวมทั้งสิ้น",
  "หักภาษี ณ ที่จ่าย",
  "ยอดชำระ",
]) assert.match(editor, new RegExp(label));

assert.match(editor, /type="checkbox"[\s\S]*documentDiscountType/);
assert.match(editor, /disabled=\{payload\.documentDiscountType === null\}/);
assert.match(editor, /type="checkbox"[\s\S]*withholdingTaxRate/);
assert.match(editor, /disabled=\{payload\.withholdingTaxRate === null\}/);
assert.doesNotMatch(editor, /รวมก่อนส่วนลด|ส่วนลดรายการ|ส่วนลดเอกสาร|ยอดรวมสุทธิ \(THB\)/);
assert.match(document, /item\.netAmount/);
assert.doesNotMatch(document, /customer\.(?:contactName|phone|email)/);
assert.match(document, /เรื่อง \/ ชื่องาน/);
assert.doesNotMatch(editor + document + list, /THB — บาท|ยอดรวมสุทธิ \(THB\)|style:\s*"currency"/);
assert.match(list, /บาท/);
```

- [ ] **Step 2: Run UI tests and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL on legacy totals, missing checkboxes, line total including VAT,
and `THB`/currency-symbol copy.

- [ ] **Step 3: Allow disabled numeric controls and add toggle handlers**

Add `disabled?: boolean` to `TextInput` and `Numeric` and pass it to `Input`.
Add these handlers:

```ts
function setDocumentDiscountEnabled(enabled: boolean) {
  changed("documentDiscountType");
  setPayload((current) => ({
    ...current,
    documentDiscountType: enabled ? (current.documentDiscountType ?? "percent") : null,
    documentDiscountValue: enabled ? current.documentDiscountValue : "0",
  }));
}

function setWithholdingEnabled(enabled: boolean) {
  changed("withholdingTaxRate");
  setPayload((current) => ({
    ...current,
    withholdingTaxRate: enabled ? (current.withholdingTaxRate ?? "3.00") : null,
  }));
}
```

The `3.00` default matches the approved reference when withholding is first
enabled; it remains a free percentage input and can be changed to any validated
value from 0 through 100.

- [ ] **Step 4: Replace the editor totals with the approved compact rows**

Use a native checkbox; no new checkbox dependency is needed. Render this exact
helper and row sequence:

```tsx
const money = (value?: string) => value ? `${value} บาท` : "—";

<section data-quotation-totals className="space-y-2 border-t-2 border-foreground pt-3">
  <Totals label="รวมเป็นเงิน" value={money(calculation?.netSubtotal)} />
  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-sm">
        <input
          checked={payload.documentDiscountType !== null}
          className="size-4 accent-primary"
          onChange={(event) => setDocumentDiscountEnabled(event.target.checked)}
          type="checkbox"
        />
        ส่วนลด
      </label>
      <select
        aria-label="ประเภทส่วนลด"
        className={controlClassName("compact", selectClassName)}
        disabled={payload.documentDiscountType === null}
        onChange={(event) => updateRoot("documentDiscountType", event.target.value as "amount" | "percent")}
        value={payload.documentDiscountType ?? "percent"}
      >
        <option value="percent">%</option>
        <option value="amount">บาท</option>
      </select>
      <Numeric
        disabled={payload.documentDiscountType === null}
        error={fieldErrors.documentDiscountValue}
        field="documentDiscountValue"
        onChange={(value) => updateRoot("documentDiscountValue", value)}
        size="compact"
        value={payload.documentDiscountValue}
      />
    </div>
    <output>{money(calculation?.documentDiscountTotal)}</output>
  </div>
  <Totals label="ราคาหลังหักส่วนลด" value={money(calculation?.taxableTotal)} />
  <Totals label="VAT" value={money(calculation?.vatTotal)} />
  <Totals bold label="จำนวนเงินรวมทั้งสิ้น" value={money(calculation?.grandTotal)} />
  <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t pt-2">
    <label className="flex items-center gap-2 text-sm">
      <input
        checked={payload.withholdingTaxRate !== null}
        className="size-4 accent-primary"
        onChange={(event) => setWithholdingEnabled(event.target.checked)}
        type="checkbox"
      />
      หักภาษี ณ ที่จ่าย
      <Numeric
        disabled={payload.withholdingTaxRate === null}
        error={fieldErrors.withholdingTaxRate}
        field="withholdingTaxRate"
        onChange={(value) => updateRoot("withholdingTaxRate", value)}
        size="compact"
        value={payload.withholdingTaxRate ?? "0.00"}
      />
      %
    </label>
    <output>{money(calculation?.withholdingTaxTotal)}</output>
  </div>
  <Totals bold label="ยอดชำระ" value={money(calculation?.amountDue)} />
  <p className="text-sm">{calculation ? formatThaiBahtText(calculation.amountDue) : "—"}</p>
</section>
```

- [ ] **Step 5: Update Preview/Print and list output**

In `QuotationDocument`:

- display optional `เรื่อง / ชื่องาน: {payload.subject}` near reference;
- remove all customer contact rendering;
- change item `รวม` from `lineTotal` to `netAmount`;
- label money columns `ราคา (บาท)` and `รวม (บาท)`;
- use the same seven total labels and values as the editor;
- generate the amount-in-words from `amountDue`.

In `QuotationList`, replace the currency formatter with:

```ts
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 });
const moneyInBaht = (value: string) => `${money.format(Number(value))} บาท`;
```

Use `moneyInBaht()` in both mobile cards and the desktop table.

- [ ] **Step 6: Run focused tests and typecheck**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-ui.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-list.tsx tests/quotation-calculator.test.ts tests/quotation-ui.test.ts
git commit -m "feat: add quotation discounts withholding and baht totals"
```

---

### Task 5: Enable saved-only Public Read-only sharing and final action placement

**Files:**

- Modify: `components/admin/quotations/quotation-editor.tsx:21,48,79-139,227-229`
- Modify: `app/admin/quotations/new/page.tsx:1-18`
- Modify: `app/admin/quotations/[id]/page.tsx:1-17`
- Create: `app/q/[token]/page.tsx`
- Test: `tests/quotation-public-share.test.ts`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**

- Consumes: Task 2 `publicToken`, `getPublicQuotationByToken()`, public RPC, and Task 4 shared `QuotationDocument`.
- Produces: `QuotationEditorProps.publicToken`, native clipboard sharing, `/q/[token]`, saved-only share enablement, and final header/seller action placement.

- [ ] **Step 1: Write failing public-share and action-placement tests**

Create `tests/quotation-public-share.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("quotation public share", () => {
  it("renders a token-scoped public document without admin auth", () => {
    const page = source("../app/q/[token]/page.tsx");
    assert.match(page, /getPublicQuotationByToken/);
    assert.match(page, /createSupabaseServerClient/);
    assert.match(page, /calculateQuotation/);
    assert.match(page, /QuotationDocument/);
    assert.match(page, /notFound\(\)/);
    assert.match(page, /robots:\s*\{\s*follow:\s*false,\s*index:\s*false/);
    assert.doesNotMatch(page, /requireAdmin|canUseQuotation/);
  });

  it("enables share only for a saved public token", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /publicToken/);
    assert.match(editor, /navigator\.clipboard\.writeText/);
    assert.match(editor, /\/q\/\$\{publicToken\}/);
    assert.match(editor, /disabled=\{!publicToken/);
    assert.match(editor, /data-document-actions/);
  });
});
```

Update `tests/quotation-ui.test.ts` to assert:

- the command bar contains text-only Close and Save buttons;
- Share, Print, Download, and More are under `data-document-actions` inside the
  seller strip;
- Preview remains reachable from More;
- Download remains disabled;
- Share is no longer rendered as a disabled future action.

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-share.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because the route, editor token state, and active Share action do
not exist.

- [ ] **Step 3: Pass public tokens through Create/Edit and save state**

Change the editor contract:

```ts
export interface QuotationEditorProps {
  documentNumber: string | null;
  initialPayload: QuotationPayload;
  printOnLoad?: boolean;
  publicToken: string | null;
}
```

- New page passes `publicToken={null}`.
- Edit page passes `publicToken={quotation.publicToken}`.
- Editor initializes local token state from the prop.
- After successful save, call `setPublicToken(result.publicToken)` before
  navigation/refresh.

- [ ] **Step 4: Add the public page**

Create `app/q/[token]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuotationDocument } from "../../../components/admin/quotations/quotation-document";
import { calculateQuotation } from "../../../lib/quotation-calculator";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getPublicQuotationByToken } from "../../../server/repositories/quotations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "ใบเสนอราคา",
};

export default async function PublicQuotationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const supabase = await createSupabaseServerClient();
  const quotation = await getPublicQuotationByToken(supabase, token);
  if (!quotation) notFound();
  const calculation = calculateQuotation(quotation.payload);

  return <main className="min-h-screen overflow-auto bg-muted p-4 print:bg-white print:p-0">
    <QuotationDocument
      calculation={calculation}
      documentNumber={quotation.documentNumber}
      payload={quotation.payload}
    />
  </main>;
}
```

- [ ] **Step 5: Implement copy-link sharing and final action placement**

Add:

```ts
async function shareSaved() {
  if (!publicToken) return;
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/q/${publicToken}`);
    toast.success("คัดลอกลิงก์สาธารณะแล้ว");
  } catch {
    toast.error("ไม่สามารถคัดลอกลิงก์ได้");
  }
}
```

Recompose actions as approved:

- Command bar: document identity left; text-only `ปิด` and `บันทึก` right. Do
  not render X or Save icons in these two buttons.
- Seller strip: seller identity and `แก้ไขเฉพาะใบ` left; one
  `data-document-actions` group right with icon+label Share, Print, Download,
  and More.
- Share is disabled when `!publicToken || isPending` and calls `shareSaved`.
- Print remains disabled before save and calls the existing saved-only print.
- Download remains disabled with `title="ยังไม่รองรับใน MVP นี้"`.
- More contains Preview, Save and Close, and conditional Delete.
- Preview uses current draft; Print and Public continue using saved data only.

- [ ] **Step 6: Run focused tests, typecheck, and build the public route**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-share.test.ts tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts
npm run typecheck
npm run build
```

Expected: PASS and the build includes `/q/[token]` as a dynamic route.

- [ ] **Step 7: Manually verify saved-only sharing**

With local Supabase and the app running:

1. Open a new quotation: Share disabled.
2. Save: Share enabled and copies `/q/<uuid>`.
3. Open the link in an incognito window: no login redirect; latest saved
   quotation appears.
4. Change the editor without saving: the public page remains unchanged.
5. Save: refresh public page and see the new values.
6. Soft-delete: public link returns 404.
7. Confirm page source/output contains no internal notes or removed customer
   contact data.

- [ ] **Step 8: Commit Task 5**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx app/admin/quotations/new/page.tsx app/admin/quotations/[id]/page.tsx app/q/[token]/page.tsx tests/quotation-public-share.test.ts tests/quotation-ui.test.ts
git commit -m "feat: add saved quotation public sharing"
```

---

### Task 6: Documentation, responsive inspection, and full regression

**Files:**

- Modify: `docs/quotation-management.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Verify: all changed quotation and migration files

**Interfaces:**

- Consumes: completed Tasks 1-5.
- Produces: accurate operator/developer documentation and Definition-of-Done evidence.

- [ ] **Step 1: Update feature documentation**

Update `docs/quotation-management.md` to state:

- customer snapshots contain only name/address/tax/office/branch;
- subject is labelled `เรื่อง / ชื่องาน`;
- all user-visible currency copy is `บาท`;
- item discount and VAT remain per item;
- document discount and withholding are checkbox-controlled;
- the approved calculation order and exact seven totals labels;
- item order is drag-and-drop and persists on save;
- Share is saved-only and `/q/[token]` is no-login Public Read-only;
- Public reads use the latest saved row, exclude internal notes, and stop after
  soft delete;
- Download, workflow, approval, customer acceptance, payment, installments,
  and revision history remain out of scope.

Update `README.md` with `/q/[token]` and saved-only sharing. Update the quotation
flow in `docs/architecture.md` to include:

```text
Public /q/[token]
  -> anon Supabase client
  -> public security-invoker RPC
  -> private token-scoped security-definer function
  -> active quotation + items only
  -> shared QuotationDocument
```

Document that no anon table policy or service-role client is used.

- [ ] **Step 2: Run every automated check**

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: all commands exit 0. Existing unrelated `<img>` lint warnings may
remain, but quotation files must introduce no new warnings or errors.

- [ ] **Step 3: Inspect authenticated responsive layouts**

Inspect Create and Edit with realistic Thai names, addresses, item descriptions,
discounts, mixed VAT rates, and withholding at:

```text
390x844 mobile
768x1024 tablet
1366x768 laptop
1920x1080 desktop
```

Expected:

- metadata inputs stop at their semantic width on desktop and fill available
  width on mobile;
- native dropdown indicators remain visible;
- no item controls are duplicated or clipped;
- drag handle reorders by pointer and keyboard without dragging from an input;
- quantity is required, unit is optional;
- Add Item is the lower-left button inside `03 รายการ`;
- totals remain right-aligned and do not create a second scroll container;
- top Close/Save buttons have no icons;
- Share/Print/Download/More stay with the seller strip.

- [ ] **Step 4: Inspect Preview/Print/Public output**

Verify:

- Preview uses current draft;
- Print uses latest saved data and remains A4;
- Public uses latest saved data without login;
- customer contacts and internal notes never appear;
- subject and reference appear in document metadata;
- line `รวม` is after item discount and before VAT;
- totals exactly match calculator tests;
- all currency wording says `บาท`;
- soft-deleted public token returns 404.

- [ ] **Step 5: Review migration security**

Confirm against Supabase's current guidance:

- RLS stays enabled on both public quotation tables;
- no direct anon table grant/policy was added;
- the security-definer implementation is in `private` with fixed `search_path`;
- the exposed wrapper is security invoker;
- execute grants are explicit for both `anon` and `authenticated`;
- `db lint --local --fail-on error` passes.

References:

- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

- [ ] **Step 6: Commit documentation and any verification-only fixes**

```powershell
git add -- README.md docs/architecture.md docs/quotation-management.md
git commit -m "docs: document quotation workbench and public share"
```

Final handoff must report files changed, migration environment, typecheck/lint/
test/build results, responsive and document views inspected, public security
checks, documentation updates, skipped checks, and unrelated worktree changes
left untouched.

---

## Execution Handoff

Implement this plan in an isolated worktree created with
`superpowers:using-git-worktrees`, then use either:

1. **Subagent-Driven (recommended):** `superpowers:subagent-driven-development`
   with a fresh implementation agent and two-stage review per task.
2. **Inline Execution:** `superpowers:executing-plans` with task batches and
   review checkpoints.

The user intends to run implementation in a new chat. Start that chat by
linking this plan and selecting one of the two execution modes; do not redesign
the approved flow during implementation.
