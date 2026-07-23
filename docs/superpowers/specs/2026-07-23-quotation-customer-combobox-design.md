# Quotation Customer Combobox Design

**Date:** 2026-07-23  
**Status:** Approved design, pending implementation plan

## Goal

Require every new quotation to select an active customer from `ข้อมูลลูกค้า`.
The quotation editor must not accept independently typed customer identity
details.

## Scope

- Replace the customer selection entry point in the quotation editor with a
  searchable Combobox.
- Reuse the existing customer search, customer creation form, and quotation
  customer snapshot contract.
- Keep existing quotations snapshot-based.
- Do not change the customer database identity rules, DBD flow, dependencies,
  or database schema unless implementation discovery proves an existing query
  cannot return the approved ordering.

## Interaction

### Initial state

- Opening the Combobox immediately shows the five most recently updated active
  customers, ordered by `updated_at` descending.
- Each option shows name, tax ID, and office.
- Inactive customers are never selectable.

### Search

- Search accepts customer name or exact/partial tax ID.
- Zero input shows the five recent customers.
- One character does not send a search request and prompts the user to enter at
  least one more character.
- Two or more trimmed characters run the existing active-customer search.

### No result and create

- An empty result shows `ไม่พบลูกค้า` and an `เพิ่มลูกค้าใหม่` action inside the
  Combobox.
- The action opens the existing Add Customer modal.
- A customer must be saved successfully to `ข้อมูลลูกค้า` before it can be
  selected.
- After a successful save, the new customer is selected automatically and the
  modal closes.
- A failed save keeps the modal open and preserves its field errors.

### Selected state

- After selection, replace the Combobox with a compact customer summary card.
- The card shows name, tax ID, office, and address.
- The only selection action is `เปลี่ยนลูกค้า`; the editor does not offer a
  clear-to-empty action because a quotation requires a customer.
- If customer snapshot fields already contain data and a different customer is
  chosen, require confirmation before replacing them.

## Data behavior

- Selecting a customer copies only name, address, tax ID, office type, and
  branch number into the quotation snapshot.
- Later customer-data edits do not modify saved quotation snapshots.
- Creating a customer from the Combobox follows all existing validation, DBD,
  duplicate, inactive-customer, and reactivation rules.

## Loading and errors

- Show a loading state inside the Combobox while recent customers or search
  results are loading.
- A load/search failure shows an inline error and `ลองใหม่`; it must not appear
  as a successful empty result.
- Preserve the current selected customer when a replacement search fails or is
  cancelled.
- Prevent stale search responses from replacing results for a newer query.

## Responsive and accessibility

- On mobile, the option list uses full-width rows and the summary card stacks
  its actions below the customer details.
- On tablet and desktop, the Combobox and summary remain within the existing
  quotation customer section.
- Support keyboard navigation, visible focus, accessible labels, loading/error
  announcements, and Escape to close without changing the selection.

## Verification

- Opening shows exactly five recent active customers.
- Fewer than two typed characters do not trigger search.
- Name and tax-ID searches return selectable active customers.
- No result can create, save, and auto-select a customer.
- Failed create/search states preserve user input and existing selection.
- Selecting or replacing a customer copies only the approved snapshot fields.
- Existing saved quotations retain their stored snapshot.
- Verify mobile, tablet, laptop, and desktop layouts.

## Out of scope

- Selecting inactive customers.
- Editing customer identity directly inside a quotation.
- Synchronizing old quotations after customer-data changes.
- Adding new customer fields or changing DBD verification rules.
