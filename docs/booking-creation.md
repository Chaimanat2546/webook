# Booking creation

House calendars support the Create booking button and clicking an available day. The existing Sheet form is reused; a saved customer is required and can be selected or created from the customer picker. New bookings default to waiting, and may be confirmed. Cancelled bookings remain hidden.

The route supplies the house property ID. Server Actions enforce allow_booking, validate the draft, and call the service/repository. Nights are computed from checkout minus checkin. price_max is the full stay price, price_sell the required deposit, and extra_charge the additional amount; changing dates does not reprice. deposit_amount is not written.

The service-role-only admin_create_house_booking RPC resolves listing_id from property_id, relies on the customer foreign key and existing overlap constraint, records the actor, and derives nights independently. A UUID request ID retained for the lifetime of the form makes retries idempotent. RLS is unchanged. Migration: 20260921090000_create_house_booking.sql.

## Verification

`npm run verify`: 646 passed, 1 opt-in test skipped. Staging transaction tests verified missing/nonexistent customer rejection, single-record retries, overlap rejection, three money fields, calculated nights, and INSERT audit actor; fixture writes were rolled back. Build and Staging deployment passed.

## Availability range picker

Creation and editing share an inline FullCalendar date-range selector. Click check-in then exclusive checkout; occupied nights show red (confirmed) or green (waiting). Any noncancelled booking blocks selection, except the booking being edited. Checking out on another booking’s check-in is permitted. Selection cannot cross occupied nights. The picker fetches the visible calendar and entire selected span in at-most-62-day requests, blocks saving while loading or after a failed load, and refreshes after server save failures while retaining form values. Server overlap constraints remain the final concurrency guard. No new dependency, migration, or RLS change.

The range picker uses full-cell targets, occupied-night colors, numbered check-in/check-out steps, continuous blue selection and endpoint labels. A valid later day completes checkout; another free day starts a new range. The check-in step also resets selection and the checkout step retains check-in. Thai short dates and nights summarize the selected stay.

Past dates are disabled using the Asia/Bangkok calendar day. Server services reject backdated creation, rescheduling, and reactivation. Existing active bookings may retain their original historical stay dates when editing other information; cancellation remains available. Today is allowed.

Statuses: confirmed is โอนแล้ว (red), waiting is รอโอน (green), cancelled remains ยกเลิก and hidden. repair is ปิดซ่อม/ปรับปรุง (gray), requires dates and optional note only, blocks availability, and stores customer_id null and price_max/price_sell/extra_charge zero; deposit_amount remains untouched. Changing a booking to repair clears its customer and editable money values on save. Changing repair back to a booking requires selecting a customer. Migration 20260921100000 extends the existing RPC status allowlists without changing RLS.

Cancellation is available through the trash icon beside Close on saved records, with a shadcn confirmation dialog. Cancelled is removed from the status selector. The action accepts ID and expected revision only, loads persisted values, checks authorization/house/revision, and sets cancelled without saving unsaved form edits. The record remains stored; the calendar refreshes and shows a toast.

New forms prefill check-in only and leave checkout empty, placing the picker immediately in checkout selection mode. This allows choosing a checkout on the next booking start without first clearing an automatically selected one-night stay.
## Customer picker and creation (2026-09-22)

- The booking customer section uses the existing shadcn Combobox, matching the quotation interaction: five recently created customers on open, name/phone search from two characters, and selected name/phone below the input.
- Successful empty search offers **เพิ่มลูกค้าใหม่** in a Dialog. Required fields are first name and phone; last name is optional. Saving creates a `customers` row and selects it for the booking. The booking itself is saved separately; discarding the booking does not delete the customer.
- Customer creation uses the booking server authorization (`allow_booking`) and validates the house before accessing customer data. It does not use `quotation_customers` or require quotation permissions.
- Only `first_name`, `last_name`, and `phone` are writable. Thai +66 and local phone formatting are normalized; existing matching phones are offered for selection without overwriting them. This is an application preflight check, not a new database uniqueness guarantee: simultaneous creates from separate sessions can still race.
- Changing a selected customer requires confirmation. Unsaved customer input has a discard Dialog; pending saves prevent closure and repeated submission. Search/create failures preserve input and selection, with operation notifications via toast.
- No schema, RLS, or dependency changes. The picker is embedded in the existing booking editor; House Workspace Shell structure and control order stay unchanged.

Validation for the customer flow: typecheck/lint and 659 tests completed (658 passed, one opt-in skipped). Browser checks against Staging data verified create-and-select, formatted-phone duplicate selection (one persisted fixture), discard and replacement confirmation, first-character keyboard input, and five recent results within a 390px viewport. The shared Combobox accepts an optional portal container so its popup stays inside the booking Sheet focus scope; existing callers keep the default portal behavior.

## Booking loading skeletons (2026-09-22)
The booking route uses a House Workspace Shell loading fallback. Calendar fetches (initial, month change, refresh), editor detail fetches, availability fetches, and customer searches use the existing shadcn Skeleton. Calendar instances stay mounted beneath noninteractive, hidden content while loading to preserve their view and avoid repeating datesSet fetches. Skeletons respect reduced motion and announce status for assistive technology. Availability failures are keyed to the current request so retry shows loading and failed requests show the error instead of an endless skeleton. Mutation buttons retain their pending labels and entered values; no schema or dependencies change.


## Full customer details within bookings (2026-09-22)

The selected customer card opens a full edit Dialog; the create Dialog uses the same grouped form. General, contact, identity, address, tax, and additional sections cover every business field of `customers`. Name and primary phone are required; optional values are validated when provided. `dv_id` is deliberately excluded at the user's request. IDs and timestamps are system-managed. Detail fetches use Skeleton with retry; mutation progress, duplicate selection, and discard confirmation remain available.

Updates load the current customer and require its `updated_at` revision; the repository also compares that revision atomically on update and advances it. Only parsed input fields are written, so omitted fields, `dv_id`, and `created_at` survive. Customer edits update the shared customer record, affecting all bookings referencing it; booking draft changes are saved separately. Summary searches and calendar joins still return only ID/name/phone; full personal information is fetched only when the editor opens, behind booking authorization.

Juristic customers can look up a tax ID through the existing DBD service. The response previews company name, address, and DBD status; the operator explicitly applies the company name and tax address. DBD failure preserves entered values and permits manual entry. No persistent DBD verification flag is claimed because the existing `customers` schema has no verification fields. No RLS, schema, or dependency changes.

Full-form validation: typecheck/lint and 662 tests completed (661 passed, one opt-in skipped). Browser testing against Staging data saved optional contact/address/VIP/notes on the named synthetic customer, verified persistence after reopening, and checked the 390px layout with pinned dialog header/footer. DBD shares the existing tested adapter; the booking UI was checked for invalid-tax-ID error preservation.


## Customer ownership by house (2026-09-22, supersedes earlier dv_id exclusion)

`customers.dv_id` is the owning house's `listings.property_id`. New customers receive it from the server-resolved route house; browser input cannot choose or change it. Customer search/recent results, phone duplicate detection, detail lookup and updates filter by this house. Two houses may create separate customers with identical names or phone numbers. Both the query and update revision guard include the ownership predicate. Booking create/save validates the chosen customer belongs to the house; the service-role RPC is reached only after this check. Customer ownership is immutable through these app actions. Calendar joins omit customer details for mismatched/unassigned historical references.

The user explicitly chose no legacy backfill. Existing customers, including null `dv_id`, and existing booking references are not reassigned or copied. Unassigned customers no longer appear in house searches; editing a booking that references one requires choosing a house-owned customer before saving. Cancellation remains available and retains its persisted customer reference. No RLS, schema, or migration changes.

### Customer form layout update

- Title uses a dropdown with common Thai and English titles; existing custom titles remain visible and are preserved.
- Preferred language uses Thai (`th`) and English (`en`) options. Existing unsupported values are preserved until explicitly changed.
- ID card and passport fields appear under general information; tax information precedes the address section.

### Booking DBD lookup interaction

For juristic customers, the tax section opens automatically and the lookup button sits beside the 13-digit tax ID. New customers receive company name and tax invoice address immediately after a successful lookup. Editing existing customers refreshes the preview without overwriting edits; Reset to DBD explicitly applies the returned name and address. Status and lookup time are shown for the current form session. Lookup failure preserves input and reports via toast. Changing the tax ID or customer type clears the preview. Verification metadata is not persisted in customers.

### Compact customer form sections

Section order: general information, tax information, contact, address, additional information. Dropdowns use compact content-width controls; customer type and office labels sit beside their controls and wrap on narrow screens.

The tax section opens by default for both customer types. General information places title, first name, and last name together on desktop (with a narrow title column), followed by nationality/birth date and ID card/passport pairs. The name row stacks on mobile.

### Guided customer form and confirmation

Creation and editing now use five sequential sections with connected icon navigation: general, tax, contact, address, additional. Next does not add validation; existing validation runs only on final confirmation. Reached sections remain accessible, and values survive navigation. The final save button opens a complete read-only summary (empty values display ไม่ระบุ); only Confirm Save performs the mutation. Returning to edit retains the draft. Juristic customers show contact names and hide personal identity inputs, preserving existing values, which remain visible in the summary. Copy Tax Address explicitly replaces the full contact address and clears stale structured address parts. DBD, house ownership, duplicate handling, and revision checks remain unchanged.

Customer form visual hierarchy: navigation uses small neutral outlined icons and thin connectors; the current section heading and spaced input fields provide the primary emphasis.
