# Quotation Customer Status Filter Design

Date: 2026-07-22

Status: Approved

## Goal

Replace the ambiguous active/inactive action-style buttons on ข้อมูลลูกค้า
with one compact status dropdown based on the supplied toolbar reference.

## Approved Design

- Use one responsive toolbar container for search, status, and customer
  creation controls.
- On desktop, order the toolbar as search, status dropdown, flexible space,
  then `เพิ่มลูกค้า` at the far right.
- On narrow screens, the same toolbar may wrap into two rows while keeping the
  status control on the left and `เพิ่มลูกค้า` on the right of the action row.
- Show one compact status trigger beside the customer search controls.
- The trigger reads `สถานะ: ใช้งานอยู่` or `สถานะ: ปิดใช้งานแล้ว` and includes a
  downward chevron.
- The menu contains exactly two choices: `ใช้งานอยู่` and `ปิดใช้งานแล้ว`.
- The selected choice has a visible check mark.
- Selecting a choice preserves the current search query and resets pagination
  to page 1.
- Reuse the existing Shadcn dropdown menu and current monochrome visual system.
- On narrow screens the trigger remains easy to tap and stays within the
  responsive search toolbar.
- Remove the `ทั้งหมด n รายการ` summary above the customer list.
- Keep the existing add-customer dialog and its behavior unchanged.

## Accessibility

- Use a button trigger with an accessible status-filter label.
- Preserve keyboard navigation, focus handling, and selected-state semantics
  supplied by the existing Shadcn dropdown menu.

## Out Of Scope

- An `ทั้งหมด` status.
- Additional project, assignee, attachment, or date filters from the reference.
- Changes to row-level activate/deactivate actions or database behavior.

## Verification

- Source test covers the dropdown trigger, both choices, query preservation,
  removal of the two action-style filter buttons, the rightmost add-customer
  action, and removal of the total-count summary.
- Verify active and inactive selections in the local browser at desktop and
  mobile widths.
