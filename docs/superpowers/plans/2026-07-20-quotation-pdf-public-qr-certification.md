# Quotation PDF, Public QR, And Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-owned certification masters, per-quotation certification snapshots, saved-document Public QR, and direct Thai PDF download while moving payment and certification overrides into tabs below the quotation notes.

**Architecture:** Extend the existing account-owned company profile with fixed certification fields and persist one normalized JSON snapshot on each quotation through the current transactional RPC. Reuse the existing PNG upload/Media Worker boundary, build one presentation view model for the HTML and React PDF renderers, and generate Public QR images from the saved token at render time rather than storing them.

**Tech Stack:** TypeScript strict mode, React 19, Next.js App Router, Tailwind/ShadcnUI, Supabase PostgreSQL/RPC/RLS, `qrcode`, `@react-pdf/renderer`, Node test runner, Media Worker/R2.

## Global Constraints

- The master has exactly one issuer, one approver, and one company stamp per authenticated account.
- Every certification field is optional; empty text and URLs normalize to `null` in database JSON and to `""` in the TypeScript form model.
- A new quotation copies the current master; an existing quotation reads and edits only its saved snapshot.
- The receiver is a blank document signing slot and has no database field.
- Preview shows current editor state. Public Share and direct PDF Download require a saved, clean quotation.
- Public Read-only always returns the latest successful save and never internal notes or unsaved state.
- QR points to `/q/{public_token}`, is generated at render time, and is never stored.
- Signature/stamp sources accept PNG, JPEG, or WebP up to 2 MB and are normalized to PNG.
- Add one new migration. Do not edit historical migrations, drop data, or reset a production-like database.
- Keep A4 only in Preview/Print/PDF. Create/Edit remains a full-width responsive workbench.
- Reuse existing dependencies and primitives; add no signer service, approval workflow, PDF service, QR table, or generic asset framework.

---

## File Map

- `lib/quotation-certification.ts`: certification value types, empty value, and database JSON serialization.
- `lib/quotation-types.ts`: adds certification to `QuotationPayload`.
- `server/services/quotations.ts`: trusted certification normalization and quotation RPC mapping.
- `server/repositories/quotations.ts`: profile fields, snapshot hydration, certification master save, and snapshot reads.
- `supabase/migrations/20260720120000_quotation_pdf_qr_certification.sql`: forward-only columns, validation, save, and Public serialization.
- `lib/quotation-assets.ts`: certification PNG key, URL, and file validation.
- `workers/media/src/index.ts`: permits the new certification PNG prefix.
- `app/admin/quotations/actions.ts`: certification upload/master-save actions and quotation URL validation.
- `components/admin/quotations/quotation-png-image-input.tsx`: shared local PNG normalization/preview input.
- `components/admin/quotations/certification-fields.tsx`: reusable issuer, approver, and stamp editor.
- `components/admin/quotations/company-profile-form.tsx`: certification settings wrapper.
- `app/admin/quotations/settings/company/page.tsx`: third URL-driven settings section.
- `app/admin/quotations/new/page.tsx`: copies certification master into a new quotation.
- `components/admin/quotations/quotation-editor.tsx`: completion tabs, dirty-state gates, current Preview, QR state, and PDF action.
- `lib/quotation-public-qr.ts`: exact Public URL and QR Data URL generation.
- `lib/quotation-document-view.ts`: shared formatted document view model.
- `components/admin/quotations/document-image.tsx`: hides an unavailable optional document image without breaking the document.
- `components/admin/quotations/quotation-document.tsx`: HTML Preview/Print/Public QR and three-slot certification layout.
- `app/q/[token]/page.tsx`: generates the QR for Public Read-only without admin auth.
- `components/admin/quotations/quotation-pdf.tsx`: lazy React PDF A4 composition, image conversion, and browser download.
- `public/fonts/NotoSansThai-Regular.ttf`: embedded regular Thai PDF font.
- `public/fonts/NotoSansThai-SemiBold.ttf`: embedded semibold Thai PDF font.
- `public/fonts/OFL.txt`: SIL Open Font License for the bundled Noto files.
- `tests/quotation-certification.test.ts`: value and validation behavior.
- `tests/quotation-migration.test.ts`: forward-only schema/RPC contract.
- `tests/quotation-database-integration.test.ts`: ownership, snapshot, Public, and soft-delete behavior.
- `tests/quotation-assets.test.ts`: certification key, URL, and source validation.
- `tests/media-worker.test.ts`: certification PNG Worker boundary.
- `tests/quotation-repository-actions.test.ts`: repository/action propagation and permission checks.
- `tests/quotation-ui.test.ts`: settings navigation, tabs, dirty gates, and document composition.
- `tests/quotation-public-share.test.ts`: Public QR and saved snapshot behavior.
- `tests/quotation-pdf.test.ts`: PDF entry point, assets, filename, and layout contract.
- `docs/quotation-management.md`: user-visible master/snapshot, tabs, QR, and PDF behavior.

---

### Task 1: Certification Value Model And Server Normalization

**Files:**
- Create: `lib/quotation-certification.ts`
- Modify: `lib/quotation-types.ts`
- Modify: `server/services/quotations.ts`
- Modify: `server/repositories/quotations.ts`
- Create: `tests/quotation-certification.test.ts`
- Modify: `tests/quotation-service.test.ts`

**Interfaces:**
- Produces: `CertificationSigner { name: string; position: string; signatureUrl: string }`.
- Produces: `CertificationSnapshot { issuer: CertificationSigner; approver: CertificationSigner; companyStampUrl: string }`.
- Produces: `emptyCertificationSnapshot(): CertificationSnapshot`.
- Produces: `certificationSnapshotToJson(snapshot): Record<string, unknown>` with nullable snake-case URLs.
- Produces: `prepareCertificationSnapshot(value): CertificationSnapshot`.
- Produces: `companyProfileToCertification(row): CertificationSnapshot`.
- Extends: `QuotationPayload.certification: CertificationSnapshot`.
- Extends: `PreparedQuotation.rpcPayload.certification_snapshot`.

- [ ] **Step 1: Write failing certification model and service tests**

Create `tests/quotation-certification.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  certificationSnapshotToJson,
  emptyCertificationSnapshot,
} from "../lib/quotation-certification.ts";
import {
  prepareQuotationPayload,
  QuotationValidationError,
} from "../server/services/quotations.ts";

const validPayload = () => ({
  certification: {
    approver: { name: "  ผู้อนุมัติ  ", position: "กรรมการ", signatureUrl: "" },
    companyStampUrl: "",
    issuer: { name: "  ผู้ออกเอกสาร  ", position: "ฝ่ายขาย", signatureUrl: "" },
  },
  customer: { address: "Customer address", branchNumber: "", name: "Customer", officeType: "head_office", taxId: "" },
  id: null,
  internalNotes: "",
  issueDate: "2026-07-20",
  items: [{ description: "", discountAmount: "0", id: crypto.randomUUID(), name: "Room", position: 1, quantity: "1", unit: "คืน", unitPrice: "1000", vatRate: "0", vatTreatment: "none" }],
  paymentMethods: [],
  publicNotes: "",
  reference: "",
  seller: { address: "Seller address", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "Seller", officeType: "head_office", phone: "", taxId: "0100000000000", website: "" },
  subject: "",
  validUntil: "2026-08-04",
  validityDays: "15",
  withholdingTaxRate: null,
});

describe("quotation certification", () => {
  it("creates independent empty values and nullable database JSON", () => {
    const first = emptyCertificationSnapshot();
    const second = emptyCertificationSnapshot();
    first.issuer.name = "changed";
    assert.equal(second.issuer.name, "");
    assert.deepEqual(certificationSnapshotToJson(second), {
      approver: { name: null, position: null, signature_url: null },
      company_stamp_url: null,
      issuer: { name: null, position: null, signature_url: null },
    });
  });

  it("trims certification and includes it in the transactional payload", () => {
    const prepared = prepareQuotationPayload(validPayload());
    assert.equal(prepared.payload.certification.issuer.name, "ผู้ออกเอกสาร");
    assert.equal(prepared.rpcPayload.certification_snapshot.issuer.name, "ผู้ออกเอกสาร");
    assert.equal(prepared.rpcPayload.certification_snapshot.approver.signature_url, null);
  });

  it("rejects overlong certification fields", () => {
    const value = validPayload();
    value.certification.issuer.name = "x".repeat(201);
    assert.throws(
      () => prepareQuotationPayload(value),
      (error) => error instanceof QuotationValidationError
        && error.fieldErrors["certification.issuer.name"] === "ข้อมูลยาวเกินกำหนด",
    );
  });
});
```

Extend the existing `emptyQuotationPayload` test in `tests/quotation-service.test.ts`:

```ts
assert.deepEqual(payload.certification, emptyCertificationSnapshot());
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-certification.test.ts tests/quotation-service.test.ts
```

Expected: FAIL because the certification module and payload field do not exist.

- [ ] **Step 3: Add the minimal certification value object**

Create `lib/quotation-certification.ts`:

```ts
export interface CertificationSigner {
  name: string;
  position: string;
  signatureUrl: string;
}

export interface CertificationSnapshot {
  approver: CertificationSigner;
  companyStampUrl: string;
  issuer: CertificationSigner;
}

export function emptyCertificationSnapshot(): CertificationSnapshot {
  return {
    approver: { name: "", position: "", signatureUrl: "" },
    companyStampUrl: "",
    issuer: { name: "", position: "", signatureUrl: "" },
  };
}

const nullable = (value: string) => value || null;

export function certificationSnapshotToJson(snapshot: CertificationSnapshot) {
  return {
    approver: {
      name: nullable(snapshot.approver.name),
      position: nullable(snapshot.approver.position),
      signature_url: nullable(snapshot.approver.signatureUrl),
    },
    company_stamp_url: nullable(snapshot.companyStampUrl),
    issuer: {
      name: nullable(snapshot.issuer.name),
      position: nullable(snapshot.issuer.position),
      signature_url: nullable(snapshot.issuer.signatureUrl),
    },
  };
}
```

Import `CertificationSnapshot` in `lib/quotation-types.ts` and add:

```ts
certification: CertificationSnapshot;
```

to `QuotationPayload`.

- [ ] **Step 4: Normalize certification once at the service boundary**

In `server/services/quotations.ts`, add an exported normalizer that reuses the
existing `objectValue`, `stringValue`, and `bounded` functions:

```ts
export function prepareCertificationSnapshot(value: unknown): CertificationSnapshot {
  const errors: Record<string, string> = {};
  let source: Record<string, unknown>;
  try { source = objectValue(value ?? {}, "certification"); }
  catch { errors.certification = "ข้อมูลรับรองไม่ถูกต้อง"; source = {}; }

  const signer = (key: "approver" | "issuer"): CertificationSigner => {
    let row: Record<string, unknown>;
    try { row = objectValue(source[key] ?? {}, `certification.${key}`); }
    catch { errors[`certification.${key}`] = "ข้อมูลผู้ลงนามไม่ถูกต้อง"; row = {}; }
    return {
      name: bounded(stringValue(row, "name"), 200, `certification.${key}.name`, errors),
      position: bounded(stringValue(row, "position"), 200, `certification.${key}.position`, errors),
      signatureUrl: bounded(stringValue(row, "signatureUrl"), 2_048, `certification.${key}.signatureUrl`, errors),
    };
  };

  const certification = {
    approver: signer("approver"),
    companyStampUrl: bounded(stringValue(source, "companyStampUrl"), 2_048, "certification.companyStampUrl", errors),
    issuer: signer("issuer"),
  };
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return certification;
}
```

Use `emptyCertificationSnapshot()` in `emptyQuotationPayload`. In
`prepareQuotationPayload`, call `prepareCertificationSnapshot` inside the same
error-merging pattern used for seller/payment validation, include the result in
the returned `payload`, and serialize it with `certificationSnapshotToJson` as
`rpcPayload.certification_snapshot`.

- [ ] **Step 5: Hydrate profile and quotation rows**

Extend `QuotationCompanyProfileRow` with the seven nullable snake-case fields,
extend `DatabaseQuotationRow` and `quotationSelect` with
`certification_snapshot`, and add to `server/repositories/quotations.ts`:

```ts
export function companyProfileToCertification(
  row: QuotationCompanyProfileRow,
): CertificationSnapshot {
  return {
    approver: {
      name: stringValue(row.approver_name),
      position: stringValue(row.approver_position),
      signatureUrl: stringValue(row.approver_signature_url),
    },
    companyStampUrl: stringValue(row.company_stamp_url),
    issuer: {
      name: stringValue(row.issuer_name),
      position: stringValue(row.issuer_position),
      signatureUrl: stringValue(row.issuer_signature_url),
    },
  };
}
```

Add a `certificationSnapshot(value: unknown)` mapper that reads the canonical
snake-case URL keys and returns empty strings for null/missing legacy data.
Include `certification: certificationSnapshot(row.certification_snapshot)` in
`quotationRowToPayload`. Extend the company-profile select list with the seven
new fields.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-certification.test.ts tests/quotation-service.test.ts
npm.cmd run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- lib/quotation-certification.ts lib/quotation-types.ts server/services/quotations.ts server/repositories/quotations.ts tests/quotation-certification.test.ts tests/quotation-service.test.ts
git commit -m "feat: add quotation certification model"
```

---

### Task 2: Forward-Only Certification Migration And Snapshot Security

**Files:**
- Create: `supabase/migrations/20260720120000_quotation_pdf_qr_certification.sql`
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Produces: seven nullable certification columns on `quotation_company_profiles`.
- Produces: `quotations.certification_snapshot jsonb not null`.
- Extends: `private.save_quotation_with_payments(jsonb)` to save canonical certification atomically.
- Extends: `private.get_public_quotation(uuid)` to return only the saved certification snapshot.
- Produces: `private.validate_quotation_certification_asset_url(text)` using the configured Media Worker origin.

- [ ] **Step 1: Add failing migration contract tests**

In `tests/quotation-migration.test.ts`, load the exact new migration filename
and assert:

```ts
assert.match(certificationSql, /alter table public\.quotation_company_profiles[\s\S]*issuer_name text[\s\S]*approver_name text[\s\S]*company_stamp_url text/i);
assert.match(certificationSql, /alter table public\.quotations[\s\S]*certification_snapshot jsonb not null default '\{\}'::jsonb/i);
assert.match(certificationSql, /jsonb_typeof\(certification_snapshot\) = 'object'/i);
assert.match(certificationSql, /p_payload -> 'certification_snapshot'/i);
assert.match(certificationSql, /update public\.quotations[\s\S]*certification_snapshot = v_certification/i);
assert.match(certificationSql, /'certification_snapshot', q\.certification_snapshot/i);
assert.match(certificationSql, /validate_quotation_certification_asset_url/i);
assert.match(certificationSql, /quotations\/certification-assets/i);
assert.doesNotMatch(certificationSql, /drop table|drop column|truncate/i);
```

Extend the database integration `payload()` fixture with:

```ts
certification_snapshot: {
  approver: { name: null, position: null, signature_url: null },
  company_stamp_url: null,
  issuer: { name: "Issuer", position: "Sales", signature_url: null },
},
```

Add an integration assertion that saving a quotation, changing the profile's
`issuer_name`, and reading the quotation still returns `Issuer`. Assert the
anonymous `get_public_quotation` response contains the same saved snapshot,
does not contain `internal_notes`, and becomes `null` after soft delete.
Using the second authenticated account already created by this test, also
assert it cannot read or update the first account's certification columns.

- [ ] **Step 2: Run migration tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
```

Expected: FAIL because the new migration does not exist.

- [ ] **Step 3: Add profile and quotation columns**

Create `supabase/migrations/20260720120000_quotation_pdf_qr_certification.sql`
with:

```sql
alter table public.quotation_company_profiles
  add column issuer_name text,
  add column issuer_position text,
  add column issuer_signature_url text,
  add column approver_name text,
  add column approver_position text,
  add column approver_signature_url text,
  add column company_stamp_url text;

alter table public.quotations
  add column certification_snapshot jsonb not null default '{}'::jsonb,
  add constraint quotations_certification_snapshot_object_check
    check (jsonb_typeof(certification_snapshot) = 'object');
```

- [ ] **Step 4: Add the trusted certification URL validator**

The existing payment asset configuration already stores the exact trusted
Media Worker origin. Add this separate prefix-specific validator so payment
and certification paths cannot be substituted for each other:

```sql
create or replace function private.validate_quotation_certification_asset_url(p_url text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_origin text;
  v_path text;
begin
  if coalesce(btrim(p_url), '') = '' then return true; end if;
  select origin into v_origin from private.quotation_payment_asset_config where singleton;
  if v_origin is null or left(p_url, char_length(v_origin) + 1) <> (v_origin || '/') then return false; end if;
  v_path := substring(p_url from char_length(v_origin) + 1);
  return v_path ~* '^/quotations/certification-assets/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$';
end;
$$;
```

- [ ] **Step 5: Add one canonical database normalizer**

Add this private function in the migration:

```sql
create or replace function private.normalize_quotation_certification(p_value jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_value jsonb := coalesce(p_value, '{}'::jsonb);
  v_issuer jsonb := coalesce(v_value -> 'issuer', '{}'::jsonb);
  v_approver jsonb := coalesce(v_value -> 'approver', '{}'::jsonb);
  v_issuer_signature text := btrim(coalesce(v_issuer ->> 'signature_url', ''));
  v_approver_signature text := btrim(coalesce(v_approver ->> 'signature_url', ''));
  v_stamp text := btrim(coalesce(v_value ->> 'company_stamp_url', ''));
begin
  if jsonb_typeof(v_value) is distinct from 'object'
    or jsonb_typeof(v_issuer) is distinct from 'object'
    or jsonb_typeof(v_approver) is distinct from 'object'
    or char_length(btrim(coalesce(v_issuer ->> 'name', ''))) > 200
    or char_length(btrim(coalesce(v_issuer ->> 'position', ''))) > 200
    or char_length(v_issuer_signature) > 2048
    or char_length(btrim(coalesce(v_approver ->> 'name', ''))) > 200
    or char_length(btrim(coalesce(v_approver ->> 'position', ''))) > 200
    or char_length(v_approver_signature) > 2048
    or char_length(v_stamp) > 2048
    or not private.validate_quotation_certification_asset_url(v_issuer_signature)
    or not private.validate_quotation_certification_asset_url(v_approver_signature)
    or not private.validate_quotation_certification_asset_url(v_stamp) then
    raise exception using errcode = '22023', message = 'Invalid quotation certification';
  end if;

  return jsonb_build_object(
    'issuer', jsonb_build_object(
      'name', nullif(btrim(coalesce(v_issuer ->> 'name', '')), ''),
      'position', nullif(btrim(coalesce(v_issuer ->> 'position', '')), ''),
      'signature_url', nullif(v_issuer_signature, '')
    ),
    'approver', jsonb_build_object(
      'name', nullif(btrim(coalesce(v_approver ->> 'name', '')), ''),
      'position', nullif(btrim(coalesce(v_approver ->> 'position', '')), ''),
      'signature_url', nullif(v_approver_signature, '')
    ),
    'company_stamp_url', nullif(v_stamp, '')
  );
end;
$$;
```

- [ ] **Step 6: Replace the latest save and Public functions in the new migration**

Copy the complete current definitions of
`private.save_quotation_with_payments(jsonb)` and
`private.get_public_quotation(uuid)` from
`20260718180000_quotation_bank_account_type.sql` into the new migration, then
make these exact changes:

```sql
-- save function declarations
v_certification jsonb := private.normalize_quotation_certification(
  p_payload -> 'certification_snapshot'
);

-- immediately after the existing owner-checked company_profile_id update
update public.quotations
set certification_snapshot = v_certification
where quotations.id = v_saved.id
  and quotations.created_by = auth.uid()
  and quotations.deleted_at is null;

if not found then
  raise exception using errcode = '42501', message = 'Quotation does not belong to current user';
end if;
```

Add this key beside `seller_snapshot` in the Public JSON builder:

```sql
'certification_snapshot', q.certification_snapshot,
```

Retain all payment account-type fields, permission checks, amount validation,
grants, and revokes from the latest migration. Add:

```sql
revoke all on function private.normalize_quotation_certification(jsonb) from public;
revoke all on function private.validate_quotation_certification_asset_url(text) from public;
```

The two private helpers need no direct authenticated grant: the existing
security-definer save RPC calls them internally.

- [ ] **Step 7: Run static and local database tests**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
$env:RUN_QUOTATION_DB_TESTS='1'; node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts
```

Expected: static migration tests PASS. The integration test PASSes when the
local Supabase container/environment is available; otherwise record the exact
environment blocker and do not claim it passed.

- [ ] **Step 8: Commit Task 2**

```powershell
git add -- supabase/migrations/20260720120000_quotation_pdf_qr_certification.sql tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "feat: persist quotation certification snapshots"
```

---

### Task 3: Certification PNG Asset Boundary

**Files:**
- Modify: `lib/quotation-assets.ts`
- Modify: `workers/media/src/index.ts`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `tests/quotation-assets.test.ts`
- Modify: `tests/media-worker.test.ts`
- Modify: `tests/quotation-repository-actions.test.ts`

**Interfaces:**
- Produces: `buildQuotationCertificationAssetObjectKey()`.
- Produces: `validateQuotationCertificationAssetObjectKey(value)`.
- Produces: `buildQuotationCertificationAssetUrl(key, workerUrl)`.
- Produces: `validateQuotationCertificationAssetUrl(value, workerUrl)`.
- Produces: `validateQuotationCertificationAssetFile(file)`.
- Produces: `uploadQuotationCertificationAssetAction(formData)`.

- [ ] **Step 1: Add failing asset and Worker tests**

Add to `tests/quotation-assets.test.ts`:

```ts
const key = "quotations/certification-assets/123e4567-e89b-42d3-a456-426614174000.png";
assert.equal(buildQuotationCertificationAssetObjectKey(() => "123e4567-e89b-42d3-a456-426614174000"), key);
assert.equal(validateQuotationCertificationAssetObjectKey(key), key);
assert.throws(() => validateQuotationCertificationAssetObjectKey("quotations/certification-assets/../stamp.png"));
assert.equal(
  validateQuotationCertificationAssetUrl(
    `https://media.example/${key}`,
    "https://media.example",
  ),
  `https://media.example/${key}`,
);
for (const type of ["image/png", "image/jpeg", "image/webp"]) {
  assert.equal(
    validateQuotationCertificationAssetFile(new File(["x"], "signature", { type })).type,
    type,
  );
}
assert.throws(() => validateQuotationCertificationAssetFile(new File(["x"], "signature.svg", { type: "image/svg+xml" })), /PNG/);
assert.throws(() => validateQuotationCertificationAssetFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /2 MB/);
```

Add a Worker test that PUTs `image/png` to the certification key and expects
200, then PUTs `image/webp` to the same key and expects 415.

Add repository/action source assertions for permission, file validation,
PNG-only normalized upload, certification key building, and trusted URL
validation.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-assets.test.ts tests/media-worker.test.ts tests/quotation-repository-actions.test.ts
```

Expected: FAIL because certification asset functions and actions do not exist.

- [ ] **Step 3: Extend the existing asset helper without a new abstraction**

In `lib/quotation-assets.ts`, add the prefix and PNG filename rule:

```ts
const QUOTATION_CERTIFICATION_ASSET_PREFIX = "quotations/certification-assets/";
const CERTIFICATION_MAX_BYTES = 2 * 1024 * 1024;
const CERTIFICATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;
```

Implement the five exported certification functions using the same decoding,
path traversal, exact-origin, MIME, non-empty, and size checks as the existing
payment PNG functions. Certification URLs must only accept the certification
prefix; do not let them accept payment assets.

- [ ] **Step 4: Permit only certification PNGs in the Media Worker**

In `workers/media/src/index.ts`, add the prefix and regex:

```ts
"quotations/certification-assets/"
```

and:

```ts
const QUOTATION_CERTIFICATION_ASSET_KEY = /^quotations\/certification-assets\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;
```

Add certification to `keyFromRequest` validation and require `image/png` for
both payment and certification prefixes.
Keep existing wildcard GET CORS headers unchanged so the browser PDF renderer
can read stored images.

- [ ] **Step 5: Add the permission-checked upload action**

Add `uploadQuotationCertificationAssetAction` to
`app/admin/quotations/actions.ts`:

```ts
export async function uploadQuotationCertificationAssetAction(
  formData: FormData,
): Promise<QuotationPaymentAssetActionResult> {
  const { adminUser } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("กรุณาเลือกรูปการรับรอง");
    validateQuotationCertificationAssetFile(file);
    if (file.type !== "image/png") throw new Error("Certification image must be normalized to PNG");
    const env = getQuotationAssetEnv();
    const objectKey = buildQuotationCertificationAssetObjectKey();
    await uploadQuotationAssetObject({
      body: await file.arrayBuffer(),
      contentType: "image/png",
      objectKey,
      ...env,
    });
    return { ok: true, url: buildQuotationCertificationAssetUrl(objectKey, env.workerUrl) };
  } catch (error) {
    console.error("Failed to upload quotation certification asset", error instanceof Error ? error.message : "Unknown error");
    return {
      fieldErrors: {},
      formError: error instanceof Error && error.message.includes("2 MB")
        ? error.message
        : "ไม่สามารถอัปโหลดรูปการรับรองได้",
      ok: false,
    };
  }
}
```

Add `certificationAssetErrors` and invoke it in `saveQuotationAction` after
`prepareQuotationPayload`. Validate all three non-empty certification URLs
against `getQuotationAssetEnv().workerUrl`; map failures to:

- `certification.issuer.signatureUrl`;
- `certification.approver.signatureUrl`;
- `certification.companyStampUrl`.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-assets.test.ts tests/media-worker.test.ts tests/quotation-repository-actions.test.ts
npm.cmd run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- lib/quotation-assets.ts workers/media/src/index.ts app/admin/quotations/actions.ts tests/quotation-assets.test.ts tests/media-worker.test.ts tests/quotation-repository-actions.test.ts
git commit -m "feat: add quotation certification image uploads"
```

---

### Task 4: Certification Master Settings

**Files:**
- Create: `components/admin/quotations/quotation-png-image-input.tsx`
- Create: `components/admin/quotations/certification-fields.tsx`
- Modify: `components/admin/quotations/payment-image-input.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Modify: `app/admin/quotations/settings/company/page.tsx`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `server/repositories/quotations.ts`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-repository-actions.test.ts`

**Interfaces:**
- Produces: `normalizeQuotationPngImage(file): Promise<File>`.
- Produces: `QuotationPngImageInput` with saved preview, local preview, remove, and `onChange(File)`.
- Produces: `CertificationFields({ value, errors, disabled, onChange })`.
- Produces: `saveQuotationCompanyCertification(supabase, userId, certification)`.
- Produces: `saveCompanyCertificationAction(value)`.
- Produces: `CertificationSettings({ initialCertification })`.

- [ ] **Step 1: Add failing settings and UI contract tests**

Extend `tests/quotation-ui.test.ts` to assert that the settings page:

```ts
assert.match(page, /\?section=certification/);
assert.match(page, /selectedSection === "certification"/);
assert.match(page, /ข้อมูลรับรองหลัก/);
assert.match(page, /<CertificationSettings/);
assert.match(form, /บันทึกข้อมูลรับรอง/);
assert.match(fields, /ผู้ออกเอกสาร/);
assert.match(fields, /ผู้อนุมัติ/);
assert.match(fields, /ตราประทับบริษัท/);
assert.match(fields, /ลบรูป/);
assert.match(imageInput, /URL\.createObjectURL/);
assert.match(imageInput, /URL\.revokeObjectURL/);
assert.match(imageInput, /image\/png,image\/jpeg,image\/webp/);
```

Extend repository/action tests to assert the master update is filtered by
`user_id`, the action checks `canUseQuotation`, validates all asset URLs, and
does not write quotation snapshots.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts
```

Expected: FAIL because the certification settings components and action do not
exist.

- [ ] **Step 3: Generalize the existing PNG normalization input**

Move the browser Canvas logic from `payment-image-input.tsx` into
`quotation-png-image-input.tsx` and export:

```ts
export async function normalizeQuotationPngImage(file: File): Promise<File>
```

The function validates a 2 MB PNG/JPEG/WebP source, draws it to Canvas, exports
lossless PNG, and validates the result again. Export a component with:

```ts
interface QuotationPngImageInputProps {
  disabled?: boolean;
  error?: string;
  field: string;
  label: string;
  onChange: (file: File) => void;
  onRemove?: () => void;
  value?: string;
}
```

It shows `value` until a new local Blob preview exists, revokes Blob URLs on
replacement/unmount, and renders **ลบรูป** only when a saved/local image is
visible. Keep `payment-image-input.tsx` as a thin compatibility export:

```ts
export {
  normalizeQuotationPngImage as normalizePaymentImageToPng,
  QuotationPngImageInput as PaymentImageInput,
} from "./quotation-png-image-input";
```

This preserves the payment editor while removing duplicate Canvas code.

- [ ] **Step 4: Build reusable certification fields**

Create `certification-fields.tsx`. Render two signer fieldsets and one stamp
field. Text updates must create new nested objects:

```ts
onChange({
  ...value,
  issuer: { ...value.issuer, name: event.target.value },
});
```

For each image, normalize through `QuotationPngImageInput`, upload through
`uploadQuotationCertificationAssetAction`, and update the corresponding URL
only when the upload returns `ok: true`. During upload disable only that image
control. On failure retain the prior URL and show the returned Thai error.
Remove sets the form URL to `""`; physical orphan cleanup remains outside this
MVP.

- [ ] **Step 5: Save the account-owned master**

Add to `server/repositories/quotations.ts`:

```ts
export async function saveQuotationCompanyCertification(
  supabase: SupabaseClient,
  userId: string,
  certification: CertificationSnapshot,
): Promise<void> {
  const { data, error } = await supabase
    .from("quotation_company_profiles")
    .update({
      approver_name: certification.approver.name || null,
      approver_position: certification.approver.position || null,
      approver_signature_url: certification.approver.signatureUrl || null,
      company_stamp_url: certification.companyStampUrl || null,
      issuer_name: certification.issuer.name || null,
      issuer_position: certification.issuer.position || null,
      issuer_signature_url: certification.issuer.signatureUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quotation company profile not found");
}
```

Add `saveCompanyCertificationAction(value)` to actions. It must require admin
quotation permission, normalize with the same `prepareCertificationSnapshot`
used by quotation saves, validate three URLs through the certification asset
validator, call the repository with `user.id`, revalidate the settings page,
and return field errors without exposing raw database messages.

- [ ] **Step 6: Add the URL-driven settings section**

In `company-profile-form.tsx`, add `CertificationSettings` with local
certification state, `CertificationFields`, one polite result message, and a
**บันทึกข้อมูลรับรอง** button.

In `settings/company/page.tsx`:

- add a `BadgeCheck` section link for `?section=certification`;
- allow exactly `company`, `payments`, and `certification`;
- derive `initialCertification` with `companyProfileToCertification(profile)`;
- render `CertificationSettings` only for that section;
- change the subtitle to mention seller, payment, and certification settings.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts tests/quotation-certification.test.ts
npm.cmd run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add -- components/admin/quotations/quotation-png-image-input.tsx components/admin/quotations/certification-fields.tsx components/admin/quotations/payment-image-input.tsx components/admin/quotations/company-profile-form.tsx app/admin/quotations/settings/company/page.tsx app/admin/quotations/actions.ts server/repositories/quotations.ts tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts
git commit -m "feat: add quotation certification settings"
```

---

### Task 5: Completion Tabs And Per-Quotation Certification Editing

**Files:**
- Modify: `app/admin/quotations/new/page.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-service.test.ts`

**Interfaces:**
- Consumes: `companyProfileToCertification(profile)` for new quotations.
- Consumes: `CertificationFields` for per-quotation edits.
- Produces: `activeCompletionTab: "payments" | "certification"`.
- Preserves: existing payment snapshot content and add/reorder behavior.

- [ ] **Step 1: Add failing editor composition tests**

Extend `tests/quotation-ui.test.ts` with source contracts:

```ts
assert.doesNotMatch(editor, /04 ช่องทางชำระเงิน/);
assert.match(editor, /role="tablist"/);
assert.match(editor, /role="tab"/);
assert.match(editor, /ช่องทางชำระเงิน/);
assert.match(editor, /การรับรอง/);
assert.match(editor, /activeCompletionTab/);
assert.match(editor, /<CertificationFields/);
assert.match(editor, /lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
assert.match(editor, /data-completion-tabs/);
assert.match(editor, /data-payment-methods/);
assert.match(editor, /data-certification-fields/);
assert.match(newPage, /companyProfileToCertification\(profile\)/);
```

Add an assertion that Preview uses `payload` and `calculation`, not
`lastSavedPayload`, while the print portal continues using the saved payload.
Assert `canUseSavedDocument` contains `!isDirty` and the share/download tooltip
copy is **บันทึกการเปลี่ยนแปลงก่อน**.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-service.test.ts
```

Expected: FAIL because payment remains a numbered permanent section and no
certification tab exists.

- [ ] **Step 3: Copy master certification into new quotations**

In `new/page.tsx`, pass the master to the payload constructor:

```ts
const initialPayload = emptyQuotationPayload(
  companyProfileToSeller(profile),
  new Date(),
  companyProfileToCertification(profile),
);
```

Extend `emptyQuotationPayload` with an optional third argument defaulting to
`emptyCertificationSnapshot()` so current tests and callers stay compatible.

- [ ] **Step 4: Recompose the completion area**

In `quotation-editor.tsx`:

```ts
const [activeCompletionTab, setActiveCompletionTab] = useState<
  "certification" | "payments"
>("payments");
```

Delete the permanent numbered payment section. Keep one completion grid with
three sibling sections in mobile DOM order: notes, totals, tabs. Apply these
desktop positions without duplicating controls:

Use `grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]` on
`data-workbench-completion`. Move the current concrete notes JSX into a sibling
section with `lg:col-start-1 lg:row-start-1`; move the current concrete totals
JSX into the next sibling with
`lg:col-start-2 lg:row-span-2 lg:row-start-1`; place the new tabs sibling last
with `lg:col-start-1 lg:row-start-2`. The tablist has two native buttons with
`role="tab"`, stable IDs, `aria-selected`, and `aria-controls`; its single
tabpanel renders either the existing payment editor or `CertificationFields`.

The payment panel keeps the existing add button and `PaymentMethodList`.
The certification panel renders:

```tsx
<CertificationFields
  errors={fieldErrors}
  onChange={(certification) => updateRoot("certification", certification)}
  value={payload.certification}
/>
```

Use buttons styled as one quiet tab rule, not rounded cards. On mobile the DOM
order must be notes, totals, then tabs; use CSS order utilities rather than a
second copy of the controls.

- [ ] **Step 5: Make hidden-tab validation focusable**

When save returns a first field error, switch before focusing:

```ts
if (firstField?.startsWith("certification.")) setActiveCompletionTab("certification");
if (firstField?.startsWith("paymentMethods")) setActiveCompletionTab("payments");
if (firstField) requestAnimationFrame(() => focusField(firstField));
```

Tab buttons must support click, Tab focus, Enter, and Space through native
button behavior and expose `aria-selected`/`aria-controls`.

- [ ] **Step 6: Apply saved-clean gates and current Preview**

Change the saved-document gate to:

```ts
const canUseSavedDocument = Boolean(
  documentNumber && lastSavedPayload && publicToken && !isDirty && !isPending,
);
```

Share and Download use this gate and show
`title="บันทึกการเปลี่ยนแปลงก่อน"` only for a saved dirty quotation. Preview
uses the current `payload` and current successful `calculation`, so an unsaved
new quotation can be previewed. Keep browser Print on `lastSavedPayload` and
`savedCalculation` to preserve the existing saved-print behavior.

- [ ] **Step 7: Run focused tests and responsive browser checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-service.test.ts
npm.cmd run typecheck
```

Then inspect Create/Edit at 390×844, 768×1024, 1280×800, and 1536×864. Verify
no horizontal page overflow, totals remain readable, tabs are keyboard
operable, and switching tabs preserves unsaved values.

- [ ] **Step 8: Commit Task 5**

```powershell
git add -- app/admin/quotations/new/page.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts tests/quotation-service.test.ts
git commit -m "feat: add quotation completion tabs"
```

---

### Task 6: Public QR And Shared HTML Certification Document

**Files:**
- Create: `lib/quotation-public-qr.ts`
- Create: `lib/quotation-document-view.ts`
- Create: `components/admin/quotations/document-image.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `app/q/[token]/page.tsx`
- Create: `tests/quotation-public-qr.test.ts`
- Modify: `tests/quotation-public-share.test.ts`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: `buildQuotationPublicUrl(origin, token): string`.
- Produces: `createQuotationPublicQrDataUrl(url): Promise<string>`.
- Produces: `buildQuotationDocumentViewModel({ calculation, documentNumber, payload, publicQrDataUrl })`.
- Extends: `QuotationDocument` with optional `publicQrDataUrl`.

- [ ] **Step 1: Add failing Public URL, QR, and document tests**

Create `tests/quotation-public-qr.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQuotationPublicUrl,
  createQuotationPublicQrDataUrl,
} from "../lib/quotation-public-qr.ts";

describe("quotation Public QR", () => {
  it("builds the exact token URL without inheriting an origin path", () => {
    assert.equal(
      buildQuotationPublicUrl("https://example.com/admin/quotations", "123e4567-e89b-42d3-a456-426614174000"),
      "https://example.com/q/123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("generates a PNG Data URL", async () => {
    const value = await createQuotationPublicQrDataUrl("https://example.com/q/123e4567-e89b-42d3-a456-426614174000");
    assert.match(value, /^data:image\/png;base64,/);
  });
});
```

Extend UI/Public tests to require `data-document-public-qr`, the Thai scan
label, three signer slots, issue-date display, stamp/signature `object-contain`,
no receiver form input, and a `DocumentImage` fallback that hides a failed
optional image. Assert the Public page passes a QR Data URL, the editor clears
QR state when dirty, and an unsaved document never receives QR.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-qr.test.ts tests/quotation-public-share.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because Public QR and certification document blocks do not
exist.

- [ ] **Step 3: Implement exact Public URL and QR generation**

Create `lib/quotation-public-qr.ts`:

```ts
import QRCode from "qrcode";

export function buildQuotationPublicUrl(origin: string, token: string): string {
  const base = new URL(origin);
  return new URL(`/q/${encodeURIComponent(token)}`, base.origin).toString();
}

export function createQuotationPublicQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "image/png",
    width: 192,
  });
}
```

- [ ] **Step 4: Add the shared presentation view model**

Create `lib/quotation-document-view.ts` with a single exported builder. It
must return:

```ts
export interface QuotationDocumentViewModel {
  amountInWords: string;
  calculation: QuotationCalculation;
  certification: CertificationSnapshot;
  documentNumber: string;
  issueDate: string;
  payload: QuotationPayload;
  paymentMethods: Array<QuotationPaymentMethod & { qrSource: string }>;
  publicQrDataUrl: string;
  showItemDiscount: boolean;
  showItemVat: boolean;
  validUntil: string;
}
```

Move `documentDate` and automatic PromptPay QR source creation from
`quotation-document.tsx` into this file. Sort payments once here and preserve
the current Thai QR failure as an empty `qrSource`. Format dates and amount in
words once. Both HTML and PDF must call this builder; neither renderer may
recalculate ordering or business totals independently.

- [ ] **Step 5: Render Public QR and certification in HTML**

Create `document-image.tsx` as a client component. It keeps one boolean error
state, renders `null` after `onError`, and otherwise renders an `<img>` with the
provided `alt`, `className`, and `src`. Use it for issuer signature, approver
signature, and company stamp so an unavailable optional image leaves clean
space instead of a broken-image icon.

Extend `QuotationDocument` props with `publicQrDataUrl?: string | null`, build
the view model at the top, and replace existing local display derivations with
model values.

After notes, render the QR only when non-empty:

```tsx
{model.publicQrDataUrl ? (
  <section className="flex items-center gap-3 border-b py-3" data-document-public-qr>
    <img alt="QR สำหรับดูใบเสนอราคาออนไลน์" className="size-20 object-contain" src={model.publicQrDataUrl} />
    <p>สแกนเพื่อดูเอกสารออนไลน์</p>
  </section>
) : null}
```

Then render one `break-inside-avoid` three-column certification section. Each
seller slot reserves a fixed signature area, uses `object-contain`, shows
name/position only when non-empty, and displays the quotation issue date. The
receiver slot contains blank signature/name/position/date lines only. Render
the company stamp near the first two slots without absolute overlap over text.

- [ ] **Step 6: Generate QR in editor and Public page**

In the editor, keep `publicQrDataUrl` state. Build the Public URL with
`buildQuotationPublicUrl(window.location.origin, publicToken)` and use that
same value for clipboard Share. An effect must set QR state to `""` when
there is no token or the quotation is dirty; otherwise build the URL from
`window.location.origin`, generate the QR, ignore stale effect completions, and
show a toast only when generation fails. Pass it to current Preview and the
saved Print portal.

In `app/q/[token]/page.tsx`, use `headers()` to read the forwarded protocol and
host for the same request:

```ts
const requestHeaders = await headers();
const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
const protocol = forwardedProtocol === "https" ? "https" : "http";
const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
  || requestHeaders.get("host");
const publicUrl = host ? buildQuotationPublicUrl(`${protocol}://${host}`, token) : "";
let publicQrDataUrl = "";
try {
  publicQrDataUrl = publicUrl ? await createQuotationPublicQrDataUrl(publicUrl) : "";
} catch {
  publicQrDataUrl = "";
}
```

Pass the result to `QuotationDocument`. A missing host hides QR but must not
make the saved Public document unavailable.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-qr.test.ts tests/quotation-public-share.test.ts tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git add -- lib/quotation-public-qr.ts lib/quotation-document-view.ts components/admin/quotations/document-image.tsx components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-editor.tsx app/q/[token]/page.tsx tests/quotation-public-qr.test.ts tests/quotation-public-share.test.ts tests/quotation-ui.test.ts
git commit -m "feat: add quotation Public QR and certification document"
```

---

### Task 7: Direct Thai PDF Download

**Files:**
- Create: `components/admin/quotations/quotation-pdf.tsx`
- Create: `public/fonts/NotoSansThai-Regular.ttf`
- Create: `public/fonts/NotoSansThai-SemiBold.ttf`
- Create: `public/fonts/OFL.txt`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/quotation-pdf.test.ts`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: `collectQuotationPdfImageSources(model): string[]`.
- Produces: `resolveQuotationPdfImages(sources, convert): Promise<Record<string, string>>`.
- Produces: `downloadQuotationPdf(args): Promise<void>`.
- Consumes: the Task 6 document view model and QR Data URL.

- [ ] **Step 1: Add failing PDF contracts**

Create `tests/quotation-pdf.test.ts` with pure source collection tests and
renderer contracts:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pdfSource = readFileSync("components/admin/quotations/quotation-pdf.tsx", "utf8");
const editorSource = readFileSync("components/admin/quotations/quotation-editor.tsx", "utf8");

describe("quotation PDF", () => {
  it("uses the approved PDF renderer, shared model, Thai fonts, and A4", () => {
    assert.match(pdfSource, /@react-pdf\/renderer/);
    assert.match(pdfSource, /buildQuotationDocumentViewModel/);
    assert.match(pdfSource, /NotoSansThai-Regular\.ttf/);
    assert.match(pdfSource, /NotoSansThai-SemiBold\.ttf/);
    assert.match(pdfSource, /registerHyphenationCallback/);
    assert.match(pdfSource, /size="A4"/);
    assert.match(pdfSource, /wrap/);
  });

  it("downloads only through a lazy import and exact document filename", () => {
    assert.match(editorSource, /import\("\.\/quotation-pdf"\)/);
    assert.match(pdfSource, /`\$\{documentNumber\}\.pdf`/);
    assert.match(editorSource, /กำลังสร้าง PDF/);
    assert.match(editorSource, /บันทึกการเปลี่ยนแปลงก่อน/);
  });

  it("converts browser images before handing them to the PDF renderer", () => {
    assert.match(pdfSource, /fetch\(source\)/);
    assert.match(pdfSource, /canvas\.toDataURL\("image\/png"\)/);
    assert.match(pdfSource, /object-contain|objectFit:\s*"contain"/);
  });
});
```

Extend UI tests to require the Download button to use the saved-clean gate and
to be disabled while `isDownloading`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because the PDF module does not exist and Download is disabled
unconditionally.

- [ ] **Step 3: Add the approved local Thai fonts and license**

Create `public/fonts/`, then download these official Noto font files and the
SIL OFL license:

```powershell
curl.exe --ssl-no-revoke -L "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf" -o "public/fonts/NotoSansThai-Regular.ttf"
curl.exe --ssl-no-revoke -L "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-SemiBold.ttf" -o "public/fonts/NotoSansThai-SemiBold.ttf"
curl.exe --ssl-no-revoke -L "https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE" -o "public/fonts/OFL.txt"
```

Verify both TTF files are non-empty binary fonts and the license contains
`SIL OPEN FONT LICENSE Version 1.1` before staging them. Do not fetch fonts at
PDF runtime.

- [ ] **Step 4: Build the lazy PDF module**

Create `quotation-pdf.tsx` and register one family:

```ts
Font.register({
  family: "Noto Sans Thai",
  fonts: [
    { fontWeight: 400, src: "/fonts/NotoSansThai-Regular.ttf" },
    { fontWeight: 600, src: "/fonts/NotoSansThai-SemiBold.ttf" },
  ],
});

Font.registerHyphenationCallback((word) =>
  word.length > 24 ? (word.match(/.{1,12}/gu) ?? [word]) : [word]
);
```

Export `collectQuotationPdfImageSources(model)`. It returns unique non-empty
seller logo, bank/custom logos, uploaded payment QR, generated PromptPay QR,
issuer signature, approver signature, stamp, and Public QR sources.

Export `resolveQuotationPdfImages`. For every source, `fetch` it, load the Blob
through an object URL into an `Image`, draw it to Canvas without changing its
aspect ratio, return `canvas.toDataURL("image/png")`, revoke the object URL, and
skip only the failed optional image. This conversion is required because the
HTML document currently includes WebP and SVG sources that React PDF cannot
reliably embed directly.

- [ ] **Step 5: Compose the A4 React PDF document**

Implement one `<Document>` with wrapping A4 `<Page>` elements, 10 mm-equivalent
padding, the registered Thai font, and the same order as the shared HTML
document:

1. seller/document header;
2. customer;
3. item ledger;
4. totals;
5. ordered payment methods;
6. public notes;
7. Public QR;
8. three certification slots.

Use the Task 6 view model for every displayed value. Numeric cells use
`textAlign: "right"`; images use `objectFit: "contain"`; item descriptions use
a lighter gray than names; payment entries and the final QR/certification block
use `wrap={false}` when they fit as a unit. Do not add a fixed trailing Page.

- [ ] **Step 6: Export a minimal browser download function**

Add:

```ts
export async function downloadQuotationPdf({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string;
  payload: QuotationPayload;
  publicQrDataUrl: string;
}): Promise<void> {
  const model = buildQuotationDocumentViewModel({ calculation, documentNumber, payload, publicQrDataUrl });
  const images = await resolveQuotationPdfImages(collectQuotationPdfImageSources(model));
  const blob = await pdf(<QuotationPdfDocument images={images} model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentNumber}.pdf`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 7: Enable the saved-clean Download action**

In the editor add `isDownloading`. The handler must return unless
`canUseSavedDocument`, `lastSavedPayload`, `savedCalculation`, and
`documentNumber` exist. Generate the Public QR if the effect has not completed,
then lazy import:

```ts
const { downloadQuotationPdf } = await import("./quotation-pdf");
```

Await it inside `try/catch/finally`, show **กำลังสร้าง PDF…**, prevent repeated
activation, show a retryable Thai toast on failure, and never mutate quotation
state. Replace the permanently disabled Download button with this handler.

- [ ] **Step 8: Run focused tests, typecheck, and create one real PDF**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-ui.test.ts tests/quotation-public-qr.test.ts
npm.cmd run typecheck
```

Then download a saved quotation containing Thai, one unbroken English token,
multiple items, payment logos/QR, signatures, stamp, and Public QR. Render the
PDF pages to PNG with the PDF skill/Poppler and confirm no clipped text,
missing Thai glyphs, stretched images, or empty trailing page. Scan the QR and
confirm it opens the same saved Public token.

- [ ] **Step 9: Commit Task 7**

```powershell
git add -- package.json package-lock.json public/fonts/NotoSansThai-Regular.ttf public/fonts/NotoSansThai-SemiBold.ttf public/fonts/OFL.txt components/admin/quotations/quotation-pdf.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-pdf.test.ts tests/quotation-ui.test.ts
git commit -m "feat: add quotation PDF download"
```

---

### Task 8: Documentation, Full Verification, And Review Handoff

**Files:**
- Modify: `docs/quotation-management.md`
- Modify only if behavior changed during implementation: `docs/superpowers/specs/2026-07-20-quotation-pdf-public-qr-certification-design.md`

**Interfaces:**
- Produces: documented master, snapshot, tab, Public QR, PDF, and deferred-scope behavior.
- Produces: one clean verification record for code review.

- [ ] **Step 1: Update feature documentation**

Add concise sections to `docs/quotation-management.md` covering:

- **ข้อมูลรับรองหลัก** is account-owned and optional;
- new quotations copy issuer/approver/stamp into a per-document snapshot;
- receiver remains blank for manual signing;
- payment and certification overrides live in tabs below notes;
- Preview is current local state, while Share/PDF require a saved-clean document;
- Public QR is a bearer-style read-only link and soft delete disables it;
- PDF uses bundled Noto Sans Thai and the latest saved snapshot;
- link expiry, passwords, token rotation, e-signing, approval, and asset garbage
  collection remain outside this MVP.

- [ ] **Step 2: Run the complete automated suite**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

Expected: all commands PASS. If the environment-gated local database test was
not run in Task 2, run it now with the configured local Supabase environment
and record the result separately.

- [ ] **Step 3: Run final browser and document checks**

Verify:

- settings navigation and local previews at mobile and desktop widths;
- new quotation copies the master once;
- saved quotation overrides do not modify the master;
- payment/certification tabs preserve unsaved state;
- Share/Download disabled for new and dirty documents;
- Preview shows current edits and hides QR when unsaved/dirty;
- Public shows the latest save without login or internal notes;
- soft-deleted Public token returns 404;
- Print and PDF show Thai, comma-formatted money, payments, notes, QR, stamp,
  three signing slots, stable page breaks, and no empty trailing page.

- [ ] **Step 4: Inspect scope and working tree**

Run:

```powershell
git status --short
git diff --check
git log --oneline -8
```

Expected: no unexpected files, no whitespace errors, and one focused commit per
task. Preserve unrelated user changes.

- [ ] **Step 5: Commit documentation**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: document quotation PDF and certification"
```

- [ ] **Step 6: Request two-stage review before integration**

Use `superpowers:requesting-code-review` to review specification compliance
first and implementation quality second. Resolve findings with
`superpowers:receiving-code-review`, rerun the smallest affected check, then
rerun `npm.cmd run verify` before claiming completion or merging.
