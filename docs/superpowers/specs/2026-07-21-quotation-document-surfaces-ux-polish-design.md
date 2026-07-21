# Quotation Document Surfaces UX Polish Design

**Date:** 2026-07-21

**Status:** Approved design, awaiting written-spec review

## Goal

Complete MVP 4 of the quotation UX polish by making Preview, Print, PDF, and
Public Read-only present the same supported document data consistently. Keep
the existing business rules, persistence, authorization, and document
rendering technologies.

## Scope

- Use the current Preview/Print presentation as the visual reference.
- Align PDF and Public Read-only with that reference where their rendering
  engines permit.
- Improve long-text wrapping, multi-page behavior, and failure feedback.
- Verify the existing saved-state and public-access boundaries.

This work does not add document status, customer acceptance, online signing,
payment processing, database changes, API changes, or dependencies.

## Architecture

`QuotationDocument` remains the HTML document presentation used by Preview,
Print, and Public Read-only. The existing normalized quotation document model
remains the shared data source for HTML and PDF output. The PDF renderer stays
separate and is aligned to the HTML reference without introducing another
rendering abstraction.

No surface may recalculate totals independently. All surfaces must preserve the
same section order, optional-content rules, labels, and formatted monetary
values for the data they support.

## Surface Behavior

### Preview

- Shows the current local draft.
- Uses the current Preview/Print layout as the visual reference.
- Keeps screen-only actions outside the document content.

### Print

- Uses the latest successfully saved quotation, including when a newer dirty
  draft exists.
- Uses A4 output and preserves document colors, borders, logos, and spacing.
- Does not produce a blank trailing page.

### PDF Download

- Uses the latest clean saved quotation only.
- Keeps the current PDF renderer and bundled Thai fonts.
- Matches the HTML reference in section order, labels, colors, spacing, and
  supported optional content as closely as the PDF engine permits.
- Does not return a partial or corrupted download after a rendering failure.

### Public Read-only

- Shows only the latest successfully saved quotation.
- Uses the same A4-proportioned document presentation as Preview/Print.
- On narrow screens, keeps the A4 width inside an intentional horizontal
  scrolling viewport instead of converting the document into cards or
  responsive sections.
- Invalid, deleted, or inaccessible tokens show a generic not-found state and
  do not expose internal data or error details.

## Typography And Pagination

- Thai text and long unbroken English or URL-like text wrap inside their
  assigned columns without clipping glyphs or overlapping adjacent content.
- Monetary values are right-aligned, comma-grouped, and shown with two decimal
  places consistently.
- Print and PDF keep an item row together when possible. If the remaining page
  cannot contain the item, the complete item moves to the next page; the
  resulting whitespace is acceptable.
- Table headings repeat on continuation pages.
- Payment groups and the certification row stay together when their rendering
  engine supports it.
- Pagination must be content-driven rather than based on a fixed document
  height or a hard-coded trailing page break.
- Optional document images may fail gracefully without breaking the document.
  A required Public QR failure prevents PDF creation and produces user-facing
  error feedback.

## Actions And Feedback

- Preview remains available for a valid draft.
- Print continues to use the latest successful save.
- Share and PDF Download remain available only for a clean saved quotation.
- Share, Print, and Download controls are screen-only.
- PDF generation disables repeated activation and displays
  `กำลังสร้าง PDF…` while pending.
- Share, Print, and PDF failures use Toast feedback and leave the quotation
  payload unchanged so the user can retry.

## Security And Data Boundaries

- Keep the current account ownership, quotation permission, RLS, public token,
  and trusted asset rules unchanged.
- Public Read-only never displays internal notes or private system errors.
- Public URLs and QR destinations continue to come only from the configured
  canonical public origin.
- This UX work does not add a new public endpoint or image proxy.

## Verification

Automated regression checks cover:

- shared section order and optional-content rules;
- draft Preview versus saved Print/PDF/Public behavior;
- clean-saved gating for Share and Download;
- Thai and long unbroken English wrapping;
- monetary formatting and alignment;
- item, payment, and certification page-break rules;
- required Public QR failure and generic public not-found behavior;
- screen-only document actions and print color preservation.

Manual acceptance uses representative one-page and multi-page quotations at
390, 768, 1280, and 1536 pixel viewports. It verifies intentional horizontal
scrolling for the A4 Public document on narrow screens, no unintended
page-level overflow elsewhere, no clipped or overlapping text, repeated table
headings, intact item rows, and no blank trailing Print/PDF page.

## Acceptance Criteria

- Preview/Print remains the visual reference and PDF/Public show the same
  supported data in the same order.
- Public mobile intentionally presents the A4 document in a horizontally
  scrollable viewport.
- Representative Thai text, long English text, large amounts, and multi-page
  item descriptions do not clip or overlap.
- Print/PDF keep item rows together when possible and produce no blank trailing
  page.
- Saved-state gates, public access, error feedback, and retry behavior remain
  correct.
- No database, API, authorization, calculation, dependency, or adjacent-module
  change is included.
