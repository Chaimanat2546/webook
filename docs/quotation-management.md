# Quotation Management

## Scope And Ownership

Authenticated admins with `allow_tools.allow_quotation = true` can manage
their own seller profile, reusable payment methods, optional certification
master, and quotations. Every seller profile, payment master, and quotation is linked to the current
Supabase Auth user. RLS combines that ownership check with the existing
quotation permission, so one account cannot read or change another account's
data. ข้อมูลลูกค้า is intentionally different: all quotation-authorized
users share it and may add, edit, deactivate, or reactivate customers.

The customer snapshot contains only name, address, tax ID, office type, and
branch number. This MVP does not include approval, customer acceptance,
payment collection or status, reconciliation, installments, or revision
history.

## Routes

- `/admin/quotations` - list, search, print, and soft-delete owned quotations
- `/admin/quotations/new` - create from the current user's seller and default payment masters
- `/admin/quotations/[id]` - edit saved seller and payment snapshots
- `/admin/quotations/customers` - search and manage the shared ข้อมูลลูกค้า
- `/admin/quotations/settings/company` - manage the current user's seller profile, payment masters, and certification master
- `/q/[token]` - no-login, token-scoped public view of the latest saved quotation

## Quotation List UX

- The list keeps server-side account-scoped search and 20-row pagination.
- Search covers document number, customer, reference, and subject; the list displays only fields already returned by the list RPC.
- Mobile uses compact cards and Tablet/Desktop use a fixed-layout table.
- A card or row opens the quotation with a mouse click. Keyboard users open it through the focused document-number link. Its action menu keeps edit, print, and soft-delete controls isolated from row navigation.
- Loading uses a shape-preserving skeleton. Empty results show a relevant next action, and list-load failures show a contained retry state.
- Soft delete still requires confirmation and reports success or failure through Toast without changing the existing ownership and permission checks.

## Quotation Settings UX

- Seller, payment, and certification remain separate URL-selected sections with independent save actions and selected-section-only server loading.
- Desktop uses the local settings sidebar. Mobile uses the same real links in an intentionally horizontally scrollable row with `aria-current` on the active section.
- Editing a mounted section marks it dirty. Moving to another section or returning to the list asks for confirmation; changing sections never autosaves. A successful save clears only the mounted section's dirty state.
- Seller settings use one flat surface with content-shaped field widths. Office type uses the horizontal Shadcn Radio Group with `ไม่ระบุ`, `สำนักงานใหญ่`, and `สาขา`; it defaults to head office. The same control is used for seller and customer snapshots in the editor. The branch-number input stays visible but disabled unless branch is selected. A selected logo is previewed before save.
- Reusable payment methods render as responsive cards in settings while quotation-specific payment editing keeps its existing compact layout. Add, remove, drag order, defaults, and type-specific fields keep the same data behavior.
- Certification keeps issuer and approver stacked on Mobile and side by side from Tablet. Signatures stay with their signer and the company stamp uses a compact asset row.
- Every section keeps inline field errors and first-error focus, plus Toast for save/upload outcomes. Save is disabled while its section is saving or uploading.
- Certification and payment images show a local preview while uploading. If upload fails, the temporary preview is removed and the previously saved asset remains visible and unchanged.
- This UX polish does not change ownership, snapshots, RLS, upload actions, repositories, services, or database schema.

## Master And Snapshot Rules

- Each account has one seller profile, an ordered reusable payment list, and
  optional issuer, approver, signature, and company-stamp certification data.
- New quotations copy default payment masters into editable quotation rows.
- New quotations copy the certification master once into an editable document
  snapshot. Existing quotations never merge later master changes.
- Saving atomically stores seller, customer, item, and ordered payment
  snapshots. A quotation may have no payment methods.
- Seller and customer names, addresses, and tax IDs are required. Both tax IDs
  must contain exactly 13 ASCII digits. Seller and customer office snapshots
  use the same three office choices; branch number is required only for a branch.
- New quotations default to seven validity days. The validity-days input is
  disabled; an operator may still set the explicit valid-until date.
- Editing a master never changes an existing quotation. Deleting a master
  leaves its saved quotation snapshots intact.
- Payment master and quotation snapshot tables are SELECT-only through the
  table API. Account-scoped master save and atomic quotation save RPCs are the
  only mutation paths; authenticated users have no table-level INSERT, UPDATE,
  DELETE, or TRUNCATE privilege.
- Edit reload matches a saved built-in bank code to the current catalogue only
  to restore its selector ID. It preserves the saved name/logo, and falls back
  to an other-bank snapshot if that catalogue entry no longer exists.
- Preview shows the current local draft. Print uses the latest successful save.
  Share and PDF Download require a saved document with no unsaved changes.
- Public Read-only never exposes internal notes. It intentionally displays
  full saved bank-account and PromptPay identifiers.
- Public payment JSON contains only fields relevant to each saved payment type,
  including for legacy rows that may still contain hidden values.

## ข้อมูลลูกค้า And DBD

- Customer types are `juristic` and `individual`. Both require an exact
  13-ASCII-digit tax ID. An individual tax ID has one master row. A juristic
  tax ID may have one main-office row and multiple rows with distinct,
  trimmed branch numbers; leading zeroes remain significant. These identities
  stay unique across active and inactive rows. Customer type and tax ID are
  immutable after the master is created so verified DBD defaults cannot become
  attached to another identity.
- Contact name, phone, and email are optional and master-only. They never render
  in quotation preview, print, PDF, or Public Read-only.
- Juristic customers may be checked or refreshed manually through the fixed DBD
  Open Data endpoint. Successful verification stores registered name, address,
  status, and verification time as reset defaults; the full provider response
  is neither stored nor logged. A successful save or refresh warns when DBD
  reports a status other than `ยังดำเนินกิจการอยู่`.
- Current name and address remain editable. Refresh replaces only the stored DBD
  defaults and preserves current overrides and contacts. Reset copies the DBD
  name/address into current fields, selects head office, and clears branch
  number; contacts remain unchanged.
- When DBD times out, is unavailable, returns invalid data, or has no matching
  record, a new juristic customer may be saved unverified only after explicit
  confirmation. Individual customers never call DBD or display a DBD state.
- Deactivation replaces deletion. Inactive customers remain unique and can be
  found through the inactive filter and reactivated after confirmation, but
  the quotation picker searches active rows only.
- Selecting ข้อมูลลูกค้า copies only name, address, tax ID, office type, and
  branch number into the editable quotation snapshot. It does not store a
  customer-data record ID. Later ข้อมูลลูกค้า edits do not change quotations,
  and quotation edits do not change ข้อมูลลูกค้า. Historical quotation customers
  are not imported automatically.

## Payment Methods

Supported types are:

- Bank transfer: bank, account number, and account name; optional uploaded QR.
- PromptPay: 10-digit phone or 13-digit national/tax identifier and account
  name; either uploaded QR or automatic amount-bound QR.
- QR Payment: provider name and uploaded QR.
- Cash: optional instructions.
- Other: display name and optional instructions.

### Bank Account Type

Bank transfers may optionally select ไม่ระบุ, ออมทรัพย์, กระแสรายวัน, or
ฝากประจำ. The master value is copied into the quotation snapshot. Preview,
Public, and Print show the selected Thai type before the account number on the
same line; an unspecified type adds no placeholder.

Built-in Thai banks use generic local bank-building icons under
`public/quotation/banks`; they are not official bank logos or trademarks.
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
- Newly created documents use `QO-YYYYMMDD0001`; saved legacy document numbers
  remain unchanged when edited.
- The workbench header shows `ใบเสนอราคาใหม่` before the first save and the
  document number afterward. Tablet/Desktop expose Back, Preview, and Save in
  the header; Mobile keeps the same actions in a fixed bottom bar with content
  clearance and safe-area padding.
- Save success and task-level failure use Toast. Field validation remains next
  to its control, links error text with `aria-describedby`, and scrolls then
  focuses the first invalid field.
- The editor exposes Back, Preview, and Save as primary actions. Saved documents
  expose Share, Print, Download, and an explicit Delete action; there is no
  redundant More menu.
- Invalid saves show one Toast while keeping field-specific errors inline.
- Leaving with unsaved changes uses an in-app confirmation dialog. Browser
  refresh and tab close continue to use the browser-native unsaved-changes warning.
- Preview uses the current draft. Print, PDF Download, and Public Share remain
  limited to the latest clean saved document.
- Reference and `เรื่อง / ชื่องาน (ถ้ามี)` are optional. Empty optional values
  are omitted from Preview, Public, Print, and PDF instead of showing a placeholder.
- Currency copy is always `บาท`.
- Quantity is required and greater than zero; unit is optional.
- Every item row always exposes fixed-discount and VAT controls; there is no
  document-settings menu for hiding them.
- VAT has exactly three choices: `7%`, `0%`, and `ไม่มี`. They persist as
  taxable 7%, taxable 0%, and no VAT at 0%, respectively.
- When legacy quotations are opened in the editor, exempt VAT maps to `ไม่มี`;
  unsupported non-zero taxable rates map to `7%` so the editable choice,
  calculation, and next save stay consistent. The saved Print/Public snapshot
  remains unchanged until the admin saves the edited document.
- Item names come from the read-only database catalogue and are limited to
  `ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)`,
  `ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)`,
  `ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)`, `ค่าบริการ`, and
  `ประกันความเสียหาย`. Every selection replaces the editable description with
  the selected name. Legacy names remain readable but must be reselected before
  saving.
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

Certification signatures and company stamps follow the same 2 MB PNG
normalization boundary under `/quotations/certification-assets/<uuid>.png`.
Failed optional document images are omitted without breaking Preview, Public,
Print, or PDF; the Public QR remains required for PDF Download.

## Certification, Public Share, And PDF

- Payment and certification overrides start collapsed below document notes.
  One show/hide button controls the whole tabs block, tab switches preserve
  unsaved state, and matching validation errors expand the relevant tab.
- Preview, Print, Public Read-only, and PDF show one compact certification row
  containing the Public QR, issuer, approver, company stamp, and customer
  receiver in that order.
- Issuer and approver show signature, name, and quotation issue date without
  position. The receiver shows the saved customer name and leaves signature
  and date blank for handwriting; no acceptance data is stored.
- `/q/[token]` is a bearer-style, no-login, read-only link. It shows only the
  latest save, excludes internal notes, and returns no document after soft delete.
- Set `QUOTATION_PUBLIC_ORIGIN` to the canonical bare HTTPS origin. Share and
  Public QR generation never trust request or browser Host values; missing or
  invalid configuration disables Share and omits QR while Preview/Print remain usable.
- PDF Download uses the latest saved snapshot, bundled Noto Sans Thai fonts,
  comma-formatted money, repeated item headings, page-safe long text, payments,
  notes, and the compact five-slot certification row.
- Link expiry, passwords, token rotation, e-signing, approval workflow, and
  orphaned-asset garbage collection remain outside this MVP.

### Document surface consistency

- Preview/Print is the visual reference; HTML and PDF consume the same
  normalized document view model and keep the same supported section order.
- Preview shows the current draft. Print uses the latest successful save. Share
  and PDF Download require a clean saved quotation.
- Public Read-only keeps the A4 document width on small screens inside an
  intentional horizontal scrolling viewport.
- Print avoids splitting HTML item rows. PDF keeps ordinary rows together and
  leaves oversized validated descriptions breakable so content is not lost.
- Invalid or removed public links show a generic Thai not-found state without
  internal error details.

## Migration And Validation

Migration `20260722090657_quotation_customer_master_dbd.sql` creates the shared
ข้อมูลลูกค้า, exact tax-ID and DBD-completeness constraints, quotation
permission RLS, update audit trigger, and the paginated active/inactive list
RPC. Follow-up migration
`20260722102825_quotation_customer_branch_identity.sql` replaces tax-only
uniqueness with customer identity uniqueness: individual tax ID, juristic main
office tax ID, or juristic tax ID plus branch number. Inactive rows remain in
that boundary. Migration `20260722170000_harden_quotation_customer_mutations.sql`
limits authenticated quotation users to shared SELECT access and reserves
INSERT/UPDATE for permission-checked Server Actions using the server-only
service-role client. DELETE is not exposed; audit fields preserve the acting
authenticated user.

Migration `20260720120000_quotation_pdf_qr_certification.sql` adds the
account-owned certification master, per-quotation JSON snapshot, validated
owner-scoped save RPC, trusted certification asset rules, and Public snapshot
output. Apply it before opening the new settings/editor routes.

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
The normal test suite mocks DBD and never depends on the live service. To run
the ข้อมูลลูกค้า sharing/RLS integration against an already configured local
Supabase environment:

```powershell
$env:RUN_LOCAL_SUPABASE_TESTS = "1"
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-database-integration.test.ts
```

Inspect Preview, Print, PDF, and Public Read-only at 390, 768, 1280, and 1536 px,
including long text, multiple reordered methods, missing images, uploaded QR,
and automatic PromptPay QR. Confirm print output has no blank page, clipping,
horizontal overflow, or avoidable split payment row.

Before production use, scan an automatic PromptPay QR with a real Thai banking
app and verify both the recipient and amount. Automated payload parsing and CRC
checks do not replace this acceptance step.

### Seller Settings Navigation

`/admin/quotations/settings/company` has three URL-driven sections:
`?section=company` for the seller profile, `?section=payments` for master
payment methods, and `?section=certification` for issuer, approver, signatures,
and company stamp. Image fields preview a selected file locally before save.
Master bank notes remain editable; the per-quotation bank-transfer editor hides
that field without deleting a previously saved value.
