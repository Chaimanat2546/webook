# Quotation Completion Collapse Design

## Goal

Reduce clutter in the quotation editor by collapsing the entire payment-and-certification block by default without losing draft state.

## Approved behavior

- Keep one section header labeled `ข้อมูลท้ายใบเสนอราคา`.
- Put one Shadcn button on the right of the header.
- The button reads `แสดง` while collapsed and `ซ่อน` while expanded.
- New and existing quotation editor sessions start collapsed.
- Expanding reveals the existing `ช่องทางชำระเงิน` and `การรับรอง` tabs and their current panel.
- Collapsing hides the tab list and panel together.

## State and accessibility

- Keep the existing tab content mounted while collapsed so payment drafts, certification drafts, and active uploads are not reset.
- Preserve the selected tab when collapsing and expanding.
- Connect the toggle to the collapsible region with `aria-expanded` and `aria-controls`.
- If save validation reports a payment-method error, expand the region and select `ช่องทางชำระเงิน`.
- If save validation reports a certification error, expand the region and select `การรับรอง`.

## Scope

Change only the quotation editor. Seller master settings, saved snapshots, Preview, Print, PDF, Public Read-only, API contracts, and database schema are unchanged.

## Verification

- Add a UI regression test for the collapsed default, the single toggle, mounted hidden content, and validation-driven expansion.
- Run typecheck, lint, the focused quotation UI test, and the full test suite.
- Verify the collapsed and expanded states on Mobile, Tablet, Laptop, and Desktop.
