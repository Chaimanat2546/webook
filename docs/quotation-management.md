# Quotation Management

## Scope And Ownership

Authenticated admins with `allow_tools.allow_quotation = true` can manage
their own seller profile, reusable payment methods, and quotations. Every
seller profile, payment master, and quotation is linked to the current
Supabase Auth user. RLS combines that ownership check with the existing
quotation permission, so one account cannot read or change another account's
data.

The customer snapshot contains only name, address, tax ID, office type, and
branch number. This MVP does not include approval, customer acceptance,
payment collection or status, reconciliation, installments, or revision
history.

## Routes

- `/admin/quotations` - list, search, print, and soft-delete owned quotations
- `/admin/quotations/new` - create from the current user's seller and default payment masters
- `/admin/quotations/[id]` - edit saved seller and payment snapshots
- `/admin/quotations/settings/company` - manage the current user's seller profile and payment masters
- `/q/[token]` - no-login, token-scoped public view of the latest saved quotation

## Master And Snapshot Rules

- Each account has one seller profile and an ordered reusable payment list.
- New quotations copy default payment masters into editable quotation rows.
- Saving atomically stores seller, customer, item, and ordered payment
  snapshots. A quotation may have no payment methods.
- Editing a master never changes an existing quotation. Deleting a master
  leaves its saved quotation snapshots intact.
- Payment master and quotation snapshot tables are SELECT-only through the
  table API. Account-scoped master save and atomic quotation save RPCs are the
  only mutation paths; authenticated users have no table-level INSERT, UPDATE,
  DELETE, or TRUNCATE privilege.
- Edit reload matches a saved built-in bank code to the current catalogue only
  to restore its selector ID. It preserves the saved name/logo, and falls back
  to an other-bank snapshot if that catalogue entry no longer exists.
- Preview, Print, and Public Read-only share `QuotationDocument` and use only
  the latest successful save. Unsaved editor changes are not shared or
  printed.
- Public Read-only never exposes internal notes. It intentionally displays
  full saved bank-account and PromptPay identifiers.
- Public payment JSON contains only fields relevant to each saved payment type,
  including for legacy rows that may still contain hidden values.

## Payment Methods

Supported types are:

- Bank transfer: bank, account number, and account name; optional uploaded QR.
- PromptPay: 10-digit phone or 13-digit national/tax identifier and account
  name; either uploaded QR or automatic amount-bound QR.
- QR Payment: provider name and uploaded QR.
- Cash: optional instructions.
- Other: display name and optional instructions.

Built-in Thai banks use trusted local assets under `public/quotation/banks`.
Selecting `OTHER` keeps the custom name and optional logo only in the user's
master/snapshot; it does not alter the bank catalogue. Document rows follow
saved position and fall back to text when an image is unavailable.

Automatic PromptPay QR uses `thai-qr-payment` `^1.1.0`. It is derived at
render time from the saved PromptPay identifier and saved `amount_due`; it is
not stored as another image. The server accepts automatic QR only when amount
due is greater than zero and no more than THB 9,999,999,999.99; uploaded QR
methods may still be saved at zero. Legacy invalid automatic QR values show a
compact Thai fallback instead of generating an arbitrary-amount QR or breaking
Preview, Print, or Public Read-only.

## Editor And Calculation Rules

- Create/Edit uses the responsive Document Workbench; Preview/Print is A4.
- Reference is optional and subject is labelled `เรื่อง / ชื่องาน`.
- Currency copy is always `บาท`.
- Quantity is required and greater than zero; unit is optional.
- Per-item fixed discount and VAT controls are enabled from document settings.
- New quotations start with both optional item features off.
- Enabling VAT starts items at 7%; disabling it stores no VAT at 0%.
- Money inputs accept grouped or ungrouped values; stored values are canonical
  decimal strings without commas.
- Drag and drop order is persisted for items and payment methods.
- Internal notes are admin-only; public notes may appear in the document.

The server recalculates money before saving:

1. `gross total = sum(quantity x unit price)`
2. `discount total = sum(fixed item discounts)`
3. `pre-tax total = gross total - discount total`
4. `VAT total = sum(item pre-tax amount x item VAT rate)`
5. `grand total = pre-tax total + VAT total`
6. `withholding tax = pre-tax total x withholding percentage`
7. `amount due = grand total - withholding tax`

## Asset Rules

Seller logos keep the existing WebP flow. Payment QR and custom-bank-logo
uploads accept PNG, JPEG, or WebP up to 2 MB and normalize through Canvas to
PNG. Empty, invalid, oversized, and user-uploaded SVG files are rejected.

Payment assets must use the exact configured Media Worker HTTPS origin and
`/quotations/payment-assets/<uuid>.png`, without query or fragment. Configure
`private.quotation_payment_asset_config.origin` from
`ADVERTISEMENT_IMAGE_WORKER_URL`; only database owner/service role can change
it. Upload failure preserves the previous saved asset and snapshot.

## Migration And Validation

Migration `20260718090000_quotation_user_payment_methods.sql` performs the
account-ownership upgrade without resetting quotation data. It preserves
documents, items, document numbers, number counters, and seller data; clones
the legacy singleton seller profile for each existing quotation owner; and
links every quotation to the profile owned by its `created_by` user. The
migration stops with an explicit error if a quotation owner is missing from
Supabase Auth or a seller profile cannot be assigned unambiguously.

A database that already records migration `20260718090000` will not execute
the amended file again. Inspect its actual schema and migration history first,
then deliberately reconcile the history/schema or ship an equivalent follow-up
migration. Never run `supabase migration up` blindly to repair this mismatch.

Run the executable legacy-upgrade regression against isolated temporary
databases in the running local Supabase Postgres container:

```powershell
$env:RUN_QUOTATION_MIGRATION_UPGRADE_TESTS = "1"
node --import ./tests/register-server-only.mjs --test tests/quotation-migration-upgrade.test.ts
```

The default container is `supabase_db_webook`; set `SUPABASE_DB_CONTAINER` to
override it. The test creates a uniquely named database per case and drops it
afterward. It never resets or migrates the shared local database.

Server validation covers required seller/customer/item fields, branch rules,
dates, money, VAT, withholding, PromptPay identifiers, payment type fields,
order/ID uniqueness, and trusted asset URLs. Save errors preserve the draft
and focus the first invalid field. The database repeats payment validation and
normalization: required text is trimmed, irrelevant hidden fields are cleared,
built-in bank metadata comes from the catalogue, and custom banks are stored as
`OTHER`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
Inspect Preview, Print, and Public Read-only at 390, 768, 1280, and 1536 px,
including long text, multiple reordered methods, missing images, uploaded QR,
and automatic PromptPay QR. Confirm print output has no blank page, clipping,
horizontal overflow, or avoidable split payment row.

Before production use, scan an automatic PromptPay QR with a real Thai banking
app and verify both the recipient and amount. Automated payload parsing and CRC
checks do not replace this acceptance step.

### Seller Settings Navigation

`/admin/quotations/settings/company` has two URL-driven sections:
`?section=company` for the seller profile and `?section=payments` for master
payment methods. The seller form previews a selected logo locally before save.
Master bank notes remain editable; the per-quotation bank-transfer editor hides
that field without deleting a previously saved value.
