# Quotation Reference Document Design

**Status:** Implemented and verified

## Goal

Bring Preview, Print, and Public Read-only closer to the supplied
`QO-2026070800002.pdf` while rendering only data already supported by the
quotation MVP. Currency values use thousands separators everywhere, money
inputs accept grouped values safely, and printing produces no blank page.

## Scope

This change covers:

- grouped currency presentation in Edit, Preview, Print, Public Read-only, and
  the quotation list;
- money inputs that accept either `19900` or `19,900` and display
  `19,900.00` after blur;
- the shared A4 document hierarchy, spacing, table, and totals treatment;
- isolation of the printable document from the editor page layout;
- long-content and multi-page print behavior.

This change does not add QR codes, payment methods, signatures, company
stamps, customer acceptance, document workflow, PDF download, or new database
columns.

## Visual Direction

The document is a restrained adaptation of the supplied PDF, not an exact
clone. It keeps the reference's information order, pale indigo metadata and
summary surfaces, strong table header, quiet horizontal rules, and clear A4
rhythm. It uses only the current product data and existing seller logo.

The shared `QuotationDocument` remains the only document composition used by
Preview, Print, and Public Read-only.

### A4 Structure

1. **Document header**
   - Seller logo and seller identity sit at the upper left.
   - Seller address, tax ID, office type, phone, email, and website use a
     compact labelled layout.
   - `ใบเสนอราคา` is the dominant title at the upper right.
   - Document number, issue date, valid-until date, and reference sit in a pale
     indigo metadata panel.
   - `เรื่อง / ชื่องาน` appears near the metadata when present.
   - Optional seller values are omitted rather than leaving empty rows.

2. **Customer block**
   - Customer name, address, tax ID, and office type appear below the seller
     section with a quiet divider.
   - Branch number appears only for a branch.
   - Missing optional customer tax data is omitted.

3. **Item table**
   - The header uses a pale indigo background and fixed, readable column
     proportions.
   - Item name remains primary medium-weight text.
   - Item description remains `text-slate-500`, preserves newlines, and wraps
     unbroken English text.
   - Discount and VAT columns appear only when at least one saved item uses
     them.
   - Unit remains optional.
   - Every monetary cell is right aligned and grouped to two decimals.

4. **Notes and totals**
   - Public notes occupy the lower-left content column when present.
   - Totals occupy the lower-right column in the existing calculation order.
   - `จำนวนเงินรวมทั้งสิ้น` receives the pale indigo emphasis treatment from
     the reference.
   - Withholding and `ยอดชำระ` remain below the emphasized grand total.
   - Thai baht text remains visible and wraps without clipping.
   - Internal notes never enter the shared document.

No empty placeholder sections are rendered for features outside MVP scope.

## Currency Formatting

### Canonical Values

Calculations, payloads, Server Actions, RPC payloads, and database values keep
the current canonical decimal strings without grouping separators, for example
`19900.00`. Calculation formulas and limits do not change.

### Display Values

A small shared string formatter groups the integer portion and preserves exact
decimal text without converting through floating point:

```text
0       -> 0.00
19900   -> 19,900.00
19900.5 -> 19,900.50
```

All currency output in Edit totals, Preview, Print, Public Read-only, and the
quotation list uses this formatter. Quantity and percentage fields are not
currency and keep their current formatting.

### Money Input Behavior

Only money inputs use grouped editing behavior, including unit price and
enabled fixed item discount.

- Users may enter an ungrouped value such as `19900` or a correctly grouped
  value such as `19,900`.
- While focused, the input preserves the user's editable text.
- Valid edits update the parent quotation state as a canonical value without
  commas so totals continue updating.
- On blur, a valid value displays with grouping and exactly two decimal places.
- Empty and partially typed values may exist while focused, but existing save
  validation remains authoritative.
- Incorrect grouping such as `1,00` is not silently reinterpreted.
- External resets and saved payload changes resynchronize the displayed value.

No numeric-input dependency is added.

## Print Isolation

The current blank page is caused by hiding the editor with `visibility`, which
leaves its layout participating in print pagination. The printable document
will instead be mounted in a body-level print host while printing.

During print:

- the application root is removed from print layout with `display`, not merely
  made invisible;
- the body-level print host is the only printable root;
- `@page` remains A4 with zero browser page margin because the document owns
  its internal margin;
- no fixed body height or overflow clipping is used;
- table rows and key sections avoid internal breaks when space permits;
- table headers repeat on later pages;
- documents with enough content may continue to a second real page;
- Print continues to use the latest saved payload, never an unsaved draft.

Cleanup after `afterprint` removes the print host and restores the application
without leaving print-only classes or DOM behind.

## Responsive Behavior

The A4 document retains its physical page width in Preview and Public
Read-only. Narrow screens scroll the document container rather than collapsing
the paper layout. Create and Edit remain full-width responsive workbenches.

## Error Handling And Security

- Server-side validation and calculation remain authoritative.
- Grouping is presentation-only and never weakens the canonical money regex at
  the server boundary.
- Public Read-only continues to load only by an unpredictable token and never
  exposes internal notes.
- Soft-deleted quotations remain unavailable publicly.
- A failed print setup must remove temporary print state instead of leaving the
  editor hidden.

## Verification

Automated checks must cover:

- exact grouping and two-decimal formatting without floating-point conversion;
- grouped and ungrouped money input normalization on blur;
- rejection of malformed grouping;
- shared formatted output in editor totals and `QuotationDocument`;
- print-host isolation and cleanup;
- existing calculation, save, public-token, and soft-delete behavior.

Visual verification must compare the supplied PDF and the rendered shared
document at A4 size, then inspect Preview, Print, and Public Read-only with the
same saved quotation. Print Preview must show no unintended blank page, and a
long document must paginate without clipping.

## Implementation Boundary

Prefer one shared money-formatting module, the existing `Numeric` input path,
the existing shared `QuotationDocument`, and the existing print action. Do not
introduce a document renderer, a PDF library, a new database field, or a second
document component.
