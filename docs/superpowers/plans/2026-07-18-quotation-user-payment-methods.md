# Quotation User Ownership And Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each authenticated quotation user an isolated seller profile and reusable payment methods, snapshot selected methods into saved quotations, and render them consistently in Edit, Preview, Print, and Public Read-only.

**Architecture:** Keep the existing quotation calculator, save RPC, media Worker, and shared `QuotationDocument`. Add account ownership and normalized payment master/snapshot tables, wrap the current quotation save RPC so payment snapshots are replaced in the same transaction, and reuse one payment-method editor in seller settings and quotation editing. Uploaded payment images are normalized to PNG; automatic PromptPay QR is derived from the saved identifier and `amount_due` at render time.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind/ShadcnUI, Supabase PostgreSQL/Auth/RLS, existing Cloudflare media Worker/R2, existing `@dnd-kit/react`, and `thai-qr-payment` after explicit dependency approval.

## Global Constraints

- Migration `20260718090000_quotation_user_payment_methods.sql` was explicitly
  approved for amendment before merge. Preserve quotation data, numbering,
  counters, and seller data; do not remove unrelated tables or columns.
- Keep `private.has_quotation_permission()` checks as well as account ownership checks.
- A user may access only their own seller profile, payment masters, and quotations.
- Public Read-only remains token-based, server-loaded, read-only, and excludes internal notes.
- A quotation may have zero payment methods.
- Preview, Print, and Public Read-only use only the latest successfully saved payload.
- Seller logos remain WebP. Uploaded QR and custom-bank logos normalize to PNG. Reject user-uploaded SVG.
- Built-in bank logos are local trusted assets, not third-party runtime URLs.
- Account numbers and PromptPay identifiers appear in full in Preview, Print, and Public Read-only.
- Automatic PromptPay QR includes the saved quotation `amount_due`.
- Do not add payment status, gateway APIs, webhooks, checkout, reconciliation, asset cleanup jobs, or a second document renderer.
- Do not install dependencies without explicit user approval. Before Task 7, ask the user to run or authorize `npm install thai-qr-payment`.

---

## File Map

**Create**

- `lib/quotation-payment-methods.ts` — shared payment types, empty rows, order normalization, and client-safe helpers.
- `server/services/quotation-payment-methods.ts` — authoritative type-specific payment validation.
- `components/admin/quotations/payment-method-list.tsx` — reusable responsive payment rows, conditional fields, defaults, and drag ordering.
- `components/admin/quotations/payment-image-input.tsx` — Canvas PNG normalization and upload control.
- `public/quotation/banks/README.md` — bank-logo source/provenance and update policy.
- `public/quotation/banks/bbl.svg`, `kbank.svg`, `ktb.svg`, `ttb.svg`, `scb.svg`, `cimbt.svg`, `uobt.svg`, `bay.svg`, `gsb.svg`, `ghb.svg`, `baac.svg`, `ibank.svg`, `tisco.svg`, `kkp.svg`, `tcrb.svg`, `lh.svg`, and `generic-bank.svg` — trusted built-in bank logos.
- `supabase/migrations/20260718090000_quotation_user_payment_methods.sql` — data-preserving ownership backfill, bank metadata, payment tables, RLS, and RPC updates.
- `tests/quotation-payment-methods.test.ts` — domain validation and ordering.
- `tests/quotation-payment-assets.test.ts` — PNG key, file, upload, and Worker checks.

**Modify**

- `lib/quotation-types.ts` — add ordered payment methods to `QuotationPayload`.
- `lib/quotation-assets.ts` — support a restricted PNG payment-asset prefix alongside existing WebP seller assets.
- `server/storage/quotation-assets.ts` — accept an explicit validated content type.
- `workers/media/src/index.ts` — admit UUID PNG keys only under the payment prefix.
- `server/services/quotations.ts` — validate payment methods and include them in the RPC payload.
- `server/repositories/quotations.ts` — account seller lookup, bank/master queries, snapshot hydration, and wrapped save RPC.
- `app/admin/quotations/actions.ts` — account-owned seller save, master save, payment PNG upload, and trusted asset validation.
- `app/admin/quotations/settings/company/page.tsx` — load bank/master data and render payment settings.
- `components/admin/quotations/company-profile-form.tsx` — compose seller form with payment settings without changing seller WebP behavior.
- `app/admin/quotations/new/page.tsx` — load default masters and bank options.
- `app/admin/quotations/[id]/page.tsx` — load bank options with saved snapshots.
- `components/admin/quotations/quotation-editor.tsx` — add `04 ช่องทางชำระเงิน`, saved-only preview, and snapshot editing.
- `components/admin/quotations/quotation-document.tsx` — render ordered saved payment methods and automatic PromptPay QR.
- `tests/quotation-service.test.ts` — quotation payload integration.
- `tests/quotation-repository-actions.test.ts` — repository/action contracts and ownership.
- `tests/quotation-migration.test.ts` — migration structure, RLS, and RPC source assertions.
- `tests/quotation-database-integration.test.ts` — two-user isolation and snapshot persistence.
- `tests/quotation-ui.test.ts` — settings/editor/document structure and saved-only behavior.
- `tests/quotation-public-share.test.ts` — public payment snapshot exposure and internal-field exclusion.
- `docs/quotation-management.md` — payment-method behavior, ownership, QR, and testing checklist.

---

### Task 1: Payment Domain Types And Validation

**Files:**
- Create: `lib/quotation-payment-methods.ts`
- Create: `server/services/quotation-payment-methods.ts`
- Create: `tests/quotation-payment-methods.test.ts`
- Modify: `lib/quotation-types.ts`
- Modify: `server/services/quotations.ts`
- Modify: `tests/quotation-service.test.ts`

**Interfaces:**
- Produces: `PaymentMethodType`, `PaymentQrMode`, `QuotationPaymentMethod`, `CompanyPaymentMethod`, `emptyPaymentMethod()`, `normalizePaymentPositions()`, `preparePaymentMethods()`, and `prepareCompanyPaymentMethods()`.
- Consumes: existing `QuotationValidationError` and `QuotationPayload` conventions.

- [ ] **Step 1: Write failing domain tests**

Add tests that cover an empty list, consecutive positions, each required-field rule, PromptPay normalization, invalid SVG-style asset URLs, duplicate IDs, and the maximum method count:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizePaymentPositions } from "../lib/quotation-payment-methods.ts";
import { preparePaymentMethods } from "../server/services/quotation-payment-methods.ts";

const bank = {
  accountName: "Pool Villa Pattaya",
  accountNumber: "137-1-17528-4",
  bankCode: "004",
  bankId: "123e4567-e89b-42d3-a456-426614174000",
  bankLogoUrl: "/quotation/banks/kbank.svg",
  bankName: "ธนาคารกสิกรไทย",
  customBankLogoUrl: "",
  customBankName: "",
  id: "123e4567-e89b-42d3-a456-426614174001",
  instructions: "",
  position: 9,
  promptPayId: "",
  providerName: "",
  qrImageUrl: "",
  qrMode: "none" as const,
  type: "bank_transfer" as const,
};

describe("quotation payment methods", () => {
  it("allows no payment method and normalizes positions", () => {
    assert.deepEqual(preparePaymentMethods([]), []);
    assert.deepEqual(normalizePaymentPositions([bank, { ...bank, id: crypto.randomUUID() }]).map((row) => row.position), [1, 2]);
  });

  it("normalizes PromptPay digits", () => {
    const [method] = preparePaymentMethods([{ ...bank, accountNumber: "", bankId: null, bankCode: "", bankLogoUrl: "", bankName: "", promptPayId: "081-234-5678", qrMode: "auto_promptpay", type: "promptpay" }]);
    assert.equal(method?.promptPayId, "0812345678");
  });

  it("rejects missing type-specific data", () => {
    assert.throws(() => preparePaymentMethods([{ ...bank, accountName: "" }]), /Payment validation failed/);
    assert.throws(() => preparePaymentMethods([{ ...bank, promptPayId: "123", type: "promptpay" }]), /Payment validation failed/);
    assert.throws(() => preparePaymentMethods([{ ...bank, providerName: "", type: "qr_payment" }]), /Payment validation failed/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-payment-methods.test.ts`

Expected: FAIL because `quotation-payment-methods.ts` and `preparePaymentMethods()` do not exist.

- [ ] **Step 3: Add the shared types and minimal helpers**

Implement these exact public shapes in `lib/quotation-payment-methods.ts`:

```ts
export type PaymentMethodType = "bank_transfer" | "promptpay" | "qr_payment" | "cash" | "other";
export type PaymentQrMode = "none" | "upload" | "auto_promptpay";

export interface QuotationPaymentMethod {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankId: string | null;
  bankLogoUrl: string;
  bankName: string;
  customBankLogoUrl: string;
  customBankName: string;
  id: string;
  instructions: string;
  position: number;
  promptPayId: string;
  providerName: string;
  qrImageUrl: string;
  qrMode: PaymentQrMode;
  type: PaymentMethodType;
}

export interface CompanyPaymentMethod extends QuotationPaymentMethod {
  isDefault: boolean;
}

export interface BankOption {
  code: string;
  id: string;
  logoUrl: string;
  name: string;
}

export function normalizePaymentPositions<T extends QuotationPaymentMethod>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function emptyPaymentMethod(type: PaymentMethodType = "bank_transfer"): QuotationPaymentMethod {
  return { accountName: "", accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", id: crypto.randomUUID(), instructions: "", position: 1, promptPayId: "", providerName: "", qrImageUrl: "", qrMode: "none", type };
}
```

Add `paymentMethods: QuotationPaymentMethod[]` to `QuotationPayload`, initialize it to `[]` in `emptyQuotationPayload()`, and add it to repository fixtures as compilation identifies them.

- [ ] **Step 4: Implement authoritative payment validation**

In `server/services/quotation-payment-methods.ts`, validate at most 20 methods, UUID IDs, unique IDs, supported enums, maximum text lengths, and type requirements. Normalize PromptPay with `value.replace(/\D/g, "")`; accept exactly 10 or 13 digits. Require `qrImageUrl` for `qr_payment` and for `qrMode === "upload"`. Require `qrMode === "auto_promptpay"` only for PromptPay. Return `normalizePaymentPositions(validated)` or throw `QuotationValidationError` with keys such as `paymentMethods.0.accountNumber`. `prepareCompanyPaymentMethods()` applies the same rules and preserves only a boolean `isDefault` from each master row.

Integrate with `prepareQuotationPayload()`:

```ts
const paymentMethods = preparePaymentMethods(source.paymentMethods);
const payload: QuotationPayload = {
  customer,
  id,
  internalNotes: bounded(stringValue(source, "internalNotes"), 5_000, "internalNotes", errors),
  issueDate,
  items,
  paymentMethods,
  publicNotes: bounded(stringValue(source, "publicNotes"), 5_000, "publicNotes", errors),
  reference: bounded(stringValue(source, "reference"), 200, "reference", errors),
  seller,
  subject: bounded(stringValue(source, "subject"), 200, "subject", errors),
  validUntil,
  validityDays,
  withholdingTaxRate,
};
```

Add `payment_methods` to `PreparedQuotation["rpcPayload"]` using snake_case fields and consecutive `position` values.

- [ ] **Step 5: Run domain and quotation service tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-payment-methods.test.ts tests/quotation-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add lib/quotation-payment-methods.ts lib/quotation-types.ts server/services/quotation-payment-methods.ts server/services/quotations.ts tests/quotation-payment-methods.test.ts tests/quotation-service.test.ts
git commit -m "feat: validate quotation payment methods"
```

---

### Task 2: Account Ownership, Bank Catalogue, Payment Tables, RLS, And Atomic Save

**Files:**
- Create: `supabase/migrations/20260718090000_quotation_user_payment_methods.sql`
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Consumes: `PreparedQuotation.rpcPayload.payment_methods` from Task 1.
- Produces: account-owned seller/payment tables, `save_quotation_with_payments(jsonb)`, owner-filtered list/delete behavior, and public ordered payment JSON.

- [ ] **Step 1: Write failing migration source tests**

Assert that the migration preserves existing data and contains the ownership
backfill and schema boundaries:

```ts
assert.doesNotMatch(sql, /truncate\s+table/i);
assert.match(sql, /quotation owner has no matching auth user/i);
assert.match(sql, /select distinct q\.created_by[\s\S]*from public\.quotations q/i);
assert.match(sql, /update public\.quotations q[\s\S]*profile\.user_id = q\.created_by/i);
assert.match(sql, /create table public\.quotation_company_payment_methods/i);
assert.match(sql, /create table public\.quotation_payment_methods/i);
assert.match(sql, /add column company_profile_id uuid references public\.quotation_company_profiles/i);
assert.match(sql, /alter column company_profile_id set not null/i);
assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
assert.match(sql, /private\.has_quotation_permission\(\)/i);
assert.match(sql, /save_quotation_with_payments/i);
assert.match(sql, /quotation_payment_methods[\s\S]*order by p\.position/i);
```

Add an integration case with user A and user B proving that each user sees only their own seller, masters, and quotation; user B cannot update or soft-delete user A's quotation; public token lookup returns ordered payment snapshots without `internal_notes`.

- [ ] **Step 2: Run migration tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts`

Expected: FAIL because the migration and ownership policies do not exist.

- [ ] **Step 3: Create the data-preserving ownership migration**

Validate that every existing quotation creator exists in Supabase Auth before
changing the schema. Convert the singleton profile ID to UUID, add `user_id`
as nullable, clone the legacy profile for each distinct `quotations.created_by`
(using the latest `seller_snapshot` only as a fallback for empty profile
fields), then enforce the Auth foreign key, uniqueness, and non-null ownership.
If a legacy profile exists without quotations, assign it only when exactly one
quotation-enabled Auth user can be identified; otherwise fail explicitly.

Add `company_profile_id` as nullable, backfill it by joining profile `user_id`
to quotation `created_by`, validate that no row remains unlinked, then set the
column non-null and add the current-user profile function as its default.
Existing quotation items, document numbers, and
`private.quotation_number_counters` remain unchanged.

- [ ] **Step 4: Extend the bank catalogue and seed supported choices**

Add nullable unique `code` and non-null `logo_path default ''` to `public.banks`. Upsert these codes and local paths without deleting existing bank rows: `002 BBL`, `004 KBANK`, `006 KTB`, `011 TTB`, `014 SCB`, `022 CIMBT`, `024 UOBT`, `025 BAY`, `030 GSB`, `033 GHB`, `034 BAAC`, `066 IBANK`, `067 TISCO`, `069 KKP`, `071 TCRB`, `073 LH`, and `OTHER`. Use the current Bank of Thailand FI code list as the naming/code reference: https://www.bot.or.th/en/statistics/financial-institutions/summary-statement-of-assets-and-liabilities.html

Use one deterministic statement per bank:

```sql
insert into public.banks (name, code, logo_path, sort_order)
values ('ธนาคารกสิกรไทย', '004', '/quotation/banks/kbank.svg', 20)
on conflict (name) do update
set code = excluded.code,
    logo_path = excluded.logo_path,
    sort_order = excluded.sort_order;
```

Repeat that exact shape for the approved code list so existing UUID references in `agent_accounts` remain valid.

- [ ] **Step 5: Create payment master and snapshot tables**

Use the shared field names from Task 1. Master rows include `user_id`, `is_default`, and timestamps. Snapshot rows include `quotation_id on delete cascade` and copied bank name/code/logo fields. Add checks for supported type/QR enums, non-negative position, and unique `(user_id, position)` / `(quotation_id, position)` constraints. Keep type-specific business validation in the server service and RPC rather than duplicating a large SQL condition tree.

Create `private.save_quotation_company_payment_methods(p_methods jsonb)` and an authenticated public wrapper. The private function checks permission, validates an array of at most 20 rows, deletes only rows where `user_id = auth.uid()`, resolves built-in bank data from `public.banks`, inserts consecutive positions, and returns the saved rows. This is the only master-list write path.

- [ ] **Step 6: Replace broad policies with permission-plus-owner policies**

Drop the existing broad quotation policies by their current names, then create policies whose `using` and `with check` expressions combine `private.has_quotation_permission()` with `user_id = (select auth.uid())` or `created_by = (select auth.uid())`. Snapshot policies must use `exists (select 1 from public.quotations q where q.id = quotation_id and q.created_by = auth.uid() and q.deleted_at is null)`.

Update `list_quotations` and `soft_delete_quotation` so their SQL also filters `created_by = auth.uid()`. Do not rely only on callers or RLS inside security-definer functions.

- [ ] **Step 7: Add the atomic wrapper RPC and public payment JSON**

Create `private.save_quotation_with_payments(p_payload jsonb)` as a PL/pgSQL security-definer function. It must:

1. verify quotation permission;
2. select the caller's seller profile and reject a mismatched `company_profile_id`;
3. call the existing `private.save_quotation(p_payload)`;
4. verify the defaulted `quotations.company_profile_id` belongs to `auth.uid()` and update it only where `created_by = auth.uid()` if the submitted owned profile differs;
5. delete old snapshot rows for that owned quotation;
6. resolve built-in bank name/code/logo from `public.banks` and insert ordered snapshots from `payment_methods`;
7. return the saved ID/document number.

Expose it through the same authenticated public wrapper/grant pattern used by the current `save_quotation`. Replace `private.get_public_quotation()` so its JSON includes:

```sql
'quotation_payment_methods', coalesce((
  select jsonb_agg(to_jsonb(p) order by p.position)
  from public.quotation_payment_methods p
  where p.quotation_id = q.id
), '[]'::jsonb)
```

Keep `internal_notes` absent.

- [ ] **Step 8: Run migration and database tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts`

Expected: PASS. If the local Supabase integration environment is unavailable, the source tests must pass and the integration skip reason must be recorded before handoff.

- [ ] **Step 9: Commit Task 2**

```bash
git add supabase/migrations tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "feat: isolate quotation payment data by user"
```

---

### Task 3: PNG Payment Asset Pipeline

**Files:**
- Modify: `lib/quotation-assets.ts`
- Modify: `server/storage/quotation-assets.ts`
- Modify: `workers/media/src/index.ts`
- Create: `components/admin/quotations/payment-image-input.tsx`
- Create: `tests/quotation-payment-assets.test.ts`
- Modify: `tests/quotation-assets.test.ts`
- Modify: `tests/media-worker.test.ts`

**Interfaces:**
- Produces: `buildQuotationPaymentAssetObjectKey()`, `validateQuotationPaymentAssetFile()`, `normalizePaymentImageToPng()`, and content-type-aware upload.
- Preserves: existing seller WebP asset behavior and URLs.

- [ ] **Step 1: Write failing PNG asset tests**

Test the key `quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png`, 2 MB source limit, PNG/JPEG/WebP input, SVG rejection, Worker PUT acceptance only for `image/png`, and preservation of the old WebP seller path.

- [ ] **Step 2: Run asset tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-assets.test.ts tests/quotation-payment-assets.test.ts tests/media-worker.test.ts`

Expected: FAIL because the PNG payment path is not supported.

- [ ] **Step 3: Add narrow PNG key and file validation**

Keep the current WebP helpers unchanged and add a second exact prefix/regex:

```ts
const QUOTATION_PAYMENT_ASSET_PREFIX = "quotations/payment-assets/";
const PAYMENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;
const PAYMENT_MAX_BYTES = 2 * 1024 * 1024;

export function buildQuotationPaymentAssetObjectKey(randomUUID: () => string = crypto.randomUUID): string {
  return `${QUOTATION_PAYMENT_ASSET_PREFIX}${randomUUID()}.png`;
}

export function validateQuotationPaymentAssetFile(file: File): File {
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) throw new Error("รูปต้องเป็น PNG, JPEG หรือ WebP");
  if (file.size === 0) throw new Error("ไฟล์รูปว่างเปล่า");
  if (file.size > PAYMENT_MAX_BYTES) throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 2 MB");
  return file;
}
```

Add a matching object-key and trusted media URL validator for this prefix.

- [ ] **Step 4: Make storage upload content-type explicit**

Change `uploadQuotationAssetObject()` to require `contentType: "image/png" | "image/webp"` and send that value. Update the seller action to pass `image/webp`. Admit `quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png`-shaped UUID keys in the Worker only when PUT has `content-type: image/png`.

- [ ] **Step 5: Implement browser PNG normalization**

In `payment-image-input.tsx`, validate before decoding, use `createImageBitmap`, draw to Canvas without upscaling, and call `canvas.toBlob(callback, "image/png")`. Return a `File` named `quotation-payment.png`. Revoke preview object URLs on replacement/unmount and expose loading/error text accessibly.

- [ ] **Step 6: Run asset tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-assets.test.ts tests/quotation-payment-assets.test.ts tests/media-worker.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/quotation-assets.ts server/storage/quotation-assets.ts workers/media/src/index.ts components/admin/quotations/payment-image-input.tsx tests/quotation-assets.test.ts tests/quotation-payment-assets.test.ts tests/media-worker.test.ts
git commit -m "feat: add quotation payment image assets"
```

---

### Task 4: Account-Owned Repositories And Server Actions

**Files:**
- Modify: `server/repositories/quotations.ts`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `tests/quotation-repository-actions.test.ts`

**Interfaces:**
- Consumes: schema/RPC from Task 2, validation from Task 1, asset functions from Task 3.
- Produces: `listQuotationBanks()`, `listCompanyPaymentMethods()`, `saveCompanyPaymentMethods()`, `uploadQuotationPaymentAssetAction()`, and account-scoped seller CRUD.

- [ ] **Step 1: Write failing repository/action tests**

Cover seller lookup by `user_id` rather than `id = 1`, master list ordered by position, whole-list replacement through one RPC/action, wrapped quotation save RPC name, PNG upload content type, and action permission checks before all writes.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts`

Expected: FAIL on singleton lookup and missing payment functions.

- [ ] **Step 3: Make seller access account-scoped**

Change `QuotationCompanyProfileRow.id` to `string`, include `user_id`, query `.eq("user_id", userId)`, and upsert with the authenticated user's ID. Obtain the trusted auth ID from the server session returned by `requireAdmin()`; never accept it from FormData or client JSON.

- [ ] **Step 4: Add bank and master repository functions**

`listQuotationBanks()` selects `id,code,name,logo_path,sort_order`, filters non-null codes, orders by `sort_order,name`, and maps to `BankOption`. `listCompanyPaymentMethods()` filters `user_id`, orders by `position`, and returns `CompanyPaymentMethod[]`.

Save the entire ordered master list through one security-definer RPC that validates ownership, deletes the caller's prior rows, and inserts the submitted list. This gives hard-delete semantics and atomic ordering without multiple client writes.

- [ ] **Step 5: Add payment asset and master actions**

`uploadQuotationPaymentAssetAction(formData)` must require quotation permission, accept only a normalized `image/png` file no larger than 2 MB, upload it with a random payment key and `contentType: "image/png"`, and return the trusted URL. `saveCompanyPaymentMethodsAction(value)` runs `prepareCompanyPaymentMethods()`, validates every media URL against the trusted Worker, then saves the caller-owned list.

- [ ] **Step 6: Use the wrapped save and hydrate payment snapshots**

Change repository save to call `save_quotation_with_payments`. Extend `quotationSelect`, `DatabaseQuotationRow`, and `quotationRowToPayload()` with ordered `quotation_payment_methods`. Public hydration uses the same mapper with `internal_notes: ""`. Extend the successful `saveQuotationAction()` result with `payload: prepared.payload` so the editor's saved snapshot uses server-normalized PromptPay IDs and positions.

- [ ] **Step 7: Run repository/action tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add server/repositories/quotations.ts app/admin/quotations/actions.ts tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts
git commit -m "feat: persist user quotation payment methods"
```

---

### Task 5: Seller Settings Payment Method UI

**Files:**
- Create: `components/admin/quotations/payment-method-list.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Modify: `app/admin/quotations/settings/company/page.tsx`
- Create: `public/quotation/banks/README.md`
- Create: `public/quotation/banks/bbl.svg`, `kbank.svg`, `ktb.svg`, `ttb.svg`, `scb.svg`, `cimbt.svg`, `uobt.svg`, `bay.svg`, `gsb.svg`, `ghb.svg`, `baac.svg`, `ibank.svg`, `tisco.svg`, `kkp.svg`, `tcrb.svg`, `lh.svg`, `generic-bank.svg`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `BankOption[]`, `CompanyPaymentMethod[]`, server actions, and `PaymentImageInput`.
- Produces: reusable `PaymentMethodList` for master and quotation modes.

- [ ] **Step 1: Add failing UI source tests**

Assert that the settings page loads seller, banks, and payment methods together; the list supports all five types, `isDefault`, built-in bank selection, `OTHER`, optional custom logo, conditional QR fields, add/remove, and existing DnD primitives. Assert there are no up/down arrow buttons.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`

Expected: FAIL because payment settings are absent.

- [ ] **Step 3: Add trusted local bank assets and catalogue documentation**

Add one compact SVG per seeded built-in bank under `public/quotation/banks/`, named by lowercase code, and `generic-bank.svg` for `OTHER`. `README.md` records each source URL/date and states that trademarks remain owned by their banks. Do not hotlink remote assets.

- [ ] **Step 4: Implement the reusable responsive list**

`PaymentMethodList` accepts:

```ts
interface PaymentMethodListProps<T extends QuotationPaymentMethod> {
  banks: BankOption[];
  errors: Record<string, string>;
  methods: T[];
  mode: "master" | "quotation";
  onChange: (methods: T[]) => void;
}
```

Use the existing `DragDropProvider`, `useSortable`, and `move()` pattern. Render compact conditional fields, not a generic all-fields form. Only master mode shows “เลือกอัตโนมัติในใบใหม่”. Selecting a built-in bank copies catalogue display data; selecting `OTHER` reveals custom name and optional PNG logo upload.

- [ ] **Step 5: Compose settings page and preserve seller WebP flow**

Load seller, banks, and masters with `Promise.all`. Pass them to `CompanyProfileForm`, render the payment section below the unchanged seller fields, and save payment masters separately so a payment validation error cannot overwrite the saved seller form. Keep the existing logo normalization and `saveCompanyProfileAction()` behavior unchanged.

- [ ] **Step 6: Verify responsive settings UI**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`

Then inspect `/admin/quotations/settings/company` at 390, 768, 1280, and 1536 pixel widths. Expected: no horizontal form overflow; bank, account, and QR controls stay compact; drag handles do not change neighboring control heights.

- [ ] **Step 7: Commit Task 5**

```bash
git add components/admin/quotations/payment-method-list.tsx components/admin/quotations/company-profile-form.tsx app/admin/quotations/settings/company/page.tsx public/quotation/banks tests/quotation-ui.test.ts
git commit -m "feat: manage quotation payment methods"
```

---

### Task 6: Quotation Payment Snapshot Editor

**Files:**
- Modify: `app/admin/quotations/new/page.tsx`
- Modify: `app/admin/quotations/[id]/page.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-repository-actions.test.ts`

**Interfaces:**
- Consumes: reusable payment list and account master/default data.
- Produces: ordered `payload.paymentMethods` saved with the quotation.

- [ ] **Step 1: Write failing new/edit editor tests**

Assert that a new quotation receives only `isDefault` masters copied as fresh snapshot IDs; edit receives saved snapshots; `04 ช่องทางชำระเงิน` follows `03 รายการ`; add/remove/reorder marks the editor dirty; quotation-only rows never call the master save action; and Preview is disabled until a successful save and then uses `lastSavedPayload`.

- [ ] **Step 2: Run focused UI/repository tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts`

Expected: FAIL because editor payment props and section do not exist.

- [ ] **Step 3: Load defaults and bank choices for new quotations**

In the new page, load seller, banks, and masters concurrently. Copy default masters into `emptyQuotationPayload(companyProfileToSeller(profile), new Date()).paymentMethods`, assigning new UUIDs and consecutive positions so the quotation snapshot never reuses a master primary key.

- [ ] **Step 4: Load bank choices for edits**

In the edit page, load `getQuotationById()` and `listQuotationBanks()` concurrently after auth. Use the payment snapshots already hydrated in `quotation.payload`; do not merge current master values into an existing quotation.

- [ ] **Step 5: Add the editor section**

Extend `QuotationEditorProps` with `banks: BankOption[]`. Render:

```tsx
<section className="space-y-3 border-t border-foreground/35 pt-2" data-payment-methods>
  <div className="flex items-center justify-between gap-3">
    <h2 className="text-sm font-semibold">04 ช่องทางชำระเงิน</h2>
    <Button onClick={addPaymentMethod} size="sm" type="button" variant="outline">เพิ่มช่องทาง</Button>
  </div>
  <PaymentMethodList
    banks={banks}
    errors={fieldErrors}
    methods={payload.paymentMethods}
    mode="quotation"
    onChange={(paymentMethods) => updateRoot("paymentMethods", paymentMethods)}
  />
</section>
```

Place it after the item section and before notes/totals. Keep it full-width responsive.

- [ ] **Step 6: Enforce saved-only Preview and Print payloads**

Use `lastSavedPayload` and `savedCalculation` for Preview as Print already does. Disable Preview/Share/Print when there is no saved quotation or while saving. After save success, set `lastSavedPayload` from `result.payload` and clear dirty state. Public already reads the database.

- [ ] **Step 7: Run focused tests and manual save cycle**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts`

Manual expected behavior: defaults appear only on a new quotation; per-quotation edits survive reload; master data remains unchanged; a quotation with no methods saves successfully.

- [ ] **Step 8: Commit Task 6**

```bash
git add app/admin/quotations/new/page.tsx app/admin/quotations/[id]/page.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts
git commit -m "feat: edit quotation payment snapshots"
```

---

### Task 7: PromptPay QR, Shared Document Rendering, Public Verification, And Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `server/services/quotations.ts`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-public-share.test.ts`
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: saved ordered payment snapshots and saved `calculation.amountDue`.
- Produces: identical payment presentation in Preview, Print, and Public Read-only.

- [ ] **Step 1: Obtain dependency approval**

Ask the user to run or explicitly authorize:

```bash
npm install thai-qr-payment
```

Do not proceed with automatic QR implementation until `package.json` and `package-lock.json` contain the approved dependency. Official API reference: https://thai-qr-payment.js.org/install/ and https://thai-qr-payment.js.org/guide/payload/

- [ ] **Step 2: Write failing QR/document tests**

Add a known-payload test using `payloadFor({ recipient: "0812345678", amount: 50 })` and `parsePayload()` to assert valid CRC, recipient, currency `764`, and amount `50`. Add source/render tests proving the document iterates payment methods by position, shows full account/PromptPay text, renders uploaded images, calls automatic QR only for `auto_promptpay`, omits the section for an empty list, and never reads `internalNotes`.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-payment-methods.test.ts tests/quotation-ui.test.ts tests/quotation-public-share.test.ts`

Expected: FAIL because the document has no payment block or PromptPay QR.

- [ ] **Step 4: Render automatic PromptPay QR from saved values**

Use the library's `renderThaiQRPaymentMatrix()` SVG renderer, not a hand-written encoder. Generate from validated saved input and `Number(calculation.amountDue)`. In `prepareQuotationPayload()`, after calculation, reject an automatic PromptPay QR when `Number(calculation.amountDue) > 9_999_999_999.99`, the library's documented THB maximum. Catch rendering failures and show a compact “ไม่สามารถสร้าง QR ได้” fallback instead of breaking the document.

- [ ] **Step 5: Add the shared payment document block**

In `QuotationDocument`, render the block after the amount-due summary. For bank transfer show local/custom logo fallback, bank name, full account number, account name, and optional uploaded QR. For PromptPay show full identifier, account name, and uploaded/automatic QR. For QR Payment, cash, and other show only their relevant saved fields.

Use `break-inside-avoid`, `min-w-0`, `overflow-wrap:anywhere`, and fixed QR dimensions so long identifiers and multiple methods paginate without horizontal overflow. Because Preview, Print, and Public all use `QuotationDocument`, do not create another document component.

- [ ] **Step 6: Update public tests and feature documentation**

Document ownership, master/snapshot behavior, supported payment types, full public account display, trusted local bank logos, PNG rules, PromptPay amount binding, dependency, data-preserving ownership migration, and the real-bank scan checklist in `docs/quotation-management.md`.

- [ ] **Step 7: Run complete automated verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands exit 0. Existing unrelated warnings must be reported without being silently expanded into this scope.

- [ ] **Step 8: Run visual and payment verification**

Verify at 390, 768, 1280, and 1536 pixel widths. Save and compare one quotation containing a built-in bank, `OTHER` with and without a custom PNG logo, uploaded QR, automatic PromptPay QR, cash, and long text. Confirm Preview, Print Preview, and Public show the same saved order and values; no blank print page appears; A4 pagination does not split a payment row when space permits.

Scan the automatic PromptPay QR with a real Thai banking app and confirm recipient and amount before production use. Do not complete the task on a synthetic decode test alone.

- [ ] **Step 9: Commit Task 7**

```bash
git add package.json package-lock.json components/admin/quotations/quotation-document.tsx server/services/quotations.ts tests/quotation-payment-methods.test.ts tests/quotation-ui.test.ts tests/quotation-public-share.test.ts docs/quotation-management.md
git commit -m "feat: render quotation payment methods"
```

---

## Final Acceptance Checklist

- [ ] User A cannot read or mutate User B seller/payment/quotation data.
- [ ] Seller and payment masters are copied into snapshots and old quotations do not change after master edits/deletes.
- [ ] A quotation saves with zero, one, or multiple reordered payment methods.
- [ ] Built-in bank logos are local; `OTHER` name/logo is optional and never pollutes the bank catalogue.
- [ ] Seller logo stays WebP; uploaded payment images become validated PNG.
- [ ] Automatic PromptPay QR contains the saved amount due and passes a real bank-app scan.
- [ ] Preview, Print, and Public Read-only show the same latest saved payment data and full identifiers.
- [ ] Missing images degrade to text/generic icon without breaking A4 output.
- [ ] Typecheck, lint, full tests, and build pass.
- [ ] `docs/quotation-management.md` matches the implemented behavior.
