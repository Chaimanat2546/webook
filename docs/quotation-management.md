# Quotation Management

## Scope

Admins with `allow_tools.allow_quotation = true` manage the seller profile and
create, edit, preview, print, search, soft-delete, and share quotations. The
customer snapshot deliberately contains only name, address, tax ID, office
type, and branch number; it never stores customer contact details, a shipping
address, or a service location.

MVP 1 does not include download/PDF generation, workflow or approval,
customer acceptance, payment or installments, or revision history.

## Routes

- `/admin/quotations` — list, search, print, and soft-delete
- `/admin/quotations/new` — create from the current seller profile snapshot
- `/admin/quotations/[id]` — edit a saved quotation
- `/admin/quotations/settings/company` — manage the singleton seller profile
- `/q/[token]` — no-login, read-only public view of a saved quotation

## Editor Rules

- Create/Edit uses the Document Workbench layout; Preview/Print remains A4.
- Reference is optional. Subject is labelled `เรื่อง / ชื่องาน` in the document.
- All user-visible currency copy uses `บาท`.
- Quantity is required and greater than zero; unit is optional.
- Per-item discount and VAT controls are enabled from `ตั้งค่าเอกสาร`.
- New quotations start with both optional item features off.
- Item discounts are fixed amounts only. Disabling the feature clears all item discounts.
- Enabling VAT starts items at 7%; disabling it stores every item as no VAT at 0%.
- The item ledger, Preview/Print, and Public Read-only display `มูลค่าก่อนภาษี` after item discount and before VAT.
- Drag and drop changes item order, and that order is persisted on save.
- Withholding tax is enabled by its own checkbox.
- Internal notes are admin-only; public notes may appear in the document.

## Calculation And Totals

The server recalculates money before saving:

1. `gross total = sum(quantity × unit price)`
2. `discount total = sum(fixed item discounts)`
3. `pre-tax total = gross total − discount total`
4. `VAT total = sum(item pre-tax amount × item VAT rate)`
5. `grand total = pre-tax total + VAT total`
6. `withholding tax = pre-tax total × withholding percentage`
7. `amount due = grand total − withholding tax`

The local cleanup migration resets quotation documents, items, and numbering,
and removes unused quotation columns while preserving the seller company profile.

## Save, Preview, Print, And Share

Seller and customer values are copied into each quotation, so later seller
profile edits do not change saved documents. Preview renders the current draft.
Print is available only after the first successful save and uses the latest
saved payload in the read-only A4 document.

Share is saved-only. `/q/[token]` uses the latest saved row, never includes
internal notes or customer contacts, and returns 404 after the quotation is
soft-deleted. It is public read-only; it does not allow editing or saving.

## Asset Behavior

Seller logos are normalized to WebP, limited to 10 MB input and 1600 px on the
longest side, and uploaded to `quotations/assets/<uuid>.webp` through the
authenticated Media Worker adapter.

## Validation Checklist

- Seller name, address, and tax ID are required.
- Customer name and address are required.
- Branch number is required only for Branch.
- At least one item is required.
- Item name and quantity are required; unit is optional.
- Dates, discounts, VAT, withholding, emails, and trusted logo URLs are
  validated server-side.
- Save failures preserve the current draft and focus the first invalid field.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
Verify Create/Edit and Preview/Print at mobile, tablet, laptop, and desktop
widths. Verify the public view without a login and after soft deletion.
