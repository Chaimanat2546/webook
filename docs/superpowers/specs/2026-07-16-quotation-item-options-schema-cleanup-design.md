# Quotation Item Options And Schema Cleanup Design

**Date:** 2026-07-16
**Status:** Approved for implementation

## Goal

Simplify the quotation editor and database around the fields that are actually
used. Per-item discount and VAT remain optional document editing features, but
their visibility is inferred from saved item values instead of persisted feature
flags. Per-item discounts support fixed amounts only. Document-level discount is
removed.

The quotation database is local and its quotation data may be reset. The company
profile and all unrelated modules must remain untouched.

## Document Settings And Editor Flow

The `03 รายการ` heading has a right-aligned `ตั้งค่าเอกสาร` button. It opens a
compact existing dropdown with two checkbox items:

- `ส่วนลดเฉพาะรายการ`
- `VAT เฉพาะรายการ`

No database columns are added for these checkbox states.

For a new quotation, both options are off. New items therefore start with:

```text
discount amount = 0
VAT treatment = none
VAT rate = 0
```

When item discount is enabled, the item ledger shows one fixed-amount input per
item. There is no discount-type selector and no percentage discount. A new item
added while discount is enabled starts at zero.

When VAT is enabled, existing and newly added items start at `taxable / 7%`.
Each item retains the existing VAT treatment choices:

- taxable;
- VAT exempt;
- no VAT.

VAT-exempt and no-VAT items store a zero rate.

Turning either option off warns that all values for that option will be cleared.
After confirmation, turning discount off sets every item discount to zero.
Turning VAT off sets every item to `none / 0`.

When a saved quotation is opened, the editor infers visibility from saved item
data:

- discount is shown when at least one item has a discount greater than zero;
- VAT is shown when at least one item has a VAT treatment other than `none`.

An option enabled without any saved value is intentionally transient and may be
off again after reload. This keeps feature-state columns out of the schema.

Desktop ledger columns reflow when either optional control is hidden; no empty
column is reserved. Mobile item cards render only enabled controls. Existing
drag-and-drop behavior and the Document Workbench visual language remain.

## Item And Document Presentation

The final item column is renamed from `รวม` to `มูลค่าก่อนภาษี`. It displays the
item amount after its fixed discount and before VAT:

```text
gross amount = quantity × unit price
pre-tax item amount = gross amount − item discount amount
item VAT = pre-tax item amount × VAT rate
item total including VAT = pre-tax item amount + item VAT
```

The ledger displays `pre-tax item amount`, not `item total including VAT`.
Preview, Print, and Public Read-only use the same label and value. Their discount
and VAT columns are shown only when the saved item data uses those features.

The summary block becomes:

```text
รวมก่อนส่วนลด
ส่วนลด
มูลค่าก่อนภาษี
VAT
จำนวนเงินรวมทั้งสิ้น
หักภาษี ณ ที่จ่าย
ยอดชำระ
```

The discount summary row is shown only when at least one item has a non-zero
discount. There is no document-discount checkbox, value, allocation, or summary
row.

Document totals are:

```text
gross total = sum(item gross amounts)
discount total = sum(item discount amounts)
pre-tax total = gross total − discount total
VAT total = sum(item VAT amounts)
grand total = pre-tax total + VAT total
withholding tax = pre-tax total × withholding percentage
amount due = grand total − withholding tax
```

Money calculations continue to use the existing decimal-safe calculator and
two-decimal display formatting. Prices remain VAT-exclusive and the only
user-facing currency is `บาท`.

## Payload And Validation

`QuotationPayload` no longer carries currency, price mode, document-discount
type, or document-discount value. An item carries `discountAmount` directly;
discount type and discount value are removed.

The server normalizes and validates all input before calling the quotation RPC:

- at least one item is required;
- quantity must be greater than zero;
- unit remains optional;
- unit price cannot be negative;
- item discount must be non-negative and cannot exceed quantity multiplied by
  unit price;
- VAT rate must be between zero and 100;
- VAT-exempt and no-VAT items must use a zero VAT rate;
- withholding rate remains between zero and 100;
- disabled features contribute no stale values.

Create, Edit, Preview, Print, and Public Read-only all use the same normalized
payload and calculator behavior. Public sharing remains available only after
the quotation has been saved and continues to expose the latest saved values.

## Target Database Schema

### `public.quotations`

Keep:

```text
id
document_number
issue_date
valid_until
validity_days
reference
subject
seller_snapshot
customer_snapshot
gross_total
discount_total
pre_tax_total
vat_total
grand_total
withholding_tax_rate
withholding_tax_total
amount_due
public_notes
internal_notes
public_token
created_by
updated_by
created_at
updated_at
deleted_at
```

Remove:

```text
currency
price_mode
document_discount_type
document_discount_value
document_discount_total
```

Rename:

```text
subtotal            -> gross_total
item_discount_total -> discount_total
taxable_total       -> pre_tax_total
```

### `public.quotation_items`

Keep:

```text
id
quotation_id
position
name
description
quantity
unit
unit_price
discount_amount
vat_treatment
vat_rate
```

Remove:

```text
sku
discount_type
discount_value
document_discount_allocation
gross_amount
taxable_amount
vat_amount
line_total
created_at
updated_at
```

The item foreign-key index, unique quotation-position constraint, quotation
indexes, RLS policies, least-privilege grants, public token, soft delete, seller
and customer snapshots, and document-number counter remain.

`public.quotation_company_profiles` and all unrelated tables are unchanged.

## Migration

Create one new migration; do not edit existing migration files. The migration
runs as one transaction and:

1. truncates `public.quotations` with its item cascade;
2. truncates `private.quotation_number_counters` so numbering restarts cleanly;
3. removes and renames the approved quotation columns;
4. removes the approved quotation-item columns;
5. installs the new checks;
6. replaces `private.save_quotation(jsonb)` for the smaller payload and schema;
7. replaces `private.get_public_quotation(uuid)` for the smaller public payload;
8. preserves or reapplies the existing wrapper functions, grants, RLS policies,
   and indexes as required.

The migration intentionally does not convert old quotation data because reset
was approved.

Database checks enforce:

```text
discount_amount >= 0
discount_amount <= round(quantity × unit_price, 2)
vat_rate between 0 and 100
VAT exempt or none => vat_rate = 0
discount_total <= gross_total
pre_tax_total = gross_total − discount_total
grand_total = pre_tax_total + vat_total
amount_due = grand_total − withholding_tax_total
```

Application validation remains required for useful field-level errors before a
database constraint can reject a write.

## Error Handling And Security

- A save failure preserves all unsaved editor values and item order.
- Field errors stay adjacent to their controls and retain `aria-invalid`.
- Confirm destructive option changes only when clearing existing values.
- Existing quotation authorization remains enforced by
  `private.has_quotation_permission()`.
- Privileged implementations remain in the unexposed `private` schema.
- Public access remains token-based, read-only, and limited to non-deleted
  quotations.
- The reset is scoped to quotation documents, items, and their number counter.

## Implementation Boundary

Reuse the current calculator, editor components, dropdown, dialog, responsive
ledger, RPC pattern, and Supabase security model. Add no dependency, feature
flag framework, settings JSON, replacement table hierarchy, or revision model.

Expected changes are limited to quotation types, calculator, service,
repository, editor/document UI, one new migration, focused quotation tests, and
the existing quotation documentation.

## Verification

Automated checks must cover:

- new quotations start with discount and VAT hidden and zeroed;
- enabling VAT starts items at 7%;
- disabling either option clears all corresponding item values;
- saved item data restores the appropriate editor controls;
- fixed item discount rejects negative values and amounts above gross value;
- VAT-exempt and no-VAT items use a zero rate;
- the item ledger, Preview, Print, and Public document show pre-tax item values;
- optional columns reflow without leaving blank grid tracks;
- document-discount and percentage item-discount fields are absent from UI,
  payloads, public output, RPCs, and the final schema;
- summary totals and withholding calculations follow the approved formulas;
- the migration resets only quotation data and leaves the company profile and
  unrelated tables intact;
- RLS, grants, soft delete, public sharing, and document numbering still work.

Before completion run typecheck, lint, all tests, production build, database
integration tests, migration verification, and `git diff --check`. Visually
inspect Create/Edit at mobile, tablet, laptop, and desktop widths, plus Preview,
Print, and Public Read-only.
