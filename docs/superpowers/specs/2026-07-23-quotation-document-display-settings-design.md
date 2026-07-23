# Quotation Document Display Settings Design

Date: 2026-07-23

## Goal

Allow each user to control which quotation fields are available and displayed,
while preserving an independent snapshot on every quotation.

The setting covers:

1. อ้างอิงถึง — the existing `reference` field
2. หมายเหตุ — public document notes only
3. ส่วนลด — item discounts
4. หน่วย — item units
5. ภาษี — item VAT
6. มูลค่าก่อนภาษี — the displayed pre-tax total
7. หัก ณ ที่จ่าย — withholding tax

Internal notes are not part of these settings.

## User flow

The Create and Edit pages have a `ตั้งค่ารูปแบบเอกสาร` button in the top action
bar near Preview and Save. It opens a modal containing the seven switches.

The modal has two confirmation actions:

- `ใช้เฉพาะใบเสนอราคานี้` updates only the draft snapshot. It becomes
  persistent when the quotation is saved.
- `บันทึกเป็นค่าเริ่มต้นทุกใบ` saves the user's defaults immediately and
  applies the same settings to the current draft. Supporting text states
  `มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว`.

If saving the defaults fails, the modal stays open and the current draft is not
changed.

When turning off a setting would clear entered data, confirmation is required
before applying the change. The warning lists the affected setting names.

## Setting behavior

Turning a setting off hides its input from Create/Edit and hides the related
content from Preview, Print, PDF, and Public Share.

It also clears the related draft data:

| Setting | Cleared or changed value |
| --- | --- |
| อ้างอิงถึง | Clear `reference` |
| หมายเหตุ | Clear public document notes |
| ส่วนลด | Set every item discount to zero |
| หน่วย | Clear every item unit |
| ภาษี | Set every item to no VAT |
| หัก ณ ที่จ่าย | Clear the withholding-tax rate |
| มูลค่าก่อนภาษี | No data is cleared; this setting controls display only |

Cleared values are not restored when the setting is turned on again.

The pre-tax total remains part of calculation even while hidden. Disabled
discount, VAT, and withholding values do not affect calculation because their
source values are cleared.

When discount or tax is enabled but the quotation has no actual discount or VAT
data, final document surfaces continue to omit the empty column automatically.
An enabled setting permits the field; it does not force an empty column to
appear.

The quotation list is unchanged because it does not display these details.

## Data model

Use one shared JSON object with exactly seven boolean properties:

```ts
interface QuotationDocumentDisplay {
  discount: boolean;
  notes: boolean;
  preTax: boolean;
  reference: boolean;
  tax: boolean;
  unit: boolean;
  withholdingTax: boolean;
}
```

Add:

- `quotation_company_profiles.document_display_defaults jsonb not null`
- `quotations.document_display_snapshot jsonb not null`

Both columns default to all seven properties being `true`. The migration
validates that the value is an object containing exactly the supported boolean
properties. Existing profiles and quotations are backfilled to all enabled, so
existing documents retain their current behavior.

No new table or dependency is required.

## Data flow

When opening Create, the server copies the current user's display defaults into
the draft payload.

When opening Edit, the server reads only the quotation's saved snapshot. It
never merges the current user defaults into an existing quotation.

Saving a quotation validates the display object and persists the snapshot
atomically with the rest of the quotation. Saving defaults is a separate
owner-scoped action because `บันทึกเป็นค่าเริ่มต้นทุกใบ` must take effect
before the quotation itself is saved.

The public quotation response includes only the saved display snapshot. It does
not expose the user's defaults or internal notes.

## Rendering

`buildQuotationDocumentViewModel` is the shared authority for visibility on
document surfaces. HTML Preview/Print/Public and PDF consume the same flags.

The effective discount and VAT column flags combine the snapshot with the
existing data checks:

- discount column: setting enabled and at least one non-zero discount
- tax column: setting enabled and at least one item using VAT

Reference and public notes render only when their setting is enabled and their
value is non-empty. Unit, pre-tax total, VAT summary, and withholding summary
follow their corresponding snapshot settings.

## Authorization and validation

- Display defaults remain owner-scoped through the existing company-profile
  RLS model.
- The migration updates the existing column-level grants for the new profile
  column.
- The server validates the exact seven-property boolean shape at every write
  boundary.
- Public reads return only the quotation snapshot.
- A failed default save must not mutate the draft or clear any values.

## Verification

Automated checks cover:

- migration defaults, JSON validation, grants, and existing-row preservation;
- copying per-user defaults into a new quotation;
- existing quotations remaining independent of later default changes;
- each disabled setting clearing the correct draft values;
- pre-tax visibility not changing calculations;
- discounts, VAT, and withholding no longer affecting totals after being
  disabled;
- empty discount and VAT columns remaining automatically omitted;
- Create/Edit controls and Preview/Print/PDF/Public visibility;
- saved and public repository mappings;
- owner isolation and public-data boundaries;
- default-save failure leaving the modal and draft unchanged.

Responsive verification covers mobile, tablet, laptop, and desktop. The modal
uses existing Shadcn primitives and keeps both confirmation actions reachable
without horizontal scrolling.

## Out of scope

- Applying new defaults retroactively to saved quotations
- A bulk update tool for existing quotations
- Settings for internal notes
- New document fields or a second reference field
- Changes to quotation-list columns
