# Quotation Item Catalogue Design

## Scope

Replace the quotation item's free-text `ชื่อรายการ` input with a selection limited to these five values:

1. `ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)`
2. `ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)`
3. `ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)`
4. `ค่าบริการ`
5. `ประกันความเสียหาย`

`รายละเอียด` remains editable. Selecting or changing `ชื่อรายการ` always replaces `รายละเอียด` with the selected value.

## Implementation

- Keep the five allowed names in one shared exported constant in the existing quotation calculator module.
- Render `ชื่อรายการ` as a native select using the editor's existing select styling. Do not allow free-text entry.
- Keep a blank placeholder for new rows so the existing required-field flow remains intact.
- Validate the submitted name against the same shared list in the quotation service.
- Do not add a database constraint or migration. This intentionally enforces the catalogue at the application UI and server-service boundaries only.
- Existing quotations with unsupported item names show an unselected value and must choose one of the five values before the next save.

## Validation and Errors

An empty or unsupported name produces the existing item-name field error and blocks saving. Other quotation behavior is unchanged.

## Tests and Documentation

- Add a UI regression check for the select, its five values, and description replacement.
- Add service tests accepting catalogue values and rejecting unsupported names.
- Update quotation documentation to replace the deferred free-text behavior.

## Out of Scope

- Database-level constraints or migrations
- Changes to saved print/public snapshots before an admin saves the edited quotation
- New dependencies or custom select components
