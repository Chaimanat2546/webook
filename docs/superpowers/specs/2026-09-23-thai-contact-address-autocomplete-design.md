# Thai Contact Address Autocomplete Design

## Goal

Improve the booking customer contact-address form for Thailand. Users enter their address detail and country manually, then may use a postal code to narrow Province, District, and Subdistrict choices. Every geographic selection remains editable.

The feature applies only to the customer contact address. The tax-invoice address remains an independent free-text field.

## User Flow

The address fields appear in this order:

1. Address detail
2. Country
3. Postal code
4. Province
5. District / area
6. Subdistrict / ward

Address detail and country are plain editable fields and are never auto-filled. Postal code accepts up to five digits. No lookup occurs until it contains exactly five digits.

When a postal lookup has one Province candidate, select it. When the selected Province leaves one District candidate, select it. When a candidate set is ambiguous, show the restricted searchable combobox and require the user to choose. Postal code narrows and prioritizes choices but never locks them.

Users may instead select Province, District, and Subdistrict manually without entering a postal code. Province selection clears District and Subdistrict. District selection clears Subdistrict. A selected Subdistrict updates Postal code only when its data has exactly one postal code; otherwise an existing entered value remains unchanged.

District is disabled until Province is selected; Subdistrict is disabled until District is selected. Unknown postal codes show a non-blocking help message and leave all address fields usable. An empty filtered combobox shows the existing Thai empty state, "ไม่พบข้อมูล".

## Data and Architecture

Vendor the GeoThai v4 geographic inputs locally, using its `geo.json` and `postal_lookup.json` data. Add a repeatable project script that produces a compact, typed generated dataset plus source metadata. Runtime code must never request GeoThai or another external address API.

Keep the geographic data behind a server-side repository/service boundary. It exposes contracts for:

- postal-code candidates;
- Province options;
- District options scoped to a Province, optionally narrowed by postal code;
- Subdistrict options scoped to a District, optionally narrowed by postal code; and
- resolution of persisted geographic names for existing customer edits.

Server Actions validate primitive lookup inputs and call this service. The client receives only the option lists needed for the active field and never imports the country-wide dataset.

The UI stores Province, District, and Subdistrict codes only as transient selection state. It maps selections to the existing customer fields (`province`, `district`, `sub_district`, `postal_code`) before existing customer creation/update actions run. This avoids a database migration and retains backwards compatibility with existing customer records.

## Components

Create a focused `ThaiContactAddressFields` client component under the booking customer feature. It owns selection state, lookup requests, combobox queries, cascading resets, accessible disabled states, loading indicators, and messages. It uses the existing shared Combobox primitives; no new UI dependency is introduced.

`BookingCustomerForm` supplies the current contact-address values and consumes the component's updates. It continues to own the form, review screen, validation, duplicate detection, save flow, and tax-address behavior.

## Existing Customer and Failure Handling

On edit, the component resolves persisted Thai names to codes where possible. If a legacy or manually entered value cannot be resolved, it remains visible and editable; no data is erased automatically.

Lookup input is validated server-side. Missing or invalid data yields a safe user-facing message without leaking underlying dataset errors. A failed lookup leaves the current form values intact and permits manual entry.

## Testing

Add unit tests for dataset normalization and each repository/service lookup contract. Cover unique and ambiguous postal candidates, hierarchical filters, postal-priority ordering, manual selection, parent-reset behavior, postal synchronization, unknown postal codes, and legacy-name resolution.

Add component/UI-contract tests for the stated field order, searchable combobox usage, disabled dependency states, and the unchanged booking customer save flow. Run typecheck, lint, the full test suite, and the production build.

## Non-goals

- Tax-invoice address autocomplete.
- House-number, road, map, or Google Places search.
- External address lookups at runtime.
- Schema changes to store geographic codes.
