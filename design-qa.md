# Customer Master Toolbar Design QA

## Comparison input

- Reference: `C:\Users\POOLVI~1\AppData\Local\Temp\codex-clipboard-2ca02b60-a2d8-44ce-ae95-4378182e4eb6.png` (593 x 48 px).
- Implementation: `C:\Users\POOLVI~1\AppData\Local\Temp\webook-customer-toolbar-focused.png` (1136 x 32 px), captured at a 1440 x 900 desktop viewport.
- Mobile verification: `C:\Users\POOLVI~1\AppData\Local\Temp\webook-customer-toolbar-mobile.png` (375 x 812 px), captured from a 390 x 844 browser viewport.
- Route/state: `/admin/quotations/customers?q=เจเจ`, active-customer status.

## Interactions verified

- Status menu opens by click or keyboard and exposes exactly `ใช้งานอยู่` and `ปิดใช้งานแล้ว` as radio choices.
- Changing to inactive preserves `q=เจเจ` and adds `status=inactive`.
- Add Customer opens and closes the existing customer dialog.
- The total-count summary is absent.
- Mobile wraps search onto the first row and keeps status left/Add Customer right on the second row.
- Mobile document width stays within the viewport; browser console reports no errors.

## Visual findings and history

1. Initial combined reference/implementation comparison: no P0, P1, or P2 mismatch found.
2. The implementation intentionally maps the reference's compact muted filter-chip treatment to the approved single Thai status filter, while retaining the product's existing button, spacing, and typography tokens.
3. The Add Customer action intentionally remains the existing primary style and is aligned at the far right of the same toolbar.

## Previous QA record retained: quotation customer desktop row

- Source: `C:\Users\POOLVI~1\AppData\Local\Temp\codex-clipboard-bac2ef1f-3268-4c39-b119-6cb087009ed2.png` (759 x 96 px).
- Implementation: `C:\Users\POOLVI~1\AppData\Local\Temp\quotation-customer-desktop-tightened-1536x900.png` at a 1536 x 900 viewport.
- State: new quotation, customer office type `head_office`.
- Result: the tax, office, and branch controls share one desktop row with 12 px adjacent gaps; the existing responsive layouts had no horizontal overflow and no console errors.
- Finding: no actionable P0, P1, or P2 mismatch.

final result: passed
