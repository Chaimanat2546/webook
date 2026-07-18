# Quotation User Ownership And Payment Methods Design

**Status:** Approved for implementation planning

## Goal

Add account-owned seller data and reusable payment methods to the quotation
MVP. A saved quotation keeps seller and payment snapshots, while Preview,
Print, and Public Read-only show the latest saved payment information in the
same visual order as the supplied quotation PDF.

## Scope

This change covers:

- one seller profile and a reusable payment-method list per authenticated
  account;
- quotations owned by the account that created them;
- multiple ordered payment methods on one quotation;
- bank transfer, PromptPay, QR Payment, cash, and other payment methods;
- a prepared Thai-bank list with automatic local logos and an "other bank"
  option;
- optional uploaded QR images and amount-bearing automatic PromptPay QR;
- seller and payment snapshots on each saved quotation;
- payment presentation in Edit, Preview, Print, and Public Read-only;
- RLS, validation, image normalization, and local-data migration.

Payment methods remain optional. This change does not add payment collection,
payment status, reconciliation, customer acceptance, approval workflow, or
automatic payment verification.

## Ownership And Access

- `quotation_company_profiles` changes from one global singleton to one row per
  `auth.users.id`.
- Payment-method masters are owned by the same authenticated account.
- A quotation records its seller profile and keeps the existing `created_by`
  and `updated_by` audit fields.
- Authenticated users may list, read, create, edit, and soft-delete only
  quotations whose `created_by = auth.uid()`.
- Seller and payment masters are visible only to their owning account.
- Payment snapshots are accessible to an authenticated user only through a
  quotation they own.
- Public Read-only remains an isolated server-side token lookup. It does not
  grant anonymous table access and never returns internal notes.
- Invalid tokens, missing quotations, and soft-deleted quotations return 404.

The existing application permission check remains required in addition to
row ownership. Ownership narrows access; it does not replace the current
quotation feature permission.

## Data Model

### Seller Profile

Replace the singleton constraint on `quotation_company_profiles` with:

- a UUID primary key;
- `user_id uuid not null unique references auth.users(id)`;
- the seller fields already used by the current quotation snapshot;
- existing timestamps and seller-logo asset reference.

`quotations` adds `company_profile_id`, referencing the seller profile used to
create the quotation. The saved `seller_snapshot` remains the document source
so later seller edits do not alter an old quotation.

### Bank Catalogue

Reuse the existing `public.banks` table instead of creating a second bank
master. Add the minimum catalogue metadata needed by quotations:

- a stable bank code;
- a local logo asset path;
- the existing name and sort order.

The migration seeds the supported Thai banks and an "other bank" choice. A
custom bank entered through that choice is stored only on the user's payment
method or quotation snapshot and is not inserted into `banks` automatically.
Existing `agent_accounts.bank_id` behavior must remain compatible.

Built-in bank logos are trusted assets shipped with the application. Public,
Preview, and Print do not depend on third-party logo URLs.

### Payment-Method Master

Create `quotation_company_payment_methods` with:

- `id` and `user_id`;
- `type`: `bank_transfer`, `promptpay`, `qr_payment`, `cash`, or `other`;
- optional `bank_id`, custom bank name, and custom bank logo asset;
- account number and account name;
- PromptPay identifier;
- provider or payment-method name;
- instructions;
- QR mode and uploaded QR asset reference;
- `is_default`, `sort_order`, and timestamps.

Nullable type-specific columns keep the model direct and queryable. Database
checks and server validation ensure that each type supplies only its required
fields.

### Quotation Payment Snapshot

Create `quotation_payment_methods` with:

- `id`, `quotation_id`, `type`, and `sort_order`;
- snapshotted bank code, bank name, and logo reference;
- snapshotted account number, account name, PromptPay identifier, provider
  name, and instructions;
- QR mode and uploaded QR asset reference.

The snapshot does not need a live foreign key back to its master. Editing or
deleting a master therefore cannot change an existing quotation. Deleting a
quotation deletes its payment snapshot rows with it.

## Migration

Create a new Supabase migration; do not edit previous migrations.

The approved local-data reset clears existing quotation rows, quotation item
rows, seller-profile rows, and dependent quotation data before replacing the
singleton seller schema. Each account re-enters its seller profile after the
migration. Document numbers already issued are not reused unless the existing
counter behavior explicitly resets as part of the local reset.

The migration also:

- adds the ownership constraints and indexes used by RLS;
- creates the master and snapshot payment tables;
- extends and seeds the existing bank catalogue without breaking its current
  foreign-key consumers;
- replaces broad quotation RLS policies with permission-plus-owner policies;
- updates quotation save/read/public RPC behavior to include ordered payment
  snapshots atomically.

No unrelated tables or columns are removed.

## Master Settings Flow

The existing seller-profile page gains a `ช่องทางชำระเงิน` section below the
seller form. A user can:

- add, edit, hard-delete, and drag to reorder payment methods;
- mark any method as selected by default for new quotations;
- select a Thai bank and receive its logo automatically;
- select "other bank", enter a bank name, and optionally upload its logo.

Deleting a master does not remove payment rows or assets already referenced by
saved quotation snapshots. Asset garbage collection is outside this MVP and
can be added only if orphaned storage becomes measurable.

## Quotation Editor Flow

Add a full-width `04 ช่องทางชำระเงิน` block after `03 รายการ`.

- A new quotation starts with the user's default methods selected.
- The user may add or remove selected methods, edit the per-quotation copy, and
  drag to reorder it.
- The user may add a quotation-only method. It is not written back to the
  master automatically.
- Saving writes the quotation and its ordered payment snapshots in the same
  database transaction.
- Editing a saved quotation loads its snapshots, not current master values.
- Preview, Print, and Public Read-only show only the latest successfully saved
  snapshot. Unsaved editor changes never leak into those views.
- A quotation may be saved with no payment methods.

## Payment Types And QR Behavior

### Bank Transfer

Requires bank, account number, and account name. An uploaded payment QR is
optional.

### PromptPay

Requires either a 10-digit Thai phone number or a 13-digit Thai national/tax
identifier and an account name. The user chooses either an uploaded QR or an
automatically generated PromptPay QR.

Automatic PromptPay QR includes the quotation's saved `amount_due`. It is
derived from the saved identifier and amount rather than persisted as another
image. When the quotation amount changes and is saved, Preview, Print, and
Public Read-only generate the updated QR.

Use `thai-qr-payment` for the PromptPay payload and QR rather than implementing
EMVCo/PromptPay encoding locally. Adding this dependency requires explicit
installation approval during implementation. A real Thai banking app must scan
a generated test QR successfully before production use.

### QR Payment

Requires a provider or payment-method name and an uploaded provider QR image.

### Cash And Other

Cash uses optional payment instructions. Other requires a display name and may
include instructions. Neither type generates a QR automatically.

## Image Handling

- The existing seller-logo flow remains WebP and is unchanged.
- User-uploaded QR accepts PNG, JPEG, or WebP, then Canvas-normalizes it to a
  lossless PNG before upload.
- A custom "other bank" logo accepts PNG, JPEG, or WebP and is normalized to
  PNG for document use and transparency.
- User-uploaded SVG is rejected.
- Built-in bank logos use trusted local source assets without user-upload
  normalization.
- Uploaded source files are limited to 2 MB, must be non-empty, and must pass
  both client and server type validation.
- Payment PNGs use random object keys in a quotation-payment-specific storage
  prefix and the existing trusted media Worker boundary.
- A missing image falls back to the bank or payment-method name; it does not
  prevent the document from rendering.

## Document Presentation

The shared `QuotationDocument` remains the only composition for Preview,
Print, and Public Read-only. Payment methods render after the amount-due
summary and before later certification content.

Each bank method follows the supplied PDF:

- bank logo and bank name;
- full account number with its saved punctuation, for example
  `137-1-17528-4`;
- account name on the following line;
- QR image when configured.

PromptPay and other methods use the same compact hierarchy with the relevant
identifier, display name, instructions, and QR. Methods follow saved
`sort_order`. A payment block avoids splitting internally when space permits
and moves to the next A4 page when necessary.

Account and PromptPay identifiers are intentionally shown in full in Edit,
Preview, Print, and Public Read-only, as approved for this payment document.

## Validation And Failure Handling

- Account numbers remain text so leading zeroes and separators survive.
- PromptPay input is normalized to digits before validating 10 or 13 digits.
- Type-specific required fields are checked at the server trust boundary.
- Payment order is normalized to consecutive non-negative integers on save.
- Seller, quotation, and payment writes reject ownership mismatches.
- Master and quotation saves are atomic; partial payment lists are not kept.
- PromptPay generation failure produces a visible error and never renders a
  known-bad QR.
- Upload failure leaves the previous saved asset and snapshot unchanged.
- Missing bank logos and payment images use a text/generic-icon fallback.
- Public responses expose only saved document fields and payment snapshots.

## Verification

Automated checks must cover:

- RLS isolation between two authenticated users;
- seller-profile ownership and quotation ownership;
- default-method selection for a new quotation;
- master-to-quotation snapshot copying and per-quotation edits;
- master deletion leaving saved snapshots readable;
- ordering, optional empty payment lists, and type-specific validation;
- PromptPay normalization and a known payload for the saved amount due;
- PNG normalization and rejection of empty, oversized, SVG, and invalid files;
- Public token lookup returning only saved payment data;
- consistent payment rendering in Preview, Print, and Public Read-only;
- A4 pagination with multiple payment methods and missing-image fallbacks.

Visual verification must compare the payment block with the supplied
`QO-2026070800002.pdf`, including a built-in Thai bank, an "other bank" with
and without a logo, multiple reordered methods, uploaded QR, automatic
PromptPay QR, and a quotation without payment methods.

## Implementation Boundary

Reuse the existing `banks` table, quotation save transaction/RPC, shared
`QuotationDocument`, quotation asset Worker, Canvas image pipeline, drag-order
pattern, and authentication permission checks. Add only the payment tables,
ownership constraints, fields, UI, and QR dependency required by this MVP.

Do not add a generic payment gateway abstraction, payment status model,
checkout flow, webhook, bank synchronization, asset cleanup job, or a second
document renderer.
