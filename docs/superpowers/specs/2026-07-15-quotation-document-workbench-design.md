# Quotation Document Workbench Design

**Date:** 2026-07-15

**Status:** Approved direction; awaiting written-spec review

**Selected direction:** A — Document Workbench

## Visual Thesis

A precise quotation workbench built on a visible document grid: customer and
document metadata stay compact, line items own the page, monetary totals remain
easy to find, and every control is sized by the kind of value it accepts.

The editor is not an A4 simulation. A4 remains exclusive to Preview and Print.

## Scope

This redesign changes the composition and responsive behavior of
`QuotationEditor` only. It preserves:

- existing quotation payload, validation, calculation, save, delete, Preview,
  and Print behavior;
- seller and customer snapshots;
- conditional branch-number behavior;
- item VAT and discount behavior;
- current Admin Shell, shadcn primitives, keyboard behavior, and field-error
  focus behavior.

It does not add workflow, status, Public Share, PDF generation, payment,
withholding tax, installments, or new dependencies.

## Page Hierarchy

The editor uses four visible horizontal regions:

1. **Document command bar** — page title and document number on the left;
   Close, Preview, Print, More, and Save on the right.
2. **Seller strip** — logo, seller identity, office type, tax ID, and
   `แก้ไขเฉพาะใบ` in one quiet row.
3. **Document workspace** — customer metadata, document metadata, and the item
   ledger.
4. **Completion area** — public/internal notes on the left and totals on the
   right.

Save remains the dominant action. Share and Download remain disabled future
actions under the existing document menu.

## Grid And Geometry

### Outer grid

- The editor fills the Admin Shell content width with no A4 frame.
- Large desktop metadata uses a 12-column grid: customer spans 7 columns and
  document metadata spans 5 columns.
- The two metadata groups use top rules and section labels instead of rounded
  cards around every group.
- The item ledger spans all 12 columns and is the dominant area.
- Notes and totals use a fluid-left/fixed-right grid; totals occupy `18rem` and
  align with the ledger's right edge.

### Field size roles

Controls use shared semantic size roles rather than one-off width decisions:

| Role | Intended values | Desktop maximum |
|---|---|---:|
| Compact | quantity, rate, validity days | `7rem` |
| Date | issue and valid-until dates | `10rem` |
| Identifier | tax ID, branch number, reference | `16rem` |
| Person | contact name, phone | `18rem` |
| Name | customer or seller legal name | `28rem` |
| Address | postal address | `40rem` |
| Contact channel | email and website | `22rem` |

All roles remain `width: 100%` below their maximum so they do not overflow on
small screens. Address fields may grow vertically; single-line values must not
grow merely because the section has spare space.

Inputs, native selects, and date controls share the same height, border,
radius, focus ring, disabled treatment, and label rhythm. The native select
indicator must remain visible.

## Metadata Composition

### Customer

- Legal name and address appear first because they are required.
- Name uses the Name role and address uses the Address role; neither stretches
  to the full 7-column section when its role maximum is reached.
- Tax ID, office type, contact name, phone, and email use a compact two-column
  field grid.
- Branch number is inserted beside office type only when `สาขา` is selected.
- No shipping address or service location is shown.

### Document metadata

- Issue date, validity days, valid-until date, currency, and reference use a
  two-column field grid.
- Currency stays read-only.
- Reference remains optional.
- Price mode is not part of document metadata; it sits in the item ledger
  heading because it controls item calculations.

## Item Ledger

### Large desktop

The desktop editor uses a semantic table with a fixed column system:

| Column | Width behavior |
|---|---|
| Row/action | `2.5rem` |
| Item name and description | the only fluid column |
| Quantity | `5rem` |
| Unit | `5rem` |
| Unit price | `7.5rem` |
| Discount type/value | `9rem`, controls stacked |
| VAT treatment/rate | `9rem`, controls stacked |
| Line total | `8.5rem`, right-aligned |

The fluid item column keeps a `16rem` minimum. The table uses
`table-layout: fixed` plus a `colgroup`; the browser must not
redistribute spare width equally across quantity, price, discount, and VAT.
The minimum ledger width may scroll horizontally only at widths where the card
layout has not yet taken over.

Item actions use one compact overflow menu beside the row number. Move up, move
down, and delete remain available without taking a separate row above the item
fields.

### Laptop, tablet, and mobile

Below the large-desktop breakpoint, items become editable cards rather than a
squeezed table:

- row number, item name, and overflow actions form the card header;
- description occupies its own row;
- quantity, unit, price, discount, and VAT use a responsive detail grid;
- line total is visually anchored at the lower-right edge;
- narrow mobile uses two detail columns; tablet may use three or four.

The mobile order matches the desktop reading order. No duplicate visible
controls or horizontal page overflow is allowed.

## Notes And Totals

- Public notes and internal notes sit side by side on large desktop and stack
  below that breakpoint.
- Totals use aligned label/value pairs with quiet spacing.
- The grand total receives a strong top rule and heavier type; intermediate
  totals remain visually secondary.
- Amount-in-words stays directly below the grand total.
- The totals section is not sticky; it must not cover editable fields or create
  a second scroll container.

## Visual System

- **Structure:** Swiss grid and visible rules.
- **Expression:** technical minimalism with restrained editorial numbering
  (`01 ลูกค้า`, `02 ข้อมูลเอกสาร`, `03 รายการ`).
- **Product-native motif:** a working quotation ledger using real labels,
  values, totals, and document actions.
- **Color:** existing neutral theme plus one controlled blue accent for document
  IDs, edit links, and add actions. Save remains the existing dark primary.
- **Borders:** quiet 1px rules explain adjacency and sequence. Inputs retain a
  clear border; large rounded container cards are removed.
- **Radius:** small and consistent on interactive controls; sections themselves
  rely on rules, not rounded boxes.
- **Shadow:** none in the editor body.
- **Typography:** existing sans font; document number may use mono. Hierarchy is
  created primarily with weight, alignment, and spacing.

## Responsive Rules

### Large desktop (`xl`, 1280px and wider)

- Customer/document metadata: 7/5 tracks.
- Item ledger: full semantic table.
- Notes/totals: fluid left and fixed right.

### Laptop (`lg`, 1024–1279px)

- Metadata remains a 7/5 two-track grid.
- Item editing uses cards because the Admin Sidebar leaves insufficient ledger
  width for the `62.5rem` desktop table.
- Header actions may move non-primary actions into More; Save remains visible.

### Tablet (`sm` through `md`, 640–1023px)

- Customer and document metadata stack.
- Their internal field grids remain two columns where labels fit.
- Items use cards and totals follow notes.

### Mobile (below 640px)

- All metadata fields use one column, while compact item details use two.
- Seller strip wraps without truncating the seller identity beyond recognition.
- Header exposes Close and Save; Preview, Print, and future actions move to
  More.
- Touch actions meet the existing shadcn button target behavior.

## Validation And Errors

- Existing server field errors remain adjacent to the relevant control.
- Error summary links continue to focus controls through their existing
  `data-field` attributes.
- Invalid controls keep `aria-invalid` and a visible non-color-only indicator.
- Conditional fields retain their current value-clearing rules.
- Redesign work must not alter payload normalization or calculator behavior.

## Implementation Boundary

Use existing React, Tailwind, shadcn components, Lucide icons, and native table
and form behavior. No dependency or global theme change is required.

The primary implementation file remains
`components/admin/quotations/quotation-editor.tsx`. Keep small internal
components or shared class maps inside that file and use them only to remove
repeated geometry or keep mobile/desktop item composition understandable. Do
not refactor server logic or unrelated admin screens.

## Verification

Automated checks must cover:

- semantic field-size roles and the customer/document grid;
- fixed desktop ledger columns and responsive item cards;
- item action availability and ordering;
- conditional branch number behavior;
- field error placement and focus markers;
- unchanged Preview/Print/save/delete behavior.

Before completion run typecheck, lint, all tests, production build, and
`git diff --check`. Inspect the authenticated editor at narrow mobile, wide
mobile, tablet, laptop, and large desktop widths using realistic Thai content,
including long names and addresses.
