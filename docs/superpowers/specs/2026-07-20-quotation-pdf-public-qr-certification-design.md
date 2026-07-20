# Quotation PDF, Public QR, And Certification Design

**Date:** 2026-07-20

**Status:** Approved for implementation planning

## Goal

Complete the next quotation MVP slice with a direct PDF download, a Public
Read-only QR on saved documents, and reusable seller certification data. Keep
the quotation editor focused on frequent work by moving payment and
certification overrides into tabs below the notes rather than showing them as
permanent full-width sections.

## Scope

This change covers:

- one primary certification set per authenticated account;
- issuer, approver, and company-stamp master data;
- a certification snapshot editable on each quotation;
- a blank receiver signing area on the rendered document;
- a saved-document Public URL QR;
- direct client-side PDF download;
- consistent document data across Preview, Print, PDF, and Public Read-only;
- responsive quotation-editor tabs for payment and certification overrides;
- database migration, RLS boundaries, validation, and failure handling.

This change does not add customer acceptance, electronic signing, approval
workflow, document status, revision history, Public-link expiry, passwords,
token rotation, payment collection, or signature audit evidence.

## Data Model

### Certification Master

Add these nullable scalar columns to `quotation_company_profiles`:

- `issuer_name`;
- `issuer_position`;
- `issuer_signature_url`;
- `approver_name`;
- `approver_position`;
- `approver_signature_url`;
- `company_stamp_url`.

These values have a fixed one-to-one relationship with the account-owned
seller profile. Seven direct columns are simpler than another one-row table or
an untyped master JSON object and continue to use the existing seller-profile
ownership and RLS boundary.

The master is optional. A user may save a profile without either signer or a
stamp.

### Quotation Snapshot

Add `certification_snapshot jsonb not null default '{}'::jsonb` to
`quotations`. Its canonical shape is:

```json
{
  "issuer": {
    "name": null,
    "position": null,
    "signature_url": null
  },
  "approver": {
    "name": null,
    "position": null,
    "signature_url": null
  },
  "company_stamp_url": null
}
```

A new quotation copies the current account master into this snapshot. Editing
the snapshot affects only that quotation. Later master changes never rewrite
saved quotations.

The receiver area is a blank document affordance and is not stored. A QR image
is also not stored; it is derived from the quotation's existing
`public_token`.

### Migration Boundary

Create a new migration. Do not edit prior migrations or reset data. The
migration must:

- add the seven nullable profile columns;
- add the quotation snapshot column and an object-shape check;
- extend the existing quotation save transaction/RPC to validate and save the
  certification snapshot atomically with the quotation;
- extend authenticated reads and the isolated Public token lookup with the
  saved certification snapshot;
- preserve all existing quotations, document numbers, seller snapshots,
  payment snapshots, and bank data.

No signer table, receiver table, QR table, or generic document-asset table is
introduced in this MVP.

## Master Settings Flow

The seller-settings sidebar gains **ข้อมูลรับรองหลัก** alongside the existing
seller and payment sections. It contains:

- issuer name, position, signature upload, preview, replace, and remove;
- approver name, position, signature upload, preview, replace, and remove;
- company-stamp upload, preview, replace, and remove;
- a section-owned **บันทึกข้อมูลรับรอง** action.

All fields are optional. Selecting an image shows a local preview before save.
Removing or replacing a pending image does not alter the saved master until a
successful save. Each signer name and position uses a normal intrinsic-width
text control rather than stretching across the page.

## Quotation Editor Composition

The editor remains a full-width responsive Document Workbench. A4 remains
exclusive to Preview and Print/PDF output.

Remove the permanent numbered `04 ช่องทางชำระเงิน` block and do not add a
numbered certification block. The completion area becomes one coherent region:

```text
┌──────────────────────────────────────────┬──────────────┐
│ หมายเหตุบนเอกสาร │ หมายเหตุภายใน        │ สรุปราคา     │
│──────────────────────────────────────────│              │
│ ช่องทางชำระเงิน | การรับรอง              │              │
│ เนื้อหาของ Tab ที่เลือก                  │              │
└──────────────────────────────────────────┴──────────────┘
```

The tab labels are:

- **ช่องทางชำระเงิน** — selected by default;
- **การรับรอง**.

The payment tab reuses the existing per-quotation payment snapshot editor and
changes only its placement. The certification tab edits the quotation's
issuer, approver, signature, and stamp snapshot. It never writes changes back
to the master automatically. Switching tabs must preserve unsaved local form
state and follow standard keyboard tab behavior.

On desktop, the two notes and tab content occupy the main grid while the totals
remain aligned in the right column. On mobile, the region recomposes in this
order:

1. document note;
2. internal note;
3. totals;
4. tab bar;
5. selected tab content.

The mobile layout has no page-level horizontal overflow and does not create
nested decorative cards. Quiet rules, compact labels, and the existing single
accent color provide hierarchy.

## Saved And Unsaved Behavior

- Preview reflects the current editor state, including unsaved changes.
- Public Share and direct PDF Download require a saved quotation.
- When a saved quotation becomes dirty, Share and Download are disabled with
  the message **บันทึกการเปลี่ยนแปลงก่อน**.
- The Public QR is shown only when the quotation is saved and clean, preventing
  a QR beside unsaved content from opening an older saved document.
- Saving successfully re-enables Share and Download and regenerates the QR/PDF
  from the newly saved snapshot.
- Public Read-only always shows the latest successful save and never exposes
  unsaved editor state.

## Document Certification Layout

Preview, Print, PDF, and Public Read-only render three signing slots:

1. ผู้ออกเอกสาร;
2. ผู้อนุมัติ;
3. ผู้รับเอกสาร.

The first two slots show the saved signature, name, and position when present.
Their displayed date is the quotation `issue_date`; there is no independent
signature-date field. Missing optional values leave a clean signing space
rather than displaying placeholders.

The receiver slot always leaves space for a manual signature, name, position,
and date. It has no online input in this MVP.

The company stamp is rendered near the seller-side signer area without
obscuring names, dates, or signatures. Signature and stamp images use
aspect-ratio-preserving `contain` behavior and are never stretched.

The Public QR appears immediately before the signing row with the label
**สแกนเพื่อดูเอกสารออนไลน์**. It points to `/q/{public_token}` on the
application's configured public origin. The certification block stays together
when space permits and moves to the next page rather than splitting signer
slots across pages.

## PDF Architecture

Use the installed `@react-pdf/renderer` package for client-side PDF generation
and `qrcode` for Public URL QR generation.

- Preview/Print/Public and PDF consume one normalized quotation document view
  model so text, ordering, amounts, and optional-section decisions agree.
- The existing HTML `QuotationDocument` remains responsible for Preview,
  browser Print, and Public Read-only.
- A separate React PDF A4 composition is required because DOM/CSS components
  cannot be reused directly by the PDF renderer.
- Lazy-load the PDF composition and renderer only when Download is used.
- Bundle local open-licensed Noto Sans Thai regular and semibold font files and
  register them with the PDF renderer. PDF creation must not depend on a font
  CDN or network request.
- Generate the QR from the saved Public URL at render time; do not persist its
  Data URL or bitmap.
- Download as `{document_number}.pdf`, for example
  `QO-20260720-0001.pdf`.
- Item, payment, QR, and certification blocks paginate without clipping,
  overlapping, or producing an empty trailing page.
- Long Thai and unbroken English content must wrap within its column; money
  keeps thousands separators and remains right aligned.

During generation, disable repeated Download activation and show
**กำลังสร้าง PDF…**. A generation failure restores the action, displays a
clear retry message, and does not download a partial or corrupt file.

## Image Handling

- Signature and stamp inputs accept PNG, JPEG, and WebP source files up to
  2 MB.
- Empty files, SVG, unsupported MIME types, and oversized files are rejected
  at the client and server trust boundaries.
- Reuse the existing quotation Canvas/image upload path to normalize accepted
  files to lossless PNG for document transparency and consistency.
- Store only trusted Media Worker URLs. Arbitrary remote image URLs are not
  accepted.
- Upload failure retains the previous saved image and snapshot.
- A missing or unavailable optional image does not prevent Preview, Public, or
  PDF rendering; the text and blank signing area remain usable.
- The existing seller-logo WebP behavior is unchanged.

## Security And Public Access

- Certification masters remain scoped to `auth.uid()` through the existing
  account-owned seller profile and RLS policies.
- An authenticated quotation save may update only a quotation owned by the
  current account and may not substitute another account's company profile.
- Certification snapshot validation occurs inside the same server/database
  trust boundary as the quotation save.
- Public Read-only remains an isolated server-side token lookup. It does not
  grant anonymous access to seller masters, quotation tables, payment tables,
  or certification masters.
- The existing random UUID `public_token`, not `document_number`, identifies a
  Public document.
- Missing, invalid, or soft-deleted quotations return 404 from Public
  Read-only. A soft-deleted quotation becomes inaccessible immediately.
- Public output excludes internal notes and exposes only fields deliberately
  included in the saved document response.
- Client-side PDF generation receives no service-role key, storage credential,
  or additional private account data.

Public-token expiry, password/OTP access, access logs, and token rotation are
deferred until a real requirement exists.

## Validation And Failure Handling

- The certification snapshot must be a JSON object with only the canonical
  issuer, approver, and stamp fields accepted by the application validator.
- Optional names and positions are trimmed; empty values normalize to `null`.
- Asset URLs normalize to `null` when absent and must pass the existing trusted
  Media Worker URL rule when present.
- Master and quotation validation use the same field limits and URL rules.
- Quotation, item, payment, and certification snapshot writes remain atomic.
- QR generation failure prevents PDF download and reports a retryable error.
- PDF generation failure leaves the editor and saved quotation untouched.
- A missing optional certification image degrades to text/blank space rather
  than failing the whole document.

## Verification

Automated checks must cover:

- account isolation for certification-master reads and writes;
- master-to-new-quotation snapshot copying;
- per-quotation edits not changing the master or another quotation;
- saved certification snapshot round-tripping through authenticated and Public
  reads;
- rejection of malformed snapshots, untrusted asset URLs, empty files,
  unsupported formats, and files over 2 MB;
- Public lookup returning 404 for invalid and soft-deleted tokens;
- Share and Download availability for new, saved-clean, and saved-dirty editor
  states;
- QR generation using the exact saved Public URL;
- PDF filename and saved document data;
- long Thai and unbroken English wrapping;
- multi-page item/payment content without clipping or a blank trailing page.

Visual verification must cover mobile, tablet, laptop, and desktop editor
layouts and render representative PDFs to images for inspection. Verify Thai
font rendering, thousands separators, image aspect ratios, QR legibility,
three signing slots, page breaks, and similarity between Preview, Print, PDF,
and Public Read-only for the data each surface supports.

Before completion, run the project's typecheck, lint, unit tests, and relevant
browser/PDF checks.

## Implementation Boundary

Reuse the existing seller-settings navigation, seller profile, quotation save
transaction/RPC, payment snapshot editor, Public token route, shared document
view model, Media Worker validation, Canvas PNG normalization, and installed
UI primitives. Add only the certification fields/snapshot, responsive tabs,
Public QR, local PDF layout, and verification required by this MVP.

Do not add a generic signer service, approval engine, e-signature provider,
document version store, PDF microservice, QR database table, or new asset
abstraction.
