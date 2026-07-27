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

- Add a read-only `public.quotation_item_catalog` table with `name text primary key` and a positive, unique `sort_order smallint`.
- Insert the five catalogue rows in display order in the schema migration so every deployed environment receives them.
- Do not duplicate a default-description column because the default always equals `name`.
- Enable RLS, grant `SELECT` only to `authenticated`, and allow reads only through the existing quotation-permission policy helper. Do not grant application writes or add write policies.
- Add a `NOT VALID` foreign key from `quotation_items.name` to the catalogue. Existing unsupported names remain readable, while new or reinserted rows must use the catalogue.
- Load the ordered catalogue through the existing server repository layer for both new and edit pages. Do not query Supabase from the client component.
- Render `ชื่อรายการ` as a native select using the editor's existing select styling. Do not allow free-text entry.
- Keep a blank placeholder for new rows so the existing required-field flow remains intact.
- Selecting or changing the name replaces the editable description with that name every time.
- On save, fetch the catalogue server-side after the permission check and validate submitted names against it. Do not trust catalogue values sent by the client.
- Existing quotations with unsupported item names show a disabled legacy option and must choose one of the five values before the next save.

## Validation and Errors

An empty or unsupported name produces an item-name field error and blocks saving. The foreign key also rejects unsupported names sent directly to the save RPC. A catalogue read failure uses the existing server error flow and does not silently fall back to hard-coded values. Other quotation behavior is unchanged.

## Tests and Documentation

- Add migration tests for the table, five ordered rows, explicit grants, RLS policy, read-only access, and `NOT VALID` foreign key.
- Add repository/action tests for ordered catalogue loading and server-side validation.
- Add UI regression checks for server-side hydration, the select, and description replacement.
- Add service and database integration tests accepting catalogue values and rejecting unsupported names.
- Update quotation documentation to replace the deferred free-text behavior.

## Out of Scope

- Admin catalogue CRUD
- Changes to saved print/public snapshots before an admin saves the edited quotation
- New dependencies or custom select components
