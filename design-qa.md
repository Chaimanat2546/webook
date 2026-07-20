# Quotation Certification Layout Design QA

- Source visual truth: `C:\Users\POOLVI~1\AppData\Local\Temp\codex-clipboard-b0383ec2-5e46-4557-8378-0cd3a1293411.png`
- Implementation screenshot: `C:\Users\POOLVI~1\AppData\Local\Temp\quotation-certification-preview-1280.png`
- Public Read-only screenshot: `C:\Users\POOLVI~1\AppData\Local\Temp\quotation-public-viewport-1280.png`
- Focused side-by-side comparison: `C:\tmp\quotation-certification-comparison.png`
- Viewports checked: 390, 768, 1280, and 1536 CSS pixels
- State: saved quotation Preview and token-scoped Public Read-only document

## Full-view comparison evidence

The rendered A4 document keeps notes immediately above one ruled certification
row. The row uses the approved order: Public QR, issuer, approver, company
stamp, and customer receiver. Preview and Public Read-only use the same shared
renderer. At 390 and 768 pixels, the fixed A4 document scrolls inside its
document container; the page itself does not gain horizontal overflow. At 1280
and 1536 pixels, the row remains unchanged and fits the available document
surface.

## Focused region comparison evidence

The focused comparison places the supplied reference on the left and the
implementation on the right. Both use a compact horizontal document grid,
top-aligned labels, contained QR/stamp assets, aligned signing baselines, and a
customer receiver at the far right. Dynamic content differs because the local
quotation has different customer/signer data. The local signer image URLs are
currently unavailable, and the specified optional-image fallback correctly
leaves their signing areas clean without changing the grid.

## Required fidelity surfaces

- Fonts and typography: existing quotation type scale, Thai font, weights, and
  wrapping are preserved; long values remain bounded by their slot.
- Spacing and layout rhythm: the 16 mm section-title rail and five equal content
  tracks align with neighboring document sections and the reference density.
- Colors and visual tokens: the existing neutral rules, text colors, and white
  paper surface are unchanged.
- Image quality and asset fidelity: QR, signatures, and stamp use the existing
  real assets with aspect-ratio-preserving `contain`; no placeholder or CSS art
  was introduced.
- Copy and content: labels match the approved Thai copy; positions are absent;
  the receiver uses the saved customer name and leaves signature/date blank.

## Findings

No actionable P0, P1, or P2 visual differences remain.

## Primary interactions and runtime checks

- Opened a saved quotation Preview from the document action menu.
- Opened the same saved quotation through `/q/{public_token}` without admin UI.
- Confirmed the five-slot order and absence of position text in both surfaces.
- Confirmed the row height/order remains stable at all four required widths.
- Checked browser warning/error logs; none were reported.

## Comparison history

The first comparison found no actionable P0/P1/P2 issue, so no visual-fix
iteration was required.

## Residual test gap

The in-app browser did not expose the programmatic PDF download as a browser
download event, so this QA pass could not rasterize the newly downloaded file.
The mirrored React PDF source contract, PDF tests, typecheck, and production
build all pass; PDF pagination remains covered by the existing automated
contract.

final result: passed
