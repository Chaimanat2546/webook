# Quotation Management

## Scope

Admin users with `allow_tools.allow_quotation = true` can manage one seller
profile and create, edit, preview, print, search, and soft-delete quotations.
MVP 1 has no business status, approval, customer acceptance, payment tracking,
WHT, installments, Public Share, QR, or PDF generator.

## Routes

- `/admin/quotations` — list, search, print, and soft delete
- `/admin/quotations/new` — create from the current seller profile snapshot
- `/admin/quotations/[id]` — edit the saved snapshot
- `/admin/quotations/settings/company` — create or replace the singleton seller profile

## Editor Rules

- Create/Edit uses the Document Workbench layout; Preview/Print remains A4.
- Large desktop uses a 7/5 customer/document metadata grid and a fixed-column item ledger. Below `xl`, items become responsive editable cards.
- Controls use semantic width roles based on value type; only item name/description is fluid in the desktop ledger.
- Notes and totals use a ruled fluid-left/`18rem`-right completion grid and stack on smaller screens.
- Reference is optional and belongs to document data. There is no job-title field.
- Branch number is required only for Branch and is cleared for Head office.
- Customer data does not include a shipping address or service location in the editor or document.
- Villa service items use a name and optional description; SKU is not shown in the editor.
- Quantity is required and greater than zero. Unit is optional.
- VAT is configured per item. Price mode appears above the item list.
- Share and Download are disabled future actions.

## Save And Snapshot Behavior

Seller and customer values are copied into each quotation. Changing the seller
profile does not rewrite saved quotations. The server validates and recalculates
all money before the transactional RPC replaces the quotation and its items.

## Preview And Print

Preview uses the current draft. Print is available only after the first
successful save and uses the latest saved payload. Browser print CSS isolates
the read-only A4 document from Admin navigation and edit controls.

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
- Dates, discounts, VAT, emails, and trusted logo URLs are validated server-side.
- Save failures preserve the current draft and focus the first invalid field.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
Verify Create/Edit and Preview/Print at mobile, tablet, laptop, and desktop
widths.
