# Quotation Layout Management MVP 2 Design

Date: 2026-08-04

## Prerequisite

MVP 2 is strictly blocked until Quotation Document Templates MVP 1 has passed
its review and verification, deployed successfully to Staging, and completed
Staging acceptance. Planning may document MVP 2 in advance, but implementation
must not begin before that gate passes.

The MVP 1 design is defined in
`docs/superpowers/specs/2026-08-04-quotation-document-templates-design.md`.

## Goal

Allow each account to manage the structural layout of its Current,
Hospitality, and Corporate quotation templates without allowing arbitrary
HTML, CSS, or executable content.

Users can move allowlisted document blocks vertically, place compatible blocks
to the left or right, and adjust supported column spans within A4-safe rules.
Every template edit creates an immutable revision. Saved quotations retain
their existing layout snapshot until a user explicitly applies the latest
revision to that quotation and saves it.

## Success Criteria

- Each account owns an independently editable layout for each of the three
  template families.
- A user can reorder supported blocks and move compatible blocks between
  allowlisted zones and columns.
- Invalid, overlapping, missing-required-block, and print-unsafe layouts cannot
  be published.
- Publishing a template layout creates an immutable revision and does not alter
  an existing quotation.
- An existing quotation can explicitly apply the latest revision, preview the
  result as a dirty draft, and save a new layout snapshot.
- The user can restore a prior template revision as a new latest revision.
- Preview, Print, PDF, and Public Read-only render the same saved layout
  semantics and content.

## Layout Model

Layout editing is semantic rather than free-form pixel positioning. This keeps
HTML and React PDF deterministic and prevents invalid A4 documents.

The renderer exposes a fixed block catalogue such as:

- `seller`
- `documentMetadata`
- `customer`
- `items`
- `summary`
- `paymentMethods`
- `publicNotes`
- `certification`
- `sellerFooter`

Each template family defines which blocks are required, which zones each block
may enter, supported spans, and whether it may share a row. The initial zones
are `header`, `body`, `settlement`, `footer`, and `certification`. Users may
reorder the complete `header`, `body`, `settlement`, and `certification`
sections. The Hospitality `footer` is not movable and always renders last.

Vertical movement changes `zone` and `order`. Horizontal movement changes
`column` and `span` within a twelve-column logical grid. The stored layout never
contains coordinates, raw Tailwind classes, CSS, HTML, URLs, expressions, or
JavaScript.

An example configuration is:

```json
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "seller",
      "zone": "header",
      "column": 1,
      "order": 10,
      "span": 7
    },
    {
      "id": "documentMetadata",
      "zone": "header",
      "column": 2,
      "order": 20,
      "span": 5
    },
    {
      "id": "items",
      "zone": "body",
      "column": 1,
      "order": 30,
      "span": 12
    }
  ]
}
```

## User Experience

Template settings add a separate `จัดการเลเอาท์` action. The editor operates
on one template family at a time and clearly shows the working revision and the
currently published revision.

The desktop editor presents an A4 canvas and a block inspector. Users move
blocks using accessible Move Up, Move Down, Move Left, and Move Right controls.
Drag and drop may supplement these controls but cannot be the only interaction.
On narrow screens the editor switches to an ordered block list with zone and
span controls; it does not attempt a miniature free-form canvas.

The editor provides:

- live Preview using an unsaved layout draft;
- `ยกเลิกการแก้ไข` to discard the draft;
- `เผยแพร่เลเอาท์` to validate and create a new immutable revision;
- revision history with author and timestamp;
- `คืนค่าเวอร์ชันนี้` to copy a historical revision into a new revision rather
  than mutating history.

An existing quotation whose source template has a newer published revision
shows a non-blocking `มีเลเอาท์เวอร์ชันใหม่` notice. The user may choose
`อัปเดตเป็นเวอร์ชันล่าสุด`, which replaces only the draft layout snapshot. The
quotation becomes dirty and must be saved explicitly. Canceling or leaving
without saving preserves the previous saved snapshot.

There is no automatic follow-latest mode. A sent or issued document never
changes because somebody published a template revision.

## Database Design

Use relational columns for ownership, template identity, revision identity,
status, and audit data. Use JSONB only for the variable layout configuration.

### `quotation_document_templates`

One account-owned logical row exists for each template family.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated UUID |
| `user_id` | `uuid` | Required owner, references `auth.users(id)` with cascade delete |
| `template_key` | `text` | `current`, `hospitality`, or `corporate` |
| `current_revision_number` | `bigint` | Positive revision currently published |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

`unique (user_id, template_key)` prevents duplicate logical templates. Its
leading `user_id` also supports owner-scoped lookup. Template names remain
application-owned labels in MVP 2; user-created template names are out of
scope.

### `quotation_document_template_revisions`

Each row is an immutable published layout.

| Column | Type | Rules |
| --- | --- | --- |
| `template_id` | `uuid` | References `quotation_document_templates(id)` with cascade delete |
| `revision_number` | `bigint` | Positive, increasing within a template |
| `layout_schema_version` | `integer` | Positive renderer schema version |
| `layout_config` | `jsonb` | Required, validated allowlisted layout object |
| `created_by` | `uuid` | Required authenticated actor, references `auth.users(id)` |
| `created_at` | `timestamptz` | Required |

The composite primary key is `(template_id, revision_number)`. No UPDATE or
DELETE operation is exposed for revisions. Publishing locks the logical
template row, increments `current_revision_number`, inserts the revision, and
updates the logical template in one short transaction. This prevents duplicate
revision numbers under concurrent saves.

The foreign-key column `template_id` is indexed by the composite primary key.
An additional descending index on `(template_id, revision_number desc)` is not
needed unless query plans show a measurable benefit because the same B-tree can
support reverse scans.

### `quotations`

Retain MVP 1's `document_template_snapshot` for the template family and add:

| Column | Type | Rules |
| --- | --- | --- |
| `document_template_source_id` | `uuid` | Nullable source template reference, `on delete set null` |
| `document_template_revision_snapshot` | `bigint` | Required positive source revision |
| `document_layout_schema_version_snapshot` | `integer` | Required positive schema version |
| `document_layout_snapshot` | `jsonb` | Required validated immutable layout snapshot |

The snapshot makes a saved quotation self-contained and preserves rendering if
the source template is later unavailable. The nullable source reference and
revision number provide provenance and allow the editor to detect whether a
newer revision exists. Deleting or deactivating a logical template must never
remove a saved quotation snapshot.

### Existing company profile

MVP 1's `quotation_company_profiles.document_template_default` remains the
account default template key. It does not point at a revision: a new quotation
copies the current published revision of the selected family when the draft is
created.

## Initial Data And Migration

Create a new migration; never edit the MVP 1 migration.

For every existing quotation account, create three logical template rows and
revision 1 using the canonical Current, Hospitality, and Corporate layout
configurations matching the deployed MVP 1 renderers. Set every logical row's
`current_revision_number` to 1.

Backfill each quotation by matching its MVP 1 template key to the owning
account's logical template. Store source template ID, revision 1, schema
version 1, and the canonical layout snapshot. Backfill and validation occur
before columns become required.

Account provisioning after this migration creates all three logical templates
and their first revisions atomically with the quotation company profile. The
operation is idempotent on `(user_id, template_key)`.

## Validation

Application and database validation use the same conceptual contract:

- configuration is an object containing exactly `schemaVersion` and `blocks`;
- schema version is supported by the renderer;
- every block ID is allowlisted and unique;
- every required block for the template family appears exactly once;
- no unsupported block appears;
- zone, column, order, and span values are from bounded allowlists;
- a block may enter only supported zones and spans;
- blocks sharing a row cannot overlap the twelve-column grid;
- order values are unique within a zone and normalized to stable increments;
- hidden quotation fields remain controlled by
  `QuotationDocumentDisplay`, not by deleting layout blocks;
- the item table and required certification structure retain A4-safe rules.

The TypeScript validator is the editor's immediate feedback authority. The
server service repeats validation before persistence. A private database
validation function and CHECK constraint reject malformed JSONB even if an
application boundary is bypassed. The design does not depend on an optional
extension for core validation.

No GIN index is added to `layout_config` or `document_layout_snapshot` because
the application retrieves whole configurations by template or quotation key
and does not search inside JSON. Add an expression or GIN index only when a
measured query pattern requires it.

## Rendering And Compatibility

MVP 2 introduces a layout resolver between the shared quotation document view
model and the three HTML/PDF renderers. The resolver:

1. validates the saved layout schema version;
2. maps semantic block IDs to allowlisted renderer components;
3. sorts blocks by zone and order;
4. converts logical grid values into HTML and React PDF layout primitives;
5. applies the fixed visual identity of the selected Current, Hospitality, or
   Corporate template.

Layout configuration controls structure only. Template typography, palette,
component visuals, calculations, data formatting, visibility rules, and
pagination safety remain application code.

If a saved schema version is older than the active renderer, a pure versioned
migration function upgrades the in-memory layout for rendering without
modifying the saved snapshot. Applying the latest template revision and saving
the quotation persists the new schema snapshot. Unsupported future versions
fail through a safe document-rendering error rather than silently dropping
blocks.

Preview may render an unsaved layout draft. Print, PDF, and Public Read-only
always render the quotation's latest successful saved snapshot.

## Authorization And Security

Both new tables live behind explicit grants and RLS. New Supabase projects do
not necessarily expose new public tables through the Data API automatically,
so migrations state the intended privileges instead of relying on default
grants.

- Authenticated owners may read only their logical templates and revision
  history using `(select auth.uid()) = user_id` ownership checks.
- Ownership columns used by RLS are indexed.
- Template and revision mutations are not granted directly to browser clients.
- Owner-authorized Server Actions call services and repositories; publishing
  uses a tightly scoped transaction/RPC that repeats the authenticated owner
  check.
- Any privileged database function lives in a non-exposed schema, fixes an
  empty `search_path`, checks the caller explicitly, and has EXECUTE revoked
  from roles that do not require it.
- Public quotation reads expose only the saved layout snapshot needed to render
  that document. They never expose account template history or editable draft
  configuration.
- Raw HTML, CSS, script, external assets, and arbitrary component identifiers
  are rejected to prevent stored injection and renderer escape.

## Concurrency And Error Handling

Publishing a revision locks only the selected logical template row for the
duration of revision allocation and insert. The transaction is short and does
not perform rendering or network work.

If another revision is published after an editor opens, publishing the stale
draft fails with a conflict that identifies the newer revision. The user can
reload the latest layout or intentionally reapply changes. The system never
silently overwrites a newer layout.

If `อัปเดตเป็นเวอร์ชันล่าสุด` fails, the quotation draft and saved snapshot
remain unchanged. If the layout is valid but cannot paginate safely in HTML or
PDF, publication fails with actionable block-level feedback.

## Verification

Automated checks cover:

- table constraints, foreign keys, explicit grants, RLS, and owner isolation;
- exactly three seeded template families per account and idempotent account
  provisioning;
- revision allocation, immutable history, concurrent publish conflict, and
  restore-as-new-revision behavior;
- migration backfill preserving the deployed MVP 1 appearance;
- exact JSON shape, required/unique blocks, allowed zones/spans, overlap
  rejection, and schema-version handling;
- no quotation changing after a template publication;
- explicit latest-revision application changing only the draft until save;
- Preview using the draft and Print/PDF/Public using the saved snapshot;
- HTML and PDF resolving equivalent block order, placement, values, visibility,
  totals, and certification content;
- position-button controls, disabled invalid moves, dirty-state protection,
  conflict recovery, mobile ordered-list editor, and revision history access.

Visual QA covers every supported block move and span at 390, 768, 1280, and
1536 px, plus A4 one-page and multi-page output. Test long content, many items,
multiple payment methods, missing images, automatic and uploaded QR, and every
document-display combination. No published layout may create clipped content,
unreadable type, avoidable row splits, or blank trailing pages.

Before completion, run typecheck, lint, relevant database and document tests,
the full test suite, and build. Run database advisors after schema changes and
review all security findings before deployment.

## MVP 2 Deployment Gate

After implementation and verification, confirm the deployment target is
Staging:

- Supabase: `https://sxvkhzhqtrpxgzumsswl.supabase.co`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`

Deploy the database and application to Staging, then complete acceptance for
layout publication, revision history, quotation update, Preview, Print, PDF,
and Public Read-only. Production deployment remains prohibited without a new,
direct user instruction and explicit confirmation of the Production targets in
the current chat.

## Out Of Scope

- Arbitrary pixel positioning
- Raw HTML, CSS, JavaScript, or Tailwind input
- User-created template families
- Editing quotation calculations or source data from the layout editor
- Automatic follow-latest behavior for saved quotations
- Bulk applying a layout revision to existing quotations
- Real-time multi-user collaborative editing
- Production deployment without explicit user authorization
