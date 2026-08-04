# Quotation Document Templates Design

Date: 2026-08-04

## Goal

Add three selectable quotation document templates while preserving all existing
quotation data, calculations, visibility settings, document surfaces, and
authorization boundaries.

The template catalogue is fixed and type-safe:

1. `current` — the existing Indigo quotation document, preserved without a
   visual change.
2. `hospitality` — a premium accommodation-oriented layout using dark green
   and warm gold.
3. `corporate` — a formal procurement-oriented layout using navy and gray.

Each quotation stores an independent template snapshot. Each account also has
a default used to initialize future quotations. Changing the account default
must never alter a saved quotation.

## Success Criteria

- A user can select any of the three templates for an individual quotation.
- A user can save the selected template as the account default for future
  quotations.
- Preview reflects the current draft template immediately.
- Print, PDF, and Public Read-only use the latest saved template snapshot.
- All three templates support every existing public quotation field and the
  existing ten document-display settings.
- Existing quotations and accounts are backfilled to `current`, so their
  appearance does not change after migration.
- Template selection does not mutate quotation content, calculations, payment
  methods, certification data, or display settings.

## Template Selection Experience

Create and Edit add a `เทมเพลต` action near the existing
`ตั้งค่ารูปแบบเอกสาร` action. It opens a modal containing three selectable
thumbnail cards:

- Current
- Hospitality
- Corporate

The currently selected card and the account-default card have separate
`กำลังใช้` and `ค่าเริ่มต้นของบัญชี` indicators. The modal uses existing
Shadcn/Radix `Dialog`, `RadioGroup`, and `Card` primitives. A dropdown is not
used because the thumbnails and side-by-side comparison are material to the
choice. No new UI dependency is required.

The modal exposes two actions:

- `ใช้เฉพาะใบเสนอราคานี้` applies the selection to the draft. It becomes
  persistent when the quotation is saved.
- `ใช้และบันทึกเป็นค่าเริ่มต้น` saves the account default immediately and
  applies the same selection to the draft.

If saving the account default fails, the modal remains open and the draft
selection does not change. An authorization or validation error uses the
existing task-level toast pattern without exposing internal details.

A new quotation starts with the account default. An existing quotation starts
with only its saved snapshot and never merges in a later account default.
Changing a draft selection updates Preview immediately but does not affect
Print, PDF, or Public Read-only until the quotation is saved successfully.

## Shared Information Set

Every template supports the complete existing public document information:

- seller logo, name, address, tax ID, office identity, phone, email, website,
  and contact details;
- customer name, address, tax ID, office type, and branch number;
- document number, issue date, valid-until date, reference, and subject;
- item name, description, quantity, unit, unit price, fixed discount, VAT
  treatment, and pre-tax amount;
- gross, discount, pre-tax, VAT, grand total, withholding tax, amount due, and
  Thai amount in words;
- ordered payment methods, bank/provider details, account details,
  instructions, uploaded QR, and automatic PromptPay QR;
- public notes;
- Public QR, issuer, approver, signatures, dates, company stamp, and customer
  receiver slot.

Internal notes remain admin-only and are never rendered in Preview, Print,
PDF, or Public Read-only.

The existing ten `QuotationDocumentDisplay` flags remain the authority for
optional content in every template. An enabled discount or VAT field still
appears only when the quotation has matching data. Turning a template on or
off never clears any value or changes a display flag.

## Template Layouts

### Current

Current preserves the existing A4 document as the compatibility baseline:

- seller identity and contact details on the left;
- Indigo quotation title and metadata panel on the right;
- customer block, item table, summary, payment methods, public notes, and
  compact certification row in their existing order;
- existing spacing, typography, colors, and print behavior retained as a
  visual regression reference.

### Hospitality

Hospitality uses dark green, warm gold, and an off-white document background.
It emphasizes the customer experience while remaining suitable as a business
document:

- a slim green top band and seller identity lead the header;
- bilingual `QUOTATION` / `ใบเสนอราคา` title on the right;
- the customer receives visual priority in a soft panel, paired with a compact
  document-metadata panel;
- the item section is introduced as accommodation and service details, with
  descriptions given more visual space;
- payment methods and public notes sit beside a high-contrast green settlement
  panel when pagination and content length permit;
- certification remains a compact row;
- seller address and contact channels form the document footer.

### Corporate

Corporate uses navy and gray with strong alignment and number hierarchy:

- a navy top rule, seller identity, quotation title, and document number lead
  the header;
- seller details and document metadata use a balanced two-column block;
- the customer appears in a restrained gray recipient panel;
- the item table uses a navy heading and explicit quantity, price, discount,
  VAT, and total alignment according to active display settings;
- payment details and notes sit beside a bordered settlement panel when space
  permits;
- the certification row is separated with a strong navy rule.

## Pagination And Print Behavior

All templates target A4 and support one or more pages.

- Item table headings repeat after a page break.
- Ordinary item rows remain together. A validated oversized description may
  break so content is not clipped or dropped.
- Summary, payment, notes, and certification blocks avoid unnecessary splits
  but must flow to the next page rather than shrink below readable type sizes.
- Missing optional images leave a stable layout and do not break rendering.
- Print and PDF must not add a blank trailing page, clip horizontal content,
  or hide long values.

Public Read-only preserves the intentional A4-width horizontal viewport on
small screens. The admin Preview continues to use the existing document
display dialog behavior.

## Types And Data Model

Add a shared type and runtime catalogue:

```ts
export type QuotationTemplate = "current" | "hospitality" | "corporate";
```

Create a new migration. Existing migrations are not edited. Add:

- `quotation_company_profiles.document_template_default text not null default 'current'`
- `quotations.document_template_snapshot text not null default 'current'`

Each column has a database check constraint allowing exactly `current`,
`hospitality`, or `corporate`. Existing rows are backfilled to `current` before
the constraints are finalized. The migration updates the existing
column-level grants and save boundaries as required; it introduces no table.

The quotation payload includes the draft template. Public and saved repository
models include only the quotation snapshot. Account default responses remain
owner-scoped and are not included in Public Read-only data.

## Architecture

`buildQuotationDocumentViewModel` remains the shared authority for normalized
content, calculations, payment QR sources, dates, and visibility flags. A
template may change presentation but must not calculate or normalize data.

HTML rendering has a small dispatcher keyed by `QuotationTemplate`. The three
layouts are composed from focused template-local presentation components for
header, recipient, items, summary, payments, notes, and certification. Shared
formatters and semantic data contracts are reused. The current implementation
is extracted conservatively and verified against its existing visual output.

PDF rendering uses the same template key and shared view model. It has
template-specific presentation components where React PDF layout differs from
HTML, while retaining shared values, visibility decisions, ordering, and
formatters. This avoids coupling DOM and React PDF primitives while preventing
business-rule duplication.

The existing document surfaces select templates as follows:

- editor Preview: template from the current draft;
- Print: template snapshot from the latest successful save;
- PDF Download: template snapshot from the latest successful save;
- Public Read-only: template snapshot returned by the public repository.

## Data Flow And Write Boundaries

1. Create loads the authenticated account's template default and places it in
   the initial quotation payload.
2. Edit loads the quotation's stored snapshot and never merges the current
   account default.
3. The editor treats a template change as a dirty draft change.
4. The save Server Action validates and authorizes input before calling the
   quotation service.
5. The service validates the supported template, recalculates the quotation,
   and passes a normalized snapshot to the repository RPC payload.
6. The owner-scoped save RPC repeats template validation and stores the
   quotation atomically with its other snapshots.
7. Saving an account default is a separate owner-scoped action. It updates the
   draft only after the default save succeeds.

Unsupported template values are rejected at write boundaries. A legacy read
whose template value is absent normalizes to `current` so documents remain
readable during controlled rollout; a present but unsupported stored value is
treated as invalid data and reported through the existing safe error boundary.

## Authorization And Security

- Account template defaults follow the existing owner-scoped company-profile
  RLS and repository boundary.
- Quotation snapshots follow the existing quotation permissions and save RPC.
- Server Actions validate input and authorize the current user before invoking
  services.
- Client components receive only supported template identifiers and public
  thumbnail metadata; no privileged client, key, credential, or internal note
  is exposed.
- Public reads expose the saved quotation snapshot only and cannot read or
  modify an account default.

## Verification

Automated checks cover:

- migration backfill, defaults, exact allowed-value constraints, grants, and
  existing-row preservation;
- a new quotation copying the authenticated account default;
- saved quotations remaining independent of later default changes;
- owner isolation and rejected unsupported values at action, service,
  repository/RPC, and database boundaries;
- template selection preserving all quotation content, calculations, payment
  methods, certification data, and document-display settings;
- Preview using the draft while Print, PDF, and Public Read-only use the saved
  snapshot;
- all three templates rendering every supported section and respecting all ten
  display flags;
- HTML and PDF retaining equal item order, totals, payment order, notes, and
  certification content;
- Current retaining its established HTML and PDF structure and visual
  reference;
- modal keyboard access, selected/default indicators, responsive layout, and
  default-save failure behavior.

Visual QA covers Preview, Print, PDF, and Public Read-only at 390, 768, 1280,
and 1536 px. Test one-page and multi-page documents, long seller/customer/item
text, many items, reordered payment methods, missing optional images, uploaded
QR, automatic PromptPay QR, and every certification visibility combination.
Confirm there is no clipped content, avoidable split row, horizontal document
overflow, or blank trailing page.

Before completion, run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Update `docs/quotation-management.md`, the quotation user manual, and template
example images when implementation changes the user workflow.

## Out Of Scope

- User-created templates
- User-configurable template colors or fonts
- Font uploads
- Bulk template changes for saved quotations
- Retroactively applying a new account default
- New quotation fields
- Changes to quotation calculations
- Changes to public-link authorization, approval workflow, or e-signing
