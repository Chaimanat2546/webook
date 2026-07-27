# Quotation Document Display Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user quotation display defaults and an independently editable per-quotation snapshot that controls inputs, calculations, and every document surface.

**Architecture:** Store the same validated ten-boolean JSON object on `quotation_company_profiles` and `quotations`. New drafts copy the profile default, saved quotations read only their snapshot, and one shared pure function clears values disabled by the snapshot before calculation or persistence. A focused modal groups quotation fields and certification display controls, edits the draft, and optionally saves the user's future default.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, ShadcnUI, Supabase PostgreSQL/RLS/RPC, `node:test`, React PDF

## Global Constraints

- The ten exact settings are `reference`, `notes`, `discount`, `unit`, `tax`, `preTax`, `withholdingTax`, `certificationQr`, `certificationDate`, and `certificationName`.
- `reference` controls the existing `reference` field; do not add another reference field.
- `notes` controls public document notes only; internal notes are unaffected.
- Turning off reference, notes, discount, unit, tax, or withholding tax clears the corresponding values after confirmation; turning them on does not restore values.
- `preTax` is display-only and never changes calculations.
- `certificationQr`, `certificationDate`, and `certificationName` are display-only and never clear Public tokens, issue dates, signer names, or customer names.
- `certificationName` controls issuer, approver, and customer receiver names.
- `certificationDate` controls issuer and approver dates plus the receiver blank date line.
- Turning off `certificationQr` hides its heading and image and skips QR generation; PDF download must not require a QR while it is off.
- The certification row retains its five-slot structure when certification content is hidden.
- Existing profiles and quotations migrate to all ten settings enabled.
- Empty discount and VAT columns remain automatically omitted even when their settings are enabled.
- The modal actions must be exactly `ใช้เฉพาะใบเสนอราคานี้` and `บันทึกเป็นค่าเริ่มต้นทุกใบ`.
- The second action must explain `มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว`.
- A failed default save must not change the draft or clear values.
- The modal stacks `ข้อมูลใบเสนอราคา` (seven switches) and `การรับรอง` (three switches) as separate headed sections with a divider.
- Use existing ShadcnUI primitives and installed dependencies; add no dependency.
- Work locally only. Create a new migration but do not push it to any Supabase project or deploy Cloudflare without a separate explicit request.
- Project subagents are read-only; only the main agent edits files.

---

## File Map

**Create**

- `lib/quotation-document-display.ts` — exact type, defaults, validation, clear-impact detection, and value-clearing normalization.
- `components/admin/quotations/quotation-document-display-dialog.tsx` — responsive two-section modal, ten switches, scope actions, and destructive confirmation.
- `supabase/migrations/20260723110000_quotation_document_display_settings.sql` — columns, checks, grants, snapshot save wrapper, and public read projection.

**Modify**

- `lib/quotation-types.ts` — add `documentDisplay` to `QuotationPayload`.
- `lib/quotation-document-view.ts` — derive all shared visibility flags from the snapshot.
- `server/services/quotations.ts` — copy defaults into empty drafts, validate the snapshot, clear disabled values, and include it in the RPC payload.
- `server/repositories/quotations.ts` — select/map both JSON columns and save per-user defaults.
- `app/admin/quotations/actions.ts` — authenticated action for immediate default saving.
- `app/admin/quotations/new/page.tsx` — seed new drafts from the profile default.
- `components/admin/quotations/quotation-editor.tsx` — action-bar button, modal integration, conditional controls, and dirty-state behavior.
- `app/q/[token]/page.tsx` — skip Public QR generation when the saved snapshot disables it.
- `components/admin/quotations/quotation-document.tsx` — condition HTML document fields, columns, and totals.
- `components/admin/quotations/quotation-pdf.tsx` — mirror the shared visibility flags in PDF.
- `docs/quotation-management.md` — document defaults, snapshots, clearing, and affected surfaces.

**Test**

- `tests/quotation-service.test.ts`
- `tests/quotation-migration.test.ts`
- `tests/quotation-migration-upgrade.test.ts`
- `tests/quotation-repository-actions.test.ts`
- `tests/quotation-public-share.test.ts`
- `tests/quotation-ui.test.ts`
- `tests/quotation-pdf.test.ts`
- `tests/quotation-public-qr.test.ts`
- `tests/quotation-database-integration.test.ts`

---

### Task 1: Shared display model and server enforcement

**Files:**

- Create: `lib/quotation-document-display.ts`
- Modify: `lib/quotation-types.ts`
- Modify: `server/services/quotations.ts`
- Test: `tests/quotation-service.test.ts`

**Interfaces:**

- Produces:
  - `QuotationDocumentDisplay`
  - `QuotationDocumentDisplayKey`
  - `QUOTATION_DOCUMENT_DISPLAY_DEFAULTS`
  - `isQuotationDocumentDisplay(value: unknown): value is QuotationDocumentDisplay`
  - `normalizeQuotationDocumentDisplay(value: unknown): QuotationDocumentDisplay`
  - `quotationDocumentDisplayClearImpact(payload, next): QuotationDocumentDisplayKey[]`
  - `applyQuotationDocumentDisplay(payload, next): QuotationPayload`
- `QuotationPayload.documentDisplay` is required on every draft, saved payload, preview, print, PDF, and public response.

- [ ] **Step 1: Write failing service tests**

Add a `documentDisplay` value to `validPayload()` and tests that assert invalid
or incomplete objects fail validation and disabled values are cleared before
calculation:

```ts
import {
  QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
  applyQuotationDocumentDisplay,
  quotationDocumentDisplayClearImpact,
} from "../lib/quotation-document-display.ts";

// Inside validPayload()
documentDisplay: { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS },

it("rejects an incomplete document display snapshot", () => {
  const payload = validPayload();
  payload.documentDisplay = { reference: true } as QuotationPayload["documentDisplay"];
  assert.throws(
    () => prepareQuotationPayload(payload),
    (error: unknown) =>
      error instanceof QuotationValidationError
      && error.fieldErrors.documentDisplay === "รูปแบบเอกสารไม่ถูกต้อง",
  );
});

it("clears disabled document values before calculation and persistence", () => {
  const payload = validPayload();
  payload.reference = "REF-1";
  payload.publicNotes = "Public note";
  payload.items[0] = {
    ...payload.items[0],
    discountAmount: "500.00",
    unit: "คืน",
    vatRate: "7",
    vatTreatment: "taxable",
  };
  payload.withholdingTaxRate = "3";
  payload.documentDisplay = {
    certificationDate: false,
    certificationName: false,
    certificationQr: false,
    discount: false,
    notes: false,
    preTax: false,
    reference: false,
    tax: false,
    unit: false,
    withholdingTax: false,
  };

  const result = prepareQuotationPayload(payload);
  assert.equal(result.payload.reference, "");
  assert.equal(result.payload.publicNotes, "");
  assert.equal(result.payload.items[0].discountAmount, "0");
  assert.equal(result.payload.items[0].unit, "");
  assert.equal(result.payload.items[0].vatTreatment, "none");
  assert.equal(result.payload.items[0].vatRate, "0");
  assert.equal(result.payload.withholdingTaxRate, null);
  assert.equal(result.calculation.preTaxTotal, "10000.00");
  assert.deepEqual(
    result.rpcPayload.document_display_snapshot,
    payload.documentDisplay,
  );
});

it("reports only settings whose disabled values would be cleared", () => {
  const payload = validPayload();
  payload.reference = "REF-1";
  payload.items[0].unit = "คืน";
  const next = {
    ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
    preTax: false,
    reference: false,
    unit: false,
  };

  assert.deepEqual(
    quotationDocumentDisplayClearImpact(payload, next),
    ["reference", "unit"],
  );
  assert.equal(applyQuotationDocumentDisplay(payload, next).documentDisplay.preTax, false);
});
```

- [ ] **Step 2: Run the service test and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts
```

Expected: FAIL because `documentDisplay` and its helpers do not exist.

- [ ] **Step 3: Implement the exact shared model**

Create `lib/quotation-document-display.ts`:

```ts
import type { QuotationPayload } from "./quotation-types.ts";

export const QUOTATION_DOCUMENT_DISPLAY_KEYS = [
  "certificationDate",
  "certificationName",
  "certificationQr",
  "reference",
  "notes",
  "discount",
  "unit",
  "tax",
  "preTax",
  "withholdingTax",
] as const;

export type QuotationDocumentDisplayKey =
  (typeof QUOTATION_DOCUMENT_DISPLAY_KEYS)[number];

export type QuotationDocumentDisplay = Record<
  QuotationDocumentDisplayKey,
  boolean
>;

export const QUOTATION_DOCUMENT_DISPLAY_DEFAULTS: QuotationDocumentDisplay = {
  certificationDate: true,
  certificationName: true,
  certificationQr: true,
  discount: true,
  notes: true,
  preTax: true,
  reference: true,
  tax: true,
  unit: true,
  withholdingTax: true,
};

export function isQuotationDocumentDisplay(
  value: unknown,
): value is QuotationDocumentDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === QUOTATION_DOCUMENT_DISPLAY_KEYS.length
    && QUOTATION_DOCUMENT_DISPLAY_KEYS.every(
      (key) => typeof record[key] === "boolean",
    )
  );
}

export function normalizeQuotationDocumentDisplay(
  value: unknown,
): QuotationDocumentDisplay {
  return isQuotationDocumentDisplay(value)
    ? { ...value }
    : { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS };
}

export function quotationDocumentDisplayClearImpact(
  payload: QuotationPayload,
  next: QuotationDocumentDisplay,
): QuotationDocumentDisplayKey[] {
  return [
    !next.reference && payload.reference ? "reference" : null,
    !next.notes && payload.publicNotes ? "notes" : null,
    !next.discount && payload.items.some((item) => Number(item.discountAmount) !== 0)
      ? "discount"
      : null,
    !next.unit && payload.items.some((item) => item.unit.trim()) ? "unit" : null,
    !next.tax && payload.items.some((item) => item.vatTreatment !== "none")
      ? "tax"
      : null,
    !next.withholdingTax && payload.withholdingTaxRate !== null
      ? "withholdingTax"
      : null,
  ].filter((key): key is QuotationDocumentDisplayKey => key !== null);
}

export function applyQuotationDocumentDisplay(
  payload: QuotationPayload,
  next: QuotationDocumentDisplay,
): QuotationPayload {
  return {
    ...payload,
    documentDisplay: { ...next },
    items: payload.items.map((item) => ({
      ...item,
      discountAmount: next.discount ? item.discountAmount : "0",
      unit: next.unit ? item.unit : "",
      vatRate: next.tax ? item.vatRate : "0",
      vatTreatment: next.tax ? item.vatTreatment : "none",
    })),
    publicNotes: next.notes ? payload.publicNotes : "",
    reference: next.reference ? payload.reference : "",
    withholdingTaxRate: next.withholdingTax
      ? payload.withholdingTaxRate
      : null,
  };
}
```

Import `QuotationDocumentDisplay` into `lib/quotation-types.ts` with a type-only
import and add:

```ts
documentDisplay: QuotationDocumentDisplay;
```

to `QuotationPayload`.

- [ ] **Step 4: Enforce the model at the server boundary**

In `server/services/quotations.ts`:

```ts
import {
  applyQuotationDocumentDisplay,
  isQuotationDocumentDisplay,
  normalizeQuotationDocumentDisplay,
} from "../../lib/quotation-document-display.ts";
```

Extend `emptyQuotationPayload`:

```ts
export function emptyQuotationPayload(
  seller: SellerSnapshot,
  now: Date,
  certification = emptyCertificationSnapshot(),
  documentDisplay: unknown = undefined,
): QuotationPayload {
  const issueDate = getBangkokCalendarDate(now);
  const validityDays = "7";
  return {
    certification,
    customer: { address: "", branchNumber: "", name: "", officeType: "head_office", taxId: "" },
    documentDisplay: normalizeQuotationDocumentDisplay(documentDisplay),
    id: null,
    internalNotes: "",
    issueDate,
    items: [{ description: "", discountAmount: "0", id: crypto.randomUUID(), name: "", position: 1, quantity: "1", unit: "", unitPrice: "0.00", vatRate: "0", vatTreatment: "none" }],
    paymentMethods: [],
    publicNotes: "",
    reference: "",
    seller,
    subject: "",
    validUntil: addQuotationCalendarDays(issueDate, Number(validityDays)),
    validityDays,
    withholdingTaxRate: null,
  };
}
```

In `prepareQuotationPayload`, reject anything other than the exact shape, build
the parsed payload, then clear disabled values before calculation:

```ts
if (!isQuotationDocumentDisplay(source.documentDisplay)) {
  errors.documentDisplay = "รูปแบบเอกสารไม่ถูกต้อง";
}
const documentDisplay = normalizeQuotationDocumentDisplay(
  source.documentDisplay,
);

const parsedPayload: QuotationPayload = {
  // existing parsed fields
  documentDisplay,
};
const payload = applyQuotationDocumentDisplay(parsedPayload, documentDisplay);
```

Add the snapshot to `rpcPayload`:

```ts
document_display_snapshot: payload.documentDisplay,
```

- [ ] **Step 5: Run focused and type checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts
npm.cmd run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- lib/quotation-document-display.ts lib/quotation-types.ts server/services/quotations.ts tests/quotation-service.test.ts
git commit -m "feat: add quotation document display model"
```

---

### Task 2: Database defaults, snapshots, atomic save, and public projection

**Files:**

- Create: `supabase/migrations/20260723110000_quotation_document_display_settings.sql`
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-migration-upgrade.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`
- Modify: `tests/quotation-public-share.test.ts`

**Interfaces:**

- Consumes `document_display_snapshot` from Task 1's RPC payload.
- Produces `quotation_company_profiles.document_display_defaults`.
- Produces `quotations.document_display_snapshot`.
- Keeps the public RPC name `save_quotation_with_payments(jsonb)` unchanged.

- [ ] **Step 1: Write failing migration contract tests**

Add assertions that the newest migration contains both columns, exact boolean
checks, column grants, the save wrapper, and public projection:

```ts
assert.match(migration, /document_display_defaults jsonb not null/);
assert.match(migration, /document_display_snapshot jsonb not null/);
assert.match(migration, /document_display_defaults \?& array\[/);
assert.match(migration, /document_display_snapshot \?& array\[/);
assert.match(migration, /grant insert \([\s\S]*document_display_defaults/);
assert.match(migration, /grant update \([\s\S]*document_display_defaults/);
assert.match(migration, /save_quotation_with_document_display/);
assert.match(
  migration,
  /'document_display_snapshot', q\.document_display_snapshot/,
);
```

Extend the upgrade test to require all existing rows to receive the all-true
default. Extend the integration/public tests to assert:

```ts
assert.deepEqual(saved.payload.documentDisplay, {
  certificationDate: true,
  certificationName: true,
  certificationQr: true,
  discount: true,
  notes: true,
  preTax: true,
  reference: true,
  tax: true,
  unit: true,
  withholdingTax: true,
});
assert.equal("internalNotes" in publicQuotation.payload, false);
```

- [ ] **Step 2: Run migration/public tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-migration-upgrade.test.ts tests/quotation-public-share.test.ts
```

Expected: FAIL because the migration and mapped snapshot do not exist.

- [ ] **Step 3: Create the migration**

Create `20260723110000_quotation_document_display_settings.sql` with this schema
and wrapper logic:

```sql
alter table public.quotation_company_profiles
  add column document_display_defaults jsonb not null default '{
    "certificationDate": true,
    "certificationName": true,
    "certificationQr": true,
    "reference": true,
    "notes": true,
    "discount": true,
    "unit": true,
    "tax": true,
    "preTax": true,
    "withholdingTax": true
  }'::jsonb;

alter table public.quotations
  add column document_display_snapshot jsonb not null default '{
    "certificationDate": true,
    "certificationName": true,
    "certificationQr": true,
    "reference": true,
    "notes": true,
    "discount": true,
    "unit": true,
    "tax": true,
    "preTax": true,
    "withholdingTax": true
  }'::jsonb;

alter table public.quotation_company_profiles
  add constraint quotation_company_profiles_document_display_defaults_valid
  check (
    jsonb_typeof(document_display_defaults) = 'object'
    and document_display_defaults ?& array[
      'certificationDate', 'certificationName', 'certificationQr',
      'reference', 'notes', 'discount', 'unit', 'tax', 'preTax',
      'withholdingTax'
    ]
    and (
      document_display_defaults
      - 'certificationDate' - 'certificationName' - 'certificationQr'
      - 'reference' - 'notes' - 'discount' - 'unit' - 'tax'
      - 'preTax' - 'withholdingTax'
    ) = '{}'::jsonb
    and jsonb_typeof(document_display_defaults -> 'certificationDate') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'certificationName') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'certificationQr') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'reference') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'notes') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'discount') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'unit') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'tax') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'preTax') = 'boolean'
    and jsonb_typeof(document_display_defaults -> 'withholdingTax') = 'boolean'
  );

alter table public.quotations
  add constraint quotations_document_display_snapshot_valid
  check (
    jsonb_typeof(document_display_snapshot) = 'object'
    and document_display_snapshot ?& array[
      'certificationDate', 'certificationName', 'certificationQr',
      'reference', 'notes', 'discount', 'unit', 'tax', 'preTax',
      'withholdingTax'
    ]
    and (
      document_display_snapshot
      - 'certificationDate' - 'certificationName' - 'certificationQr'
      - 'reference' - 'notes' - 'discount' - 'unit' - 'tax'
      - 'preTax' - 'withholdingTax'
    ) = '{}'::jsonb
    and jsonb_typeof(document_display_snapshot -> 'certificationDate') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'certificationName') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'certificationQr') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'reference') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'notes') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'discount') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'unit') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'tax') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'preTax') = 'boolean'
    and jsonb_typeof(document_display_snapshot -> 'withholdingTax') = 'boolean'
  );

revoke insert, update on public.quotation_company_profiles from authenticated;
grant insert (
  user_id, seller_name, address, tax_id, office_type, branch_number, phone,
  email, website, contact_name, contact_phone, contact_email, logo_url,
  document_display_defaults, updated_at
) on public.quotation_company_profiles to authenticated;
grant update (
  user_id, seller_name, address, tax_id, office_type, branch_number, phone,
  email, website, contact_name, contact_phone, contact_email, logo_url,
  document_display_defaults, updated_at
) on public.quotation_company_profiles to authenticated;

create or replace function private.save_quotation_with_document_display(
  p_payload jsonb
)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_saved record;
  v_display jsonb := p_payload -> 'document_display_snapshot';
begin
  select * into v_saved
  from private.save_quotation_with_payments(p_payload);

  update public.quotations
  set document_display_snapshot = v_display
  where quotations.id = v_saved.id
    and quotations.created_by = auth.uid()
    and quotations.deleted_at is null;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Quotation does not belong to current user';
  end if;

  return query select v_saved.id, v_saved.document_number;
end;
$$;

create or replace function public.save_quotation_with_payments(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select *
  from private.save_quotation_with_document_display(p_payload);
$$;

revoke all on function private.save_quotation_with_document_display(jsonb)
  from public;
grant execute on function private.save_quotation_with_document_display(jsonb)
  to authenticated;

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
    'seller_snapshot', q.seller_snapshot,
    'certification_snapshot', q.certification_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')
    ),
    'document_display_snapshot', q.document_display_snapshot,
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
        'discount_amount', i.discount_amount,
        'vat_treatment', i.vat_treatment,
        'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i
      where i.quotation_id = q.id
    ), '[]'::jsonb),
    'quotation_payment_methods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'type', p.type,
        'position', p.position,
        'bank_code', case when p.type = 'bank_transfer' then p.bank_code else '' end,
        'bank_name', case when p.type = 'bank_transfer' then p.bank_name else '' end,
        'bank_logo_url', case when p.type = 'bank_transfer' then p.bank_logo_url else '' end,
        'custom_bank_name', case when p.type = 'bank_transfer' then p.custom_bank_name else '' end,
        'custom_bank_logo_url', case when p.type = 'bank_transfer' then p.custom_bank_logo_url else '' end,
        'account_number', case when p.type = 'bank_transfer' then p.account_number else '' end,
        'account_type', case when p.type = 'bank_transfer' then p.account_type else '' end,
        'account_name', case when p.type in ('bank_transfer', 'promptpay') then p.account_name else '' end,
        'promptpay_id', case when p.type = 'promptpay' then p.promptpay_id else '' end,
        'provider_name', case when p.type in ('qr_payment', 'other') then p.provider_name else '' end,
        'instructions', p.instructions,
        'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end,
        'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end
      ) order by p.position)
      from public.quotation_payment_methods p
      where p.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null;
$$;
```

- [ ] **Step 4: Verify the migration locally**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-migration-upgrade.test.ts tests/quotation-public-share.test.ts tests/quotation-database-integration.test.ts
```

Expected: PASS. If the local Supabase stack is already running, also run:

```powershell
npx.cmd supabase db reset
```

Expected: all migrations apply and the database integration test passes. Do not
start a new stack or push a remote database in this task.

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/migrations tests/quotation-migration.test.ts tests/quotation-migration-upgrade.test.ts tests/quotation-database-integration.test.ts tests/quotation-public-share.test.ts
git commit -m "feat: persist quotation display snapshots"
```

---

### Task 3: Repository mapping and immediate per-user default save

**Files:**

- Modify: `server/repositories/quotations.ts`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `app/admin/quotations/new/page.tsx`
- Modify: `tests/quotation-repository-actions.test.ts`
- Modify: `tests/quotation-service.test.ts`

**Interfaces:**

- Consumes `normalizeQuotationDocumentDisplay` and the DB columns from Tasks 1–2.
- Produces:
  - `companyProfileToDocumentDisplay(row): QuotationDocumentDisplay`
  - `saveQuotationDocumentDisplayDefaults(supabase, userId, value): Promise<void>`
  - `saveQuotationDocumentDisplayDefaultsAction(value): Promise<{ ok: true } | { formError: string; ok: false }>`

- [ ] **Step 1: Write failing repository/action tests**

Add source/behavior tests for selecting and mapping both columns, owner-scoped
upsert, and the action's stable result:

```ts
assert.match(repository, /document_display_defaults/);
assert.match(repository, /document_display_snapshot/);
assert.match(repository, /\.eq\("user_id", userId\)/);
assert.match(actions, /saveQuotationDocumentDisplayDefaultsAction/);
assert.match(actions, /รูปแบบเอกสารไม่ถูกต้อง/);
assert.match(newPage, /companyProfileToDocumentDisplay/);
```

Add a service assertion:

```ts
const payload = emptyQuotationPayload(
  seller,
  new Date("2026-07-23T00:00:00.000Z"),
  emptyCertificationSnapshot(),
  { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS, unit: false },
);
assert.equal(payload.documentDisplay.unit, false);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts
```

Expected: FAIL because repository mappings and the action do not exist.

- [ ] **Step 3: Add repository mappings**

Extend `QuotationCompanyProfileRow` with:

```ts
document_display_defaults: unknown;
```

Add `document_display_defaults` to the company profile select,
`document_display_snapshot` to `quotationSelect` and `DatabaseQuotationRow`,
then map it in `quotationRowToPayload`:

```ts
documentDisplay: normalizeQuotationDocumentDisplay(
  row.document_display_snapshot,
),
```

Export:

```ts
export function companyProfileToDocumentDisplay(
  row: QuotationCompanyProfileRow,
): QuotationDocumentDisplay {
  return normalizeQuotationDocumentDisplay(row.document_display_defaults);
}

export async function saveQuotationDocumentDisplayDefaults(
  supabase: SupabaseClient,
  userId: string,
  value: QuotationDocumentDisplay,
): Promise<void> {
  const { error } = await supabase
    .from("quotation_company_profiles")
    .upsert(
      {
        document_display_defaults: value,
        updated_at: new Date().toISOString(),
        user_id: userId,
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Add the authenticated default action and seed new drafts**

In `app/admin/quotations/actions.ts` export:

```ts
export type QuotationDocumentDisplayDefaultsActionResult =
  | { ok: true }
  | { formError: string; ok: false };

export async function saveQuotationDocumentDisplayDefaultsAction(
  value: unknown,
): Promise<QuotationDocumentDisplayDefaultsActionResult> {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการรูปแบบเอกสาร", ok: false };
  }
  if (!isQuotationDocumentDisplay(value)) {
    return { formError: "รูปแบบเอกสารไม่ถูกต้อง", ok: false };
  }
  try {
    await saveQuotationDocumentDisplayDefaults(supabase, user.id, value);
    revalidatePath("/admin/quotations/new");
    return { ok: true };
  } catch (error) {
    console.error(
      "Failed to save quotation document display defaults",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      formError: "ไม่สามารถบันทึกค่าเริ่มต้นรูปแบบเอกสารได้ กรุณาลองอีกครั้ง",
      ok: false,
    };
  }
}
```

In `app/admin/quotations/new/page.tsx`, pass the mapped profile default as the
fourth argument:

```ts
const initialPayload = emptyQuotationPayload(
  profile ? companyProfileToSeller(profile) : emptySeller,
  new Date(),
  profile
    ? companyProfileToCertification(profile)
    : emptyCertificationSnapshot(),
  profile
    ? companyProfileToDocumentDisplay(profile)
    : QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
);
```

- [ ] **Step 5: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- server/repositories/quotations.ts app/admin/quotations/actions.ts app/admin/quotations/new/page.tsx tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts tests/quotation-public-share.test.ts
git commit -m "feat: save quotation display defaults"
```

---

### Task 4: Modal, destructive confirmation, and conditional editor controls

**Files:**

- Create: `components/admin/quotations/quotation-document-display-dialog.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**

- Consumes the Task 1 display helpers and Task 3 default action.
- Produces:

```ts
interface QuotationDocumentDisplayDialogProps {
  disabled: boolean;
  onApply: (
    value: QuotationDocumentDisplay,
    saveAsDefault: boolean,
  ) => Promise<boolean>;
  payload: QuotationPayload;
}
```

- [ ] **Step 1: Write failing UI contract tests**

Add assertions for exact copy, action-bar placement, accessible switch labels,
warning copy, and every conditional editor control:

```ts
assert.match(editor, /ตั้งค่ารูปแบบเอกสาร/);
assert.match(dialog, /ใช้เฉพาะใบเสนอราคานี้/);
assert.match(dialog, /บันทึกเป็นค่าเริ่มต้นทุกใบ/);
assert.match(dialog, /มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว/);
assert.match(dialog, /ข้อมูลต่อไปนี้จะถูกล้าง/);
assert.match(dialog, /ข้อมูลใบเสนอราคา/);
assert.match(dialog, /การรับรอง/);
assert.match(dialog, /QR Code/);
assert.match(dialog, /วันที่/);
assert.match(dialog, /ชื่อ/);
assert.match(editor, /payload\.documentDisplay\.reference/);
assert.match(editor, /payload\.documentDisplay\.notes/);
assert.match(editor, /payload\.documentDisplay\.discount/);
assert.match(editor, /payload\.documentDisplay\.unit/);
assert.match(editor, /payload\.documentDisplay\.tax/);
assert.match(editor, /payload\.documentDisplay\.withholdingTax/);
assert.match(editor, /saveQuotationDocumentDisplayDefaultsAction/);
```

- [ ] **Step 2: Run the UI test and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the modal and conditionals do not exist.

- [ ] **Step 3: Build the focused modal**

Create `quotation-document-display-dialog.tsx` using existing `Button`,
`Dialog`, `AlertDialog`, `Separator`, and `Switch` components. Use these exact
groups:

```ts
interface DisplayOption {
  description: string;
  key: QuotationDocumentDisplayKey;
  label: string;
}

const quotationOptions: DisplayOption[] = [
  { key: "reference", label: "อ้างอิงถึง", description: "แสดงช่องเลขอ้างอิง" },
  { key: "notes", label: "หมายเหตุ", description: "แสดงหมายเหตุบนเอกสาร" },
  { key: "discount", label: "ส่วนลด", description: "เปิดใช้ส่วนลดต่อรายการ" },
  { key: "unit", label: "หน่วย", description: "แสดงหน่วยของรายการ" },
  { key: "tax", label: "ภาษี", description: "เปิดใช้ VAT ต่อรายการ" },
  { key: "preTax", label: "มูลค่าก่อนภาษี", description: "ซ่อนหรือแสดงยอดเท่านั้น" },
  { key: "withholdingTax", label: "หัก ณ ที่จ่าย", description: "เปิดใช้ภาษีหัก ณ ที่จ่าย" },
];

const certificationOptions: DisplayOption[] = [
  { key: "certificationQr", label: "QR Code", description: "แสดง QR Code สำหรับเปิดเอกสารบนเว็บไซต์" },
  { key: "certificationDate", label: "วันที่", description: "แสดงวันที่ของผู้ลงนามและช่องวันที่ของลูกค้า" },
  { key: "certificationName", label: "ชื่อ", description: "แสดงชื่อผู้ออก ผู้อนุมัติ และลูกค้า" },
];

const optionGroups = [
  { title: "ข้อมูลใบเสนอราคา", options: quotationOptions },
  { title: "การรับรอง", options: certificationOptions },
] as const;

const options = optionGroups.flatMap((group) => group.options);
```

Render each group as a headed `<section>`, place `Separator` between the two
sections, and keep one vertical scroll region for the dialog body. Do not use
side-by-side groups on wide screens; the approved structure remains stacked on
mobile, tablet, laptop, and desktop.

The dialog copies `payload.documentDisplay` into local state whenever it opens.
Both scope buttons call one `requestApply(saveAsDefault)` function. That
function computes `quotationDocumentDisplayClearImpact(payload, draft)`;
if non-empty it opens the AlertDialog and waits for confirmation, otherwise it
calls `onApply` directly. Disable both actions while awaiting `onApply`.

The AlertDialog lists Thai labels from `options`, never raw keys. Close the
modal only when `onApply` resolves `true`.

- [ ] **Step 4: Integrate the modal and preserve failure atomicity**

In `QuotationEditor`, add:

```ts
async function applyDocumentDisplay(
  value: QuotationDocumentDisplay,
  saveAsDefault: boolean,
): Promise<boolean> {
  if (saveAsDefault) {
    const result = await saveQuotationDocumentDisplayDefaultsAction(value);
    if (!result.ok) {
      toast.error(result.formError);
      return false;
    }
  }
  changed("documentDisplay");
  setPayload((current) => applyQuotationDocumentDisplay(current, value));
  if (saveAsDefault) toast.success("บันทึกค่าเริ่มต้นรูปแบบเอกสารแล้ว");
  return true;
}
```

Place this button in the existing top action group near Preview and Save:

```tsx
<QuotationDocumentDisplayDialog
  disabled={isPending || uploadingFields.size > 0}
  onApply={applyDocumentDisplay}
  payload={payload}
/>
```

Condition these existing editor controls:

```tsx
{payload.documentDisplay.reference ? <ReferenceField /> : null}
{payload.documentDisplay.unit ? <ItemUnitControl {...props} /> : null}
{payload.documentDisplay.discount ? <ItemDiscountControls {...props} /> : null}
{payload.documentDisplay.tax ? <ItemVatControls {...props} /> : null}
{payload.documentDisplay.notes ? <PublicNotesField /> : null}
{payload.documentDisplay.withholdingTax ? <WithholdingControls /> : null}
```

Keep `internalNotes` and all calculations mounted. Do not condition calculations
on `preTax`; it only affects document rendering.

- [ ] **Step 5: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-service.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- components/admin/quotations/quotation-document-display-dialog.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add quotation display settings modal"
```

---

### Task 5: Shared HTML and PDF visibility

**Files:**

- Modify: `lib/quotation-document-view.ts`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-pdf.tsx`
- Modify: `app/q/[token]/page.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-pdf.test.ts`
- Modify: `tests/quotation-public-share.test.ts`
- Modify: `tests/quotation-public-qr.test.ts`

**Interfaces:**

- Extends `QuotationDocumentViewModel` with:

```ts
showNotes: boolean;
showCertificationDate: boolean;
showCertificationName: boolean;
showCertificationQr: boolean;
showPreTax: boolean;
showReference: boolean;
showTax: boolean;
showUnit: boolean;
showWithholdingTax: boolean;
```

- Existing `showItemDiscount` and `showItemVat` remain and are gated by the
  snapshot plus actual item data.

- [ ] **Step 1: Write failing rendering tests**

Add a view-model test matrix and source contracts:

```ts
const payload = validPayload();
payload.documentDisplay = {
  certificationDate: false,
  certificationName: false,
  certificationQr: false,
  discount: false,
  notes: false,
  preTax: false,
  reference: false,
  tax: false,
  unit: false,
  withholdingTax: false,
};
const model = buildQuotationDocumentViewModel({
  calculation: calculateQuotation(payload),
  documentNumber: "QT-1",
  payload,
});
assert.equal(model.showItemDiscount, false);
assert.equal(model.showItemVat, false);
assert.equal(model.showNotes, false);
assert.equal(model.showCertificationDate, false);
assert.equal(model.showCertificationName, false);
assert.equal(model.showCertificationQr, false);
assert.equal(model.showPreTax, false);
assert.equal(model.showReference, false);
assert.equal(model.showUnit, false);
assert.equal(model.showWithholdingTax, false);
```

Assert both HTML and PDF source consume the same flags:

```ts
for (const flag of [
  "showCertificationDate",
  "showCertificationName",
  "showCertificationQr",
  "showNotes",
  "showPreTax",
  "showReference",
  "showTax",
  "showUnit",
  "showWithholdingTax",
]) {
  assert.match(documentSource, new RegExp(`model\\.${flag}`));
  assert.match(pdfSource, new RegExp(`model\\.${flag}`));
}
```

- [ ] **Step 2: Run rendering tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts
```

Expected: FAIL because the new view-model flags do not exist.

- [ ] **Step 3: Make the view model authoritative**

In `buildQuotationDocumentViewModel`, return:

```ts
showItemDiscount:
  payload.documentDisplay.discount
  && payload.items.some((item) => Number(item.discountAmount) > 0),
showItemVat:
  payload.documentDisplay.tax
  && payload.items.some((item) => item.vatTreatment !== "none"),
showNotes: payload.documentDisplay.notes && Boolean(payload.publicNotes),
showCertificationDate: payload.documentDisplay.certificationDate,
showCertificationName: payload.documentDisplay.certificationName,
showCertificationQr: payload.documentDisplay.certificationQr,
showPreTax: payload.documentDisplay.preTax,
showReference:
  payload.documentDisplay.reference && Boolean(payload.reference),
showTax: payload.documentDisplay.tax,
showUnit: payload.documentDisplay.unit,
showWithholdingTax: payload.documentDisplay.withholdingTax,
```

- [ ] **Step 4: Apply the flags to HTML and PDF**

In both renderers:

- wrap reference metadata with `model.showReference`;
- omit the Unit header/cell when `model.showUnit` is false;
- keep discount/VAT columns on `model.showItemDiscount`/`model.showItemVat`;
- wrap the pre-tax total row with `model.showPreTax`;
- wrap VAT summary with `model.showTax`;
- wrap withholding summary with `model.showWithholdingTax`;
- wrap public notes with `model.showNotes`.
- keep all five certification slot wrappers mounted;
- inside the QR slot, wrap both its heading and image with
  `model.showCertificationQr`;
- inside issuer and approver slots, wrap signer names with
  `model.showCertificationName` and dates with `model.showCertificationDate`;
- inside the receiver slot, wrap the customer name with
  `model.showCertificationName` and the blank date line with
  `model.showCertificationDate`.

Do not condition internal notes because neither document renderer receives or
renders them.

Condition QR preparation at every boundary:

```ts
const needsCertificationQr = payload.documentDisplay.certificationQr;
const publicQrDataUrl = needsCertificationQr
  ? await createQuotationPublicQrDataUrl(publicUrl)
  : "";
```

- In `app/q/[token]/page.tsx`, call `createQuotationPublicQrDataUrl` only when
  `quotation.payload.documentDisplay.certificationQr` is true.
- In `quotation-editor.tsx`, include `payload.documentDisplay.certificationQr`
  in the QR effect decision. When false, settle with an empty QR without
  calling the generator. Printing must not wait for QR while false.
- In PDF download, generate the QR only when the saved payload flag is true.
- In `collectQuotationPdfImageSources`, include `model.publicQrDataUrl` only
  when `model.showCertificationQr` is true.
- Replace the unconditional PDF requirement with:

```ts
if (
  model.showCertificationQr
  && !images[model.publicQrDataUrl]
) {
  throw new Error("Public QR image is unavailable");
}
```

Add a regression test that injects a QR generator which throws, disables
`certificationQr`, and asserts PDF preparation succeeds without invoking the
generator. Retain the existing failure test for the enabled state.

- [ ] **Step 5: Run rendering and regression checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts tests/quotation-public-qr.test.ts tests/quotation-print.test.ts
npm.cmd run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- lib/quotation-document-view.ts components/admin/quotations/quotation-editor.tsx components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-pdf.tsx app/q/[token]/page.tsx tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts tests/quotation-public-qr.test.ts
git commit -m "feat: apply quotation display snapshots"
```

---

### Task 6: Documentation, responsive verification, and final regression gate

**Files:**

- Modify: `docs/quotation-management.md`

**Interfaces:**

- Documents the completed behavior; produces no new runtime interface.

- [ ] **Step 1: Update behavior documentation**

Add a short `Document display settings` section covering:

```markdown
### Document display settings

Each user has ten defaults for reference, public notes, item discount, unit,
VAT, pre-tax total, withholding tax, certification QR Code, certification
dates, and certification names. A new quotation copies those defaults into its
own snapshot. Saved quotations never follow later default changes.

Create/Edit exposes the settings from the top action bar. “ใช้เฉพาะใบเสนอราคา
นี้” changes the draft snapshot. “บันทึกเป็นค่าเริ่มต้นทุกใบ” also saves the
user default immediately for future quotations; it does not update saved
quotations.

Turning off reference, public notes, discount, unit, VAT, or withholding tax
requires confirmation when data would be cleared. Pre-tax is display-only.
Certification QR Code, date, and name settings are also display-only and do
not clear their source data. The modal groups the first seven controls under
`ข้อมูลใบเสนอราคา` and the three certification controls under `การรับรอง`.
Disabling certification QR skips QR generation and does not block PDF
download.
The snapshot controls Create/Edit, Preview, Print, PDF, and Public Share.
```

Remove or replace any older statement that says no document-settings control
exists.

- [ ] **Step 2: Run the complete automated gate**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all PASS.

- [ ] **Step 3: Verify responsive and document flows locally**

With the existing local dev server, verify at widths `390`, `768`, `1366`, and
`1536`:

1. Open Create and confirm the action-bar button remains reachable.
2. Toggle every switch and confirm both scope actions fit without horizontal
   scrolling.
   Confirm `ข้อมูลใบเสนอราคา` and `การรับรอง` remain separate stacked sections.
3. Turn off a populated field and confirm the consolidated warning appears.
4. Cancel and confirm no value changes.
5. Save only the current quotation and confirm a second new draft retains the
   previous user default.
6. Save as default and confirm a new draft copies it.
7. Confirm Preview, saved Print, PDF, and Public Share match the snapshot.
   Disable each certification option separately and confirm the five-slot row
   remains aligned while only the intended QR, dates, or names disappear.
   Download PDF with QR disabled and confirm no QR error occurs.
8. Edit a saved quotation and confirm changing the user default elsewhere does
   not change its snapshot.

Expected: all eight checks pass at all four widths.

- [ ] **Step 4: Run the required read-only project review**

Spawn `webook_reviewer` in read-only mode with the implementation range and ask
it to check:

- spec coverage;
- value clearing and calculation correctness;
- RLS/grants/RPC ownership;
- public data exposure;
- HTML/PDF parity;
- responsive/accessibility regressions.

Fix only evidence-backed findings, then rerun Step 2.

- [ ] **Step 5: Commit final docs/fixes**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: explain quotation display settings"
```

If the reviewer required code fixes, stage their exact files in the same commit
only when they are inseparable from the documented behavior; otherwise make a
separate focused fix commit before the documentation commit.

---

## Definition of Done

- The ten switches have the approved labels, two-section grouping, and
  behavior.
- Per-user defaults and per-quotation snapshots are both persisted and owner
  isolated.
- Existing quotations start all enabled and remain independently editable.
- Default-save failure leaves the modal and draft unchanged.
- Disabled values are cleared at both UI and server trust boundaries.
- Preview, Print, PDF, and Public Share use one visibility model.
- Typecheck, lint, full tests, and production build pass.
- Responsive checks pass at mobile, tablet, laptop, and desktop widths.
- Documentation matches the implementation.
- No dependency, remote database, or deployment change was made.
