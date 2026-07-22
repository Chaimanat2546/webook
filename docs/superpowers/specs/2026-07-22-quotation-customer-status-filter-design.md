# Quotation Customer Status Filter Design

Date: 2026-07-22

Status: Approved

## Goal

Replace the ambiguous active/inactive action-style buttons on Customer Master
with one compact status dropdown based on the supplied toolbar reference.

## Approved Design

- Show one compact trigger beside the customer search controls.
- The trigger reads `สถานะ: ใช้งานอยู่` or `สถานะ: ปิดใช้งานแล้ว` and includes a
  downward chevron.
- The menu contains exactly two choices: `ใช้งานอยู่` and `ปิดใช้งานแล้ว`.
- The selected choice has a visible check mark.
- Selecting a choice preserves the current search query and resets pagination
  to page 1.
- Reuse the existing Shadcn dropdown menu and current monochrome visual system.
- On narrow screens the trigger remains easy to tap and stays within the
  responsive search toolbar.

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
  and removal of the two action-style filter buttons.
- Verify active and inactive selections in the local browser at desktop and
  mobile widths.
