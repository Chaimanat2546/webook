# Quotation Document Workbench Design

**Date:** 2026-07-15

**Status:** Approved design; awaiting written-spec review

**Selected direction:** A — Document Workbench with inline totals

## Visual Thesis

The quotation editor is a full-width working document, not an A4 simulation.
Fields sit near the position where their values appear in the finished
quotation, but controls are sized for the value they accept instead of
stretching across unused space. A4 is reserved for Preview and Print.

The visual language follows the existing Gridgeist direction: a visible grid,
quiet rules, restrained color, compact typography, and a dominant item ledger.

## Scope

This revision covers:

- the customer, document metadata, item ledger, and totals composition;
- responsive Create and Edit behavior;
- item drag-and-drop ordering;
- per-item and document-level discounts;
- per-item VAT and document-level withholding tax;
- customer snapshot cleanup across UI, validation, API/service types, stored
  JSON snapshots, Preview/Print, and Public Read-only;
- consistent display of the currency as `บาท`.

Existing seller snapshot, save, delete, Preview, Print, and Public Share flows
remain. Public Share is available only after a quotation has been saved and
continues to show the latest saved version, never unsaved editor state.

This revision does not add document workflow, approval, acceptance, payment,
installments, revision history, or new dependencies.

## Page Hierarchy

The editor retains four horizontal regions:

1. **Command bar** — title and document number on the left; Close and Save on
   the right.
2. **Seller strip** — logo and seller identity with the existing per-document
   snapshot editing behavior on the left; Share, Print/Preview, Download, and
   More form a separate document-action group on the right.
3. **Document workspace** — `01 ลูกค้า`, `02 ข้อมูลเอกสาร`, and the full-width
   `03 รายการ` ledger.
4. **Completion area** — notes on the left and compact inline totals on the
   right.

Save remains the dominant action. Share, Print/Preview, Download, and More stay
aligned with the seller strip rather than being merged into the page-level Save
header. The Print action retains the A4 Preview/Print flow.

## Grid And Field Geometry

- The editor fills the Admin Shell content width with no A4 frame.
- Customer and document metadata share the upper workspace on wide screens and
  stack on smaller screens.
- Controls use intrinsic maximum widths and wrap; spare section width is not
  distributed equally between fields.
- Single-line values do not become wide merely because a section has spare
  room.
- Address and item-description controls may grow vertically.
- On mobile, controls become full-width where that improves touch entry.

Semantic field sizes:

| Role | Examples | Desktop maximum |
|---|---|---:|
| Compact | quantity, percentage, validity days | `7rem` |
| Date | issue date, valid-until date | `10rem` |
| Identifier | tax ID, branch number, reference | `14rem` |
| Money | unit price, totals | `8rem` |
| Name | customer legal name, subject | `24rem` |
| Address | customer postal address | `36rem` |

Inputs, native selects, and date controls share one height, label rhythm,
border, focus ring, and disabled treatment. Native select indicators must stay
visible.

## 01 ลูกค้า

The customer section contains only information used on the quotation:

- customer or legal name;
- address;
- tax ID;
- office type: `สำนักงานใหญ่` or `สาขา`;
- branch number, shown and required only when `สาขา` is selected.

The following fields are removed from the complete quotation flow:

- contact name;
- phone;
- email;
- shipping address;
- service location.

Changing office type from branch to head office clears the branch number.

## 02 ข้อมูลเอกสาร

The document section contains:

- issue date;
- validity mode and validity days/date;
- valid-until date;
- reference number, optional;
- `เรื่อง / ชื่องาน`, optional.

There is no currency selector. The internal ISO currency remains `THB`, while
all user-facing editor, Preview, Print, PDF, and Public Read-only copy uses the
word `บาท`.

There is no visible inclusive/exclusive price-mode selector. New quotations use
the existing VAT-exclusive calculation mode. Stored legacy mode data may remain
internally for backward-compatible reads, but it is not an editable UI concept.
VAT treatment is selected per item.

## 03 รายการ

### Desktop ledger

The desktop ledger uses these columns:

| Column | Behavior |
|---|---|
| Drag handle | compact `⋮⋮` handle; does not drag from editable controls |
| Item | the only fluid column; name plus optional description |
| Quantity | required numeric input |
| Unit | optional compact text input |
| Unit price | right-aligned money input |
| Item discount | type (`%` or `บาท`) plus value |
| VAT | per-item treatment/rate selector |
| Total | right-aligned calculated value before VAT |
| Delete | compact destructive action at the row end |

SKU is not shown or accepted from the editor.

The Total column is:

```text
quantity × unit price − item discount
```

It includes the item discount, does not include document discount, and does not
include VAT.

The former leading overflow menu and move-up/move-down controls are removed.
Dragging updates local editor order; the resulting `position` values persist
only when the document is saved. The existing installed drag-and-drop package
and project pattern must be reused. The handle must remain keyboard operable
and expose an accessible name.

`+ เพิ่มรายการ` is a real button at the lower-left inside the item section.

### Tablet and mobile

Below the desktop ledger breakpoint, every item becomes a compact editable
block:

- handle, item number/name, and delete action form the header;
- description occupies its own row;
- quantity, unit, price, discount, and VAT use a two-column detail grid on
  narrow screens and may expand to more columns on tablet;
- Total is anchored at the lower-right;
- there is no page-level horizontal overflow.

The reading and focus order matches the desktop order.

## Totals

Totals are placed below the item ledger at the right edge and use aligned
label/control/value rows:

```text
รวมเป็นเงิน                         0.00
☐ ส่วนลด   [ประเภท] [0.00]         0.00
ราคาหลังหักส่วนลด                  0.00
VAT                                0.00
จำนวนเงินรวมทั้งสิ้น                0.00
──────────────────────────────────────
☐ หักภาษี ณ ที่จ่าย [0.00] %       0.00
ยอดชำระ                            0.00
```

- The document discount row is always visible.
- Its type and value controls are disabled until the checkbox is selected.
- The type supports `%` and `บาท`.
- The label is only `ส่วนลด`; there is no `รวมส่วนลดเอกสาร` row.
- The withholding row is always visible and its percentage input is disabled
  until selected.
- Turning either checkbox off excludes that value from calculation and
  persistence.
- Values are right-aligned and use two decimal places. Monetary suffixes and
  supporting copy use `บาท`, never `THB`.

## Calculation Rules

For each item:

```text
gross amount = quantity × unit price
item discount = gross amount × percentage, or entered amount
item total = gross amount − item discount
```

For the document:

```text
subtotal = sum(item total)
document discount = subtotal × percentage, or entered amount
after document discount = subtotal − document discount
VAT = sum(each item's VAT after proportional document-discount allocation)
grand total = after document discount + VAT
withholding tax = after document discount × withholding percentage
amount due = grand total − withholding tax
```

Document discount is allocated proportionally across items before VAT so mixed
VAT rates remain correct. The final allocation absorbs any rounding remainder
so allocated discounts equal the document discount exactly.

All calculations use decimal-safe money utilities. Stored calculation values
retain the precision required by the existing schema; displayed money uses two
decimal places.

## Data And Migration

`CustomerSnapshot` is reduced to:

- `name`;
- `address`;
- `taxId`;
- `officeType`;
- `branchNumber`.

Customer snapshots are stored as JSON, so there are no individual contact
columns to drop. A new migration must sanitize existing `customer_snapshot`
JSON by removing both camelCase and legacy snake_case keys for contact name,
phone, email, shipping address, and service location. New writes serialize only
the reduced snapshot shape. Existing migrations must not be edited and the
database must not be reset.

The new migration also adds the minimum stored values required for withholding
tax and amount due, updates quotation persistence functions, and backfills
existing quotations with zero withholding and `amount due = grand total`.

No separate boolean is required for document discount: a null discount type
means disabled. Withholding follows the same minimal persistence rule through a
zero or null rate as selected by the final schema implementation.

The internal `currency = 'THB'` constraint remains. Only its user-facing label
changes to `บาท`.

## Validation And Errors

- At least one item is required.
- Quantity must be greater than zero.
- Unit may be empty.
- Unit price cannot be negative.
- Percentage discounts and withholding must be between `0` and `100`.
- An amount discount cannot exceed its calculation base.
- Document discount cannot exceed the subtotal.
- Disabled document discount and withholding controls do not contribute stale
  values.
- Field errors remain adjacent to their controls and retain `aria-invalid`.
- The error summary continues to focus the relevant field.
- A save failure preserves all unsaved editor values and the local item order.
- Public Share continues to expose only the latest successfully saved data.

## Implementation Boundary

Reuse existing React, Tailwind, shadcn components, Lucide icons, decimal money
utilities, and the already-installed drag-and-drop package. Do not add a new
dependency, global theme, workflow abstraction, or parallel quotation model.

Expected change areas are limited to the quotation editor/document components,
quotation types/calculator/service/repository/action flow, the quotation RPC
migration, focused tests, and this specification.

## Verification

Automated checks must cover:

- removed customer fields are absent from editor, Preview/Print, Public
  Read-only, payload normalization, and newly stored snapshots;
- existing snapshots are sanitized by the new migration;
- branch number remains conditional and clears for head office;
- no currency or price-mode selector is visible and user-facing copy says
  `บาท`;
- item drag-and-drop changes order and saved `position` values;
- unit remains optional while quantity remains required;
- per-item `%` and amount discounts;
- document-discount disabled/enabled behavior for both types;
- per-item VAT after proportional document-discount allocation;
- withholding disabled/enabled behavior and amount-due calculation;
- share remains unavailable before first save and Public Read-only shows only
  the latest saved version;
- responsive item layout and keyboard-accessible drag handle;
- failed saves retain unsaved state.

Before completion run typecheck, lint, all tests, production build, and
`git diff --check`. Visually inspect authenticated Create and Edit screens at
mobile, tablet, laptop, and large desktop widths, then inspect Preview/Print and
Public Read-only output with realistic Thai data.
