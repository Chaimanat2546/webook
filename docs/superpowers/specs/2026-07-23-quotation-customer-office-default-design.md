# Quotation Customer Office Default Design

Date: 2026-07-23

## Goal

Keep the office selection consistent with the customer type while creating
ข้อมูลลูกค้า.

## Approved Behavior

- The rule applies only to the Add Customer modal.
- Selecting `บุคคลธรรมดา` always sets the office type to `ไม่ระบุ`.
- Selecting `นิติบุคคล` always sets the office type to `สำนักงานใหญ่`.
- Switching customer type always overwrites any office choice made previously.
- Switching customer type clears the branch number because the automatic
  office values are never `สาขา`.
- Existing customer editing behavior remains unchanged because customer type
  is immutable after creation.
- Remaining user-visible legacy wording in this modal becomes `ข้อมูลลูกค้า`.

## Implementation

Handle the customer-type and office-type update together in the existing
customer-type radio change handler. Do not add an effect, dependency, or new
abstraction.

## Verification

- Add a regression assertion for both automatic office mappings and branch
  clearing.
- Run the customer UI test, typecheck, lint, and the full test suite.
- Verify the two customer-type selections in the local Add Customer modal.

## Out Of Scope

- Locking or hiding the office selector.
- Changing saved customers or database constraints.
- Changing quotation snapshot behavior.
