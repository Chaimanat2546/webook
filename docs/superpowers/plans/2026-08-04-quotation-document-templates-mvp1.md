# Quotation Document Templates MVP 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three fixed, selectable quotation templates with an account default and an immutable per-quotation template snapshot, then verify and deploy MVP 1 to Staging before any MVP 2 work begins.

**Architecture:** Add one shared `QuotationTemplate` domain contract to the existing quotation payload and persist it through the profile default and quotation snapshot. Keep `buildQuotationDocumentViewModel` as the shared data authority, use thin HTML and React PDF dispatchers, and give Current, Hospitality, and Corporate independent presentation components. Preview consumes the draft payload; Print, PDF, and Public Read-only consume the latest saved snapshot.

**Tech Stack:** Next.js App Router, React 19, strict TypeScript, Tailwind CSS, Shadcn/Radix UI, React PDF Renderer, Supabase PostgreSQL/RLS/RPC, Node.js Test Runner, OpenNext, Cloudflare Workers

## Global Constraints

- Implement only MVP 1 from `docs/superpowers/specs/2026-08-04-quotation-document-templates-design.md`; do not implement editable layout JSON, template revision tables, drag-and-drop layout editing, or MVP 2 behavior.
- Template identifiers are exactly `current`, `hospitality`, and `corporate`.
- Existing accounts and quotations must backfill to `current`, and Current must retain its existing appearance.
- No template change may mutate quotation content, calculations, display settings, payments, certification data, or public-token behavior.
- Hospitality and Corporate must render every existing public field, including seller `contactName`, `contactPhone`, and `contactEmail` when present; Current remains visually unchanged.
- Reuse existing `Dialog`, `RadioGroup`, `Card`, and `Button` components; install no dependency.
- Use TypeScript strict mode, never use `any`, prefer interfaces for object-shaped contracts, and validate unknown values at every write boundary.
- Never edit an existing migration. Generate the migration with `npx.cmd --no-install supabase migration new quotation_document_templates_mvp1`.
- Database changes must pass local verification before Staging. Never run migration repair commands blindly and never target Production.
- The only authorized deployment target in this plan is Staging: Supabase `https://sxvkhzhqtrpxgzumsswl.supabase.co`, Cloudflare account `0df55f166fa309dcc904e992c43f86db`.
- Do not expose credentials, database URLs, keys, tokens, passwords, or environment values in terminal output, logs, screenshots, commits, or documentation.
- MVP 2 implementation remains blocked until Task 10 completes successfully.

---

## File Structure

### Domain and persistence

- Create `lib/quotation-template.ts` — fixed template catalogue, labels, validation, and legacy normalization.
- Modify `lib/quotation-types.ts` — add the template to `QuotationPayload`.
- Modify `server/services/quotations.ts` — validate the template, initialize new drafts, and include the snapshot in the RPC payload.
- Create with Supabase CLI: the one file matching `supabase/migrations/*_quotation_document_templates_mvp1.sql` — profile default, quotation snapshot, constraints, wrapper save boundary, grants, and public serialization. The timestamp must come from the CLI; do not invent or rename it.
- Modify `server/repositories/quotations.ts` — read/write defaults and hydrate saved/public snapshots.
- Modify `app/admin/quotations/actions.ts` — permission-checked default-save action.
- Modify `app/admin/quotations/new/page.tsx` — initialize new quotations from the account default.
- Modify `app/admin/quotations/[id]/page.tsx` — load the current account default separately from the saved quotation snapshot.

### Editor UI

- Create `components/admin/quotations/quotation-template-thumbnail.tsx` — accessible visual thumbnail for each fixed template.
- Create `components/admin/quotations/quotation-template-dialog.tsx` — selection modal and the two approved save scopes.
- Modify `components/admin/quotations/quotation-editor.tsx` — draft selection, dirty state, default-save behavior, and Preview/Print snapshot routing.

### HTML documents

- Modify `components/admin/quotations/quotation-document.tsx` — shared-model dispatcher only.
- Create `components/admin/quotations/templates/quotation-document-contract.ts` — renderer prop interface and exhaustive-template helper.
- Create `components/admin/quotations/templates/quotation-document-shared.tsx` — shared document images, payment content, signer content, office/VAT labels, and monetary rows.
- Create `components/admin/quotations/templates/quotation-document-current.tsx` — extracted Current layout without visual changes.
- Create `components/admin/quotations/templates/quotation-document-hospitality.tsx` — approved green/gold layout.
- Create `components/admin/quotations/templates/quotation-document-corporate.tsx` — approved navy/gray layout.

### PDF documents

- Modify `components/admin/quotations/quotation-pdf.tsx` — download orchestration, shared model, asset resolution re-exports, and template dispatcher.
- Create `components/admin/quotations/templates/quotation-pdf-contract.ts` — resolved-image and renderer prop interfaces.
- Create `components/admin/quotations/templates/quotation-pdf-shared.tsx` — shared React PDF primitives.
- Create `components/admin/quotations/templates/quotation-pdf-current.tsx` — extracted Current PDF layout.
- Create `components/admin/quotations/templates/quotation-pdf-hospitality.tsx` — Hospitality PDF layout.
- Create `components/admin/quotations/templates/quotation-pdf-corporate.tsx` — Corporate PDF layout.

### Tests and documentation

- Modify `tests/quotation-service.test.ts` — template normalization, validation, and RPC payload.
- Create `tests/quotation-template-migration.test.ts` — SQL migration contract.
- Modify `tests/quotation-repository-actions.test.ts` — owner-scoped default and snapshot mappings.
- Modify `tests/quotation-ui.test.ts` — selector, renderer dispatch, and fixed template coverage.
- Modify `tests/quotation-pdf.test.ts` — PDF dispatch and content parity.
- Modify `tests/quotation-public-share.test.ts` — public snapshot rendering.
- Modify `tests/quotation-database-integration.test.ts` — local database default/snapshot/owner isolation.
- Modify `docs/quotation-management.md` — template behavior and migration boundary.
- Modify `docs/manuals/quotation/README.md` — Thai user workflow and updated date.
- Update safe local screenshots under `docs/manuals/quotation/assets/source/` and annotated equivalents under `docs/manuals/quotation/assets/annotated/`; replace them after Staging acceptance only if the deployed UI differs.
- Regenerate `docs/manuals/quotation/exports/quotation-user-manual-th.pdf` from the updated manual using the PDF skill's render-and-verify workflow.

---

### Task 1: Add the fixed template domain contract

**Files:**
- Create: `lib/quotation-template.ts`
- Modify: `lib/quotation-types.ts:1-48`
- Modify: `server/services/quotations.ts:47-60,126-165,212-239`
- Modify: `tests/quotation-service.test.ts:1-145`
- Modify: `tests/quotation-public-qr.test.ts:45-75`
- Modify: `tests/quotation-vat.test.ts:1-35`

**Interfaces:**
- Produces: `QuotationTemplate`, `QUOTATION_TEMPLATES`, `DEFAULT_QUOTATION_TEMPLATE`, `isQuotationTemplate(value)`, and `normalizeQuotationTemplate(value)`.
- Produces: `QuotationPayload.template: QuotationTemplate`.
- Produces: `PreparedQuotation.rpcPayload.document_template_snapshot: QuotationTemplate`.
- Consumed later by every repository, action, UI, HTML, and PDF task.

- [ ] **Step 1: Write failing domain and service tests**

Add imports and exact cases:

```ts
import {
  DEFAULT_QUOTATION_TEMPLATE,
  isQuotationTemplate,
  normalizeQuotationTemplate,
} from "../lib/quotation-template.ts";

it("accepts only the fixed quotation template catalogue", () => {
  for (const value of ["current", "hospitality", "corporate"]) {
    assert.equal(isQuotationTemplate(value), true);
  }
  for (const value of ["", "CURRENT", "custom", null, 1, {}]) {
    assert.equal(isQuotationTemplate(value), false);
  }
  assert.equal(normalizeQuotationTemplate(undefined), DEFAULT_QUOTATION_TEMPLATE);
  assert.equal(normalizeQuotationTemplate("corporate"), "corporate");
  assert.throws(
    () => normalizeQuotationTemplate("custom"),
    /Invalid quotation template snapshot/,
  );
});

it("persists a validated quotation template snapshot", () => {
  const payload = validPayload();
  payload.template = "hospitality";
  const prepared = prepareQuotationPayload(payload);
  assert.equal(prepared.payload.template, "hospitality");
  assert.equal(prepared.rpcPayload.document_template_snapshot, "hospitality");
});

it("rejects an unsupported quotation template", () => {
  assert.throws(
    () => prepareQuotationPayload({ ...validPayload(), template: "custom" }),
    (error: unknown) =>
      error instanceof QuotationValidationError
      && error.fieldErrors.template === "เทมเพลตใบเสนอราคาไม่ถูกต้อง",
  );
});
```

Update `validPayload()` with `template: "current"` and assert that
`emptyQuotationPayload(...)` defaults to `current`. Add `template: "current"`
to the typed fixtures in `quotation-public-qr.test.ts` and
`quotation-vat.test.ts`; do not weaken them with type casts.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-public-qr.test.ts tests/quotation-vat.test.ts
```

Expected: FAIL because `lib/quotation-template.ts` and `QuotationPayload.template` do not exist.

- [ ] **Step 3: Implement the domain module and payload validation**

Create:

```ts
export const QUOTATION_TEMPLATES = [
  "current",
  "hospitality",
  "corporate",
] as const;

export type QuotationTemplate = (typeof QUOTATION_TEMPLATES)[number];

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplate = "current";

export const QUOTATION_TEMPLATE_LABELS: Record<QuotationTemplate, string> = {
  corporate: "Corporate",
  current: "Current",
  hospitality: "Hospitality",
};

export function isQuotationTemplate(value: unknown): value is QuotationTemplate {
  return typeof value === "string"
    && QUOTATION_TEMPLATES.includes(value as QuotationTemplate);
}

export function normalizeQuotationTemplate(value: unknown): QuotationTemplate {
  if (value == null || value === "") return DEFAULT_QUOTATION_TEMPLATE;
  if (isQuotationTemplate(value)) return value;
  throw new Error("Invalid quotation template snapshot");
}
```

Add `template: QuotationTemplate` to `QuotationPayload`. Extend
`emptyQuotationPayload` with a final argument
`template: QuotationTemplate = DEFAULT_QUOTATION_TEMPLATE`. In
`prepareQuotationPayload`, use `isQuotationTemplate(source.template)`; record
`errors.template` instead of silently accepting an invalid write. Add the
validated value to the normalized payload and RPC payload.

- [ ] **Step 4: Run focused tests, typecheck, and lint the touched files**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-public-qr.test.ts tests/quotation-vat.test.ts
npm.cmd run typecheck
npx.cmd eslint lib/quotation-template.ts lib/quotation-types.ts server/services/quotations.ts tests/quotation-service.test.ts tests/quotation-public-qr.test.ts tests/quotation-vat.test.ts
```

Expected: all commands PASS.

- [ ] **Step 5: Commit the domain contract**

```powershell
git add lib/quotation-template.ts lib/quotation-types.ts server/services/quotations.ts tests/quotation-service.test.ts tests/quotation-public-qr.test.ts tests/quotation-vat.test.ts
git commit -m "feat: add quotation template contract"
```

---

### Task 2: Persist account defaults and quotation snapshots

**Files:**
- Create via CLI: the one file matching `supabase/migrations/*_quotation_document_templates_mvp1.sql`
- Create: `tests/quotation-template-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Consumes: `document_template_snapshot` from Task 1's RPC payload.
- Produces: `quotation_company_profiles.document_template_default`.
- Produces: `quotations.document_template_snapshot`.
- Produces: validated public/save database boundaries used by Task 3.

- [ ] **Step 1: Discover the installed Supabase CLI and generate the migration**

Run:

```powershell
npx.cmd --no-install supabase --version
npx.cmd --no-install supabase migration new quotation_document_templates_mvp1
```

Expected: the second command prints one new migration path ending in
`_quotation_document_templates_mvp1.sql`. Record that exact path and use it in
every remaining step; do not rename it.

- [ ] **Step 2: Write the failing migration contract test**

Locate the migration by its exact suffix so the CLI timestamp stays dynamic:

```ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const filename = readdirSync("supabase/migrations").find((value) =>
  value.endsWith("_quotation_document_templates_mvp1.sql")
);
assert.ok(filename, "quotation template migration must exist");
const sql = readFileSync(`supabase/migrations/${filename}`, "utf8");

describe("quotation template migration", () => {
  it("adds fixed current defaults without destructive changes", () => {
    assert.match(sql, /quotation_company_profiles[\s\S]*document_template_default text not null default 'current'/i);
    assert.match(sql, /quotations[\s\S]*document_template_snapshot text not null default 'current'/i);
    assert.match(sql, /in \('current', 'hospitality', 'corporate'\)/i);
    assert.doesNotMatch(sql, /drop table|truncate|delete from/i);
  });

  it("validates owner defaults and quotation snapshots at database boundaries", () => {
    assert.match(sql, /private\.is_quotation_template/i);
    assert.match(sql, /private\.save_quotation_with_template/i);
    assert.match(sql, /p_payload ->> 'document_template_snapshot'/i);
    assert.match(sql, /created_by = auth\.uid\(\)/i);
    assert.match(sql, /'document_template_snapshot', q\.document_template_snapshot/i);
  });

  it("uses explicit grants and keeps the public save wrapper permission-scoped", () => {
    assert.match(sql, /grant select \(document_template_default\)/i);
    assert.match(sql, /grant update \(document_template_default\)/i);
    assert.match(sql, /revoke all on function public\.save_quotation_with_payments\(jsonb\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.save_quotation_with_payments\(jsonb\) to authenticated/i);
  });
});
```

- [ ] **Step 3: Run the contract test and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-template-migration.test.ts
```

Expected: FAIL because the generated migration is empty.

- [ ] **Step 4: Implement the migration with a validated wrapper boundary**

Use text plus CHECK constraints, matching the approved spec:

```sql
alter table public.quotation_company_profiles
  add column document_template_default text not null default 'current',
  add constraint quotation_company_profiles_document_template_default_valid
    check (document_template_default in ('current', 'hospitality', 'corporate'));

alter table public.quotations
  add column document_template_snapshot text not null default 'current',
  add constraint quotations_document_template_snapshot_valid
    check (document_template_snapshot in ('current', 'hospitality', 'corporate'));

create function private.is_quotation_template(value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select value in ('current', 'hospitality', 'corporate');
$$;

grant select (document_template_default)
  on public.quotation_company_profiles to authenticated;
grant update (document_template_default)
  on public.quotation_company_profiles to authenticated;
```

Add `private.save_quotation_with_template(p_payload jsonb)` as a
`security definer` function with fixed `search_path = pg_catalog, public,
private`. It must validate the trimmed snapshot, call
`private.save_quotation_with_document_display(p_payload)`, update only the row
whose `created_by = auth.uid()` and `deleted_at is null`, and return the saved ID
and document number. Redefine `public.save_quotation_with_payments(jsonb)` as a
`security invoker` SQL wrapper over the new function.

In the current public serializer from
`20260724120000_quotation_document_display_settings.sql`, preserve every
existing explicit field and add exactly:

```diff
     'document_display_snapshot', q.document_display_snapshot,
+    'document_template_snapshot', q.document_template_snapshot,
```

Revoke `PUBLIC`/`anon` execution from the private validator, private wrapper,
and public save wrapper; grant only the required authenticated execution.

- [ ] **Step 5: Add local database integration assertions**

Extend the existing integration fixture so it saves one `hospitality`
quotation, reads it by owner and public token, changes the profile default to
`corporate`, and asserts:

```ts
assert.equal(savedQuotation.payload.template, "hospitality");
assert.equal(publicQuotation?.payload.template, "hospitality");
assert.equal(companyProfile.document_template_default, "corporate");
assert.equal(savedQuotation.payload.template, "hospitality");
```

Also submit `document_template_snapshot: "custom"` directly to the RPC and
assert SQLSTATE `22023` without exposing the database message to UI code.

- [ ] **Step 6: Run SQL contract tests and local migration verification**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-template-migration.test.ts tests/quotation-migration.test.ts
npx.cmd --no-install supabase status
npx.cmd --no-install supabase migration up --local --include-all --yes
npx.cmd --no-install supabase migration list --local
$env:RUN_LOCAL_SUPABASE_TESTS = "1"
node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts
Remove-Item Env:RUN_LOCAL_SUPABASE_TESTS
```

Expected: contract tests PASS; local Supabase must be running before migration
execution; the generated migration appears applied locally; integration tests
PASS. If the local stack is unavailable, stop this task and report the missing
local prerequisite rather than targeting Staging.

- [ ] **Step 7: Run database advisors and commit**

Discover advisor support first:

```powershell
npx.cmd --no-install supabase db --help
npx.cmd --no-install supabase db advisors --local
```

Fix findings caused by this migration, then commit only the generated migration
and its tests:

```powershell
git add supabase/migrations/*_quotation_document_templates_mvp1.sql tests/quotation-template-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "feat: persist quotation template snapshots"
```

---

### Task 3: Wire defaults and snapshots through repositories, actions, and routes

**Files:**
- Modify: `server/repositories/quotations.ts:28-41,72-145,261-341,500-552`
- Modify: `app/admin/quotations/actions.ts:19-78,135-178`
- Modify: `app/admin/quotations/new/page.tsx:1-37`
- Modify: `app/admin/quotations/[id]/page.tsx:1-25`
- Modify: `tests/quotation-repository-actions.test.ts`
- Modify: `tests/quotation-public-share.test.ts`

**Interfaces:**
- Consumes: `QuotationTemplate` and the database columns from Tasks 1-2.
- Produces: `companyProfileToTemplate(row): QuotationTemplate`.
- Produces: `saveQuotationTemplateDefault(supabase, value, userId): Promise<void>`.
- Produces: `saveQuotationTemplateDefaultAction(value): Promise<{ok:true}|{ok:false;formError:string}>`.

- [ ] **Step 1: Write failing repository/action tests**

Add assertions for:

```ts
assert.match(repository, /document_template_default/);
assert.match(repository, /document_template_snapshot/);
assert.match(repository, /companyProfileToTemplate/);
assert.match(repository, /normalizeQuotationTemplate\(row\.document_template_snapshot\)/);
assert.match(repository, /saveQuotationTemplateDefault[\s\S]*\.eq\("user_id", userId\)/);
assert.match(actions, /isQuotationTemplate\(value\)/);
assert.match(actions, /saveQuotationTemplateDefault\(supabase, value, user\.id\)/);
assert.match(newPage, /companyProfileToTemplate\(profile\)/);
assert.match(editPage, /getQuotationCompanyProfile/);
assert.match(editPage, /initialTemplateDefault=\{companyProfileToTemplate\(profile\)\}/);
```

Define `newPage` and `editPage` beside the existing repository/action source
constants:

```ts
const newPage = readFileSync(
  new URL("../app/admin/quotations/new/page.tsx", import.meta.url),
  "utf8",
);
const editPage = readFileSync(
  new URL("../app/admin/quotations/[id]/page.tsx", import.meta.url),
  "utf8",
);
```

Extend the public-share test to require repository hydration of
`document_template_snapshot` and continued use of the shared
`QuotationDocument` surface.

- [ ] **Step 2: Run focused tests and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts
```

Expected: FAIL on missing repository/action/default wiring.

- [ ] **Step 3: Implement repository mappings and the owner-scoped default write**

Add `document_template_default: unknown` to
`QuotationCompanyProfileRow`, `document_template_snapshot: unknown` to
`DatabaseQuotationRow`, and both fields to their select/serialization paths.
Implement:

```ts
export function companyProfileToTemplate(
  row: QuotationCompanyProfileRow,
): QuotationTemplate {
  return normalizeQuotationTemplate(row.document_template_default);
}

export async function saveQuotationTemplateDefault(
  supabase: SupabaseClient,
  value: QuotationTemplate,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("quotation_company_profiles")
    .update({ document_template_default: value, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}
```

Map quotation rows with
`template: normalizeQuotationTemplate(row.document_template_snapshot)`.

- [ ] **Step 4: Implement the permission-checked action and Create default**

Add an action parallel to document-display defaults:

```ts
export async function saveQuotationTemplateDefaultAction(
  value: unknown,
): Promise<{ ok: true } | { formError: string; ok: false }> {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!isQuotationTemplate(value)) {
    return { formError: "เทมเพลตใบเสนอราคาไม่ถูกต้อง", ok: false };
  }
  try {
    await saveQuotationTemplateDefault(supabase, value, user.id);
    return { ok: true };
  } catch {
    return { formError: "ไม่สามารถบันทึกเทมเพลตเริ่มต้นได้", ok: false };
  }
}
```

Pass `companyProfileToTemplate(profile)` as the final
`emptyQuotationPayload` argument and as `initialTemplateDefault` in the Create
route. In Edit, destructure `user` from `requireAdmin()`, load
`getQuotationCompanyProfile(supabase, user.id)` in the existing `Promise.all`,
return the existing seller-profile empty state if it is absent, and pass
`initialTemplateDefault={companyProfileToTemplate(profile)}` separately from
the saved `initialPayload.template`. Public requires no default query because it
renders only the saved snapshot.

- [ ] **Step 5: Run focused tests, typecheck, and lint**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
npx.cmd eslint server/repositories/quotations.ts app/admin/quotations/actions.ts app/admin/quotations/new/page.tsx app/admin/quotations/[id]/page.tsx tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts
```

Expected: all commands PASS.

- [ ] **Step 6: Commit data flow wiring**

```powershell
git add server/repositories/quotations.ts app/admin/quotations/actions.ts app/admin/quotations/new/page.tsx app/admin/quotations/[id]/page.tsx tests/quotation-repository-actions.test.ts tests/quotation-public-share.test.ts
git commit -m "feat: load quotation template defaults"
```

---

### Task 4: Add the accessible template selector

**Files:**
- Create: `components/admin/quotations/quotation-template-thumbnail.tsx`
- Create: `components/admin/quotations/quotation-template-dialog.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx:24-82,662-780,920-960,1233-1242`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `QuotationTemplate`, labels, `initialTemplateDefault`, and `saveQuotationTemplateDefaultAction`.
- Produces: `QuotationTemplateDialog` with
  `onApply(value: QuotationTemplate, saveAsDefault: boolean): Promise<boolean>`.
- Produces: editor draft updates via `updateRoot("template", value)` semantics.

- [ ] **Step 1: Write failing UI source-contract tests**

Require the approved primitives, labels, scope actions, and dirty-state path:

```ts
const templateDialog = source("../components/admin/quotations/quotation-template-dialog.tsx");
const templateThumbnail = source("../components/admin/quotations/quotation-template-thumbnail.tsx");

assert.match(templateDialog, /Dialog/);
assert.match(templateDialog, /RadioGroup/);
assert.match(templateDialog, /Card/);
assert.match(templateDialog, /กำลังใช้/);
assert.match(templateDialog, /ค่าเริ่มต้นของบัญชี/);
assert.match(templateDialog, /ใช้เฉพาะใบเสนอราคานี้/);
assert.match(templateDialog, /ใช้และบันทึกเป็นค่าเริ่มต้น/);
assert.match(templateDialog, /มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว/);
for (const key of ["current", "hospitality", "corporate"]) {
  assert.match(templateThumbnail, new RegExp(`data-template-thumbnail=["']${key}["']`));
}
assert.match(editor, /saveQuotationTemplateDefaultAction/);
assert.match(editor, /initialTemplateDefault: QuotationTemplate/);
assert.match(editor, /useState\(initialTemplateDefault\)/);
assert.match(editor, /changed\("template"\)/);
assert.match(editor, /template: value/);
```

- [ ] **Step 2: Run the UI test and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the template UI files do not exist.

- [ ] **Step 3: Implement the fixed thumbnails**

Render semantic miniature A4 cards without external image assets. Each variant
must expose its key, title treatment, header split, table band, settlement box,
and palette. Use `aria-hidden="true"` on decorative thumbnail content and keep
the visible template name in the surrounding radio label.

The palette contract is:

```ts
const palette: Record<QuotationTemplate, { accent: string; light: string }> = {
  corporate: { accent: "bg-[#142d4c]", light: "bg-[#f2f5f8]" },
  current: { accent: "bg-indigo-500", light: "bg-indigo-50" },
  hospitality: { accent: "bg-[#286a5b]", light: "bg-[#f1f7f4]" },
};
```

- [ ] **Step 4: Implement the dialog using existing Shadcn/Radix primitives**

Use local `open`, `draft`, and `busy` state. Reset `draft` from the payload and
the account default every time the dialog opens. The radio cards must be
keyboard selectable and expose the approved status badges. Apply only after
`await onApply(draft, saveAsDefault)` returns true; otherwise leave the modal
and selection open.

Use this public contract:

```ts
export interface QuotationTemplateDialogProps {
  accountDefault: QuotationTemplate;
  disabled: boolean;
  onApply: (
    value: QuotationTemplate,
    saveAsDefault: boolean,
  ) => Promise<boolean>;
  value: QuotationTemplate;
}
```

- [ ] **Step 5: Integrate the dialog into the editor**

Add `initialTemplateDefault: QuotationTemplate` to `QuotationEditorProps` and
initialize `accountTemplateDefault` from that prop, not from the quotation
snapshot. Implement:

```ts
async function applyTemplate(
  value: QuotationTemplate,
  saveAsDefault: boolean,
): Promise<boolean> {
  if (saveAsDefault) {
    const result = await saveQuotationTemplateDefaultAction(value);
    if (!result.ok) {
      toast.error(result.formError);
      return false;
    }
  }
  changed("template");
  setPayload((current) => ({ ...current, template: value }));
  if (saveAsDefault) {
    setAccountTemplateDefault(value);
    toast.success("บันทึกเทมเพลตเริ่มต้นแล้ว");
  }
  return true;
}
```

Place the template dialog immediately before
`QuotationDocumentDisplayDialog` in `data-document-actions`. The template
button must be `size="sm"`, `variant="outline"`, and disabled during save or
asset upload. Saved Print/PDF already use `lastSavedPayload`; Preview already
uses `payload`, so do not add another template state.

- [ ] **Step 6: Run focused tests, typecheck, and lint**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
npx.cmd eslint components/admin/quotations/quotation-template-thumbnail.tsx components/admin/quotations/quotation-template-dialog.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
```

Expected: all commands PASS.

- [ ] **Step 7: Commit the selector**

```powershell
git add components/admin/quotations/quotation-template-thumbnail.tsx components/admin/quotations/quotation-template-dialog.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add quotation template selector"
```

---

### Task 5: Extract Current HTML and add the HTML dispatcher

**Files:**
- Create: `components/admin/quotations/templates/quotation-document-contract.ts`
- Create: `components/admin/quotations/templates/quotation-document-shared.tsx`
- Create: `components/admin/quotations/templates/quotation-document-current.tsx`
- Create: `components/admin/quotations/templates/quotation-document-hospitality.tsx`
- Create: `components/admin/quotations/templates/quotation-document-corporate.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx:1-500`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `QuotationPayload.template` and `buildQuotationDocumentViewModel`.
- Produces: `QuotationDocumentRendererProps { model: QuotationDocumentViewModel }`.
- Produces: `CurrentQuotationDocument`, followed by the new layouts in Tasks 7-8.

- [ ] **Step 1: Strengthen Current regression tests before extraction**

Record the Current data attributes and section order already present:

```ts
for (const marker of [
  "data-document-header",
  "data-document-customer",
  "data-document-items",
  "data-document-summary",
  "data-document-payment-methods",
  "data-document-notes",
  "data-document-certification",
]) {
  assert.match(currentDocument, new RegExp(marker));
}
assert.match(dispatcher, /buildQuotationDocumentViewModel/);
assert.match(dispatcher, /payload\.template/);
assert.match(dispatcher, /CurrentQuotationDocument/);
```

Keep the existing screenshot
`output/screenshots/quotation-preview-QO-20260718-0001.png` as the Current visual
reference; do not overwrite it during extraction.

- [ ] **Step 2: Run the UI test and verify the dispatcher assertion fails**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: existing Current assertions PASS and new dispatcher assertions FAIL.

- [ ] **Step 3: Extract shared HTML presentation helpers**

Move the existing `Total`, payment method, signer, receiver, office, VAT label,
and document-image presentation into `quotation-document-shared.tsx`. Export
named, typed helpers only; do not move calculations or visibility logic out of
the view model.

Define the renderer contract:

```ts
import type { QuotationDocumentViewModel } from "../../../../lib/quotation-document-view";

export interface QuotationDocumentRendererProps {
  model: QuotationDocumentViewModel;
}
```

- [ ] **Step 4: Extract Current with no class or order changes**

Move the existing `<article>` body into `CurrentQuotationDocument({ model })`.
Preserve `min-h-[297mm]`, `w-[210mm]`, `p-[10mm]`, the Indigo palette, every
existing data attribute, conditional flag, item-row behavior, payment order,
and certification order. The component must begin:

```tsx
export function CurrentQuotationDocument({
  model,
}: QuotationDocumentRendererProps) {
  const { calculation, payload } = model;
  return (
    <article
      className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[10mm] text-[10px] leading-[1.45] text-slate-900"
      data-quotation-document
      data-quotation-template="current"
    >
```

- [ ] **Step 5: Replace the root with an exhaustive dispatcher**

Build the view model once, then dispatch:

```tsx
const renderers: Record<
  QuotationTemplate,
  React.ComponentType<QuotationDocumentRendererProps>
> = {
  corporate: CorporateQuotationDocument,
  current: CurrentQuotationDocument,
  hospitality: HospitalityQuotationDocument,
};

const Renderer = renderers[payload.template];
return <Renderer model={model} />;
```

During this task, create typed pass-through Hospitality and Corporate files
that call `CurrentQuotationDocument` so the strict record compiles. Tasks 7-8
replace those pass-through bodies with their approved layouts. The Task 7 and
Task 8 tests require unique template markers and palettes, so a pass-through
cannot satisfy final verification.

- [ ] **Step 6: Run tests, typecheck, build, and compare Current visually**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Start the local app with non-secret local configuration, open an existing
Current quotation, and compare Preview at 100% zoom against
`output/screenshots/quotation-preview-QO-20260718-0001.png`. Expected: no
observable Current layout, color, spacing, content, or pagination change.

- [ ] **Step 7: Commit Current extraction**

```powershell
git add components/admin/quotations/quotation-document.tsx components/admin/quotations/templates/quotation-document-contract.ts components/admin/quotations/templates/quotation-document-shared.tsx components/admin/quotations/templates/quotation-document-current.tsx components/admin/quotations/templates/quotation-document-hospitality.tsx components/admin/quotations/templates/quotation-document-corporate.tsx tests/quotation-ui.test.ts
git commit -m "refactor: dispatch quotation HTML templates"
```

---

### Task 6: Extract Current PDF and add the PDF dispatcher

**Files:**
- Create: `components/admin/quotations/templates/quotation-pdf-contract.ts`
- Create: `components/admin/quotations/templates/quotation-pdf-shared.tsx`
- Create: `components/admin/quotations/templates/quotation-pdf-current.tsx`
- Create: `components/admin/quotations/templates/quotation-pdf-hospitality.tsx`
- Create: `components/admin/quotations/templates/quotation-pdf-corporate.tsx`
- Modify: `components/admin/quotations/quotation-pdf.tsx:25-470`
- Modify: `tests/quotation-pdf.test.ts`
- Modify: `tests/quotation-pdf-helpers.test.ts`

**Interfaces:**
- Consumes: `QuotationDocumentViewModel` and `QuotationPayload.template`.
- Produces: `QuotationPdfRendererProps { images: ResolvedImages; model: QuotationDocumentViewModel }`.
- Preserves: `collectQuotationPdfImageSources`, `resolveQuotationPdfImages`, and `downloadQuotationPdf` public exports.

- [ ] **Step 1: Write failing PDF dispatcher and Current regression tests**

Add exact assertions:

```ts
assert.match(pdfSource, /model\.payload\.template/);
assert.match(pdfSource, /CurrentQuotationPdf/);
assert.match(pdfSource, /HospitalityQuotationPdf/);
assert.match(pdfSource, /CorporateQuotationPdf/);
assert.match(currentPdf, /size="A4"/);
assert.match(currentPdf, /data-pdf-header/);
assert.match(currentPdf, /data-pdf-items/);
assert.match(currentPdf, /data-pdf-totals/);
assert.match(currentPdf, /data-pdf-certification/);
```

Keep existing assertions for fonts, hyphenation, image conversion, repeat table
header, oversized-row wrapping, exact filename, and lazy editor import.

- [ ] **Step 2: Run PDF tests and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-pdf-helpers.test.ts
```

Expected: new dispatcher assertions FAIL; existing helper tests PASS.

- [ ] **Step 3: Extract shared PDF contracts and primitives**

Define:

```ts
export type ResolvedImages = Record<string, string>;

export interface QuotationPdfRendererProps {
  images: ResolvedImages;
  model: QuotationDocumentViewModel;
}
```

Move typed `Detail`, `Total`, `PaymentMethod`, `Signer`, office/VAT labels, and
image lookup into `quotation-pdf-shared.tsx`. Keep font registration,
hyphenation, source collection, image conversion, and download lifecycle in
`quotation-pdf.tsx`; re-export existing tested helpers from the same public
module.

- [ ] **Step 4: Extract Current PDF without presentation changes**

Move the existing `Document`/`Page` tree and Current style sheet into
`CurrentQuotationPdf`. Preserve A4 size, Noto Sans Thai, 28.35-point margins,
Indigo colors, fixed repeating table header, wrap decisions, all public fields,
and certification structure.

- [ ] **Step 5: Add the exhaustive PDF dispatcher**

Select the renderer after assets resolve:

```tsx
const renderers: Record<
  QuotationTemplate,
  React.ComponentType<QuotationPdfRendererProps>
> = {
  corporate: CorporateQuotationPdf,
  current: CurrentQuotationPdf,
  hospitality: HospitalityQuotationPdf,
};

const Renderer = renderers[model.payload.template];
const blob = await pdf(<Renderer images={images} model={model} />).toBlob();
```

As in Task 5, create typed Hospitality/Corporate pass-through files that call
Current until Tasks 7-8 replace their bodies. Tests in those tasks prove the
real template markers and palettes before full verification.

- [ ] **Step 6: Run PDF tests, typecheck, and create a Current fixture PDF**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-pdf-helpers.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Download the existing Current quotation as PDF and compare it at 100% zoom with
`output/screenshots/quotation-pdf-QO-20260718-0001.png`. Expected: no observable
Current content, color, spacing, page-break, or image change.

- [ ] **Step 7: Commit Current PDF extraction**

```powershell
git add components/admin/quotations/quotation-pdf.tsx components/admin/quotations/templates/quotation-pdf-contract.ts components/admin/quotations/templates/quotation-pdf-shared.tsx components/admin/quotations/templates/quotation-pdf-current.tsx components/admin/quotations/templates/quotation-pdf-hospitality.tsx components/admin/quotations/templates/quotation-pdf-corporate.tsx tests/quotation-pdf.test.ts tests/quotation-pdf-helpers.test.ts
git commit -m "refactor: dispatch quotation PDF templates"
```

---

### Task 7: Implement Hospitality across HTML and PDF

**Files:**
- Modify: `components/admin/quotations/templates/quotation-document-hospitality.tsx`
- Modify: `components/admin/quotations/templates/quotation-pdf-hospitality.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-pdf.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-pdf.test.ts`

**Interfaces:**
- Consumes: shared renderer contracts and helpers from Tasks 5-6.
- Produces: real `HospitalityQuotationDocument` and `HospitalityQuotationPdf`.

- [ ] **Step 1: Write failing Hospitality structure tests**

Require unique markers and palette in both surfaces:

```ts
assert.match(hospitalityHtml, /data-quotation-template="hospitality"/);
assert.match(hospitalityHtml, /QUOTATION/);
assert.match(hospitalityHtml, /#286a5b/);
assert.match(hospitalityHtml, /#c79b58/);
assert.match(hospitalityHtml, /data-hospitality-recipient/);
assert.match(hospitalityHtml, /data-hospitality-settlement/);
assert.match(hospitalityPdf, /HospitalityQuotationPdf/);
assert.match(hospitalityPdf, /#286a5b/);
assert.match(hospitalityPdf, /#c79b58/);
```

Also assert the standard item, payment, notes, and certification markers remain
present and that the root dispatchers import the real Hospitality files rather
than Current pass-throughs.

- [ ] **Step 2: Run HTML/PDF tests and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts
```

Expected: FAIL on Hospitality markers and palette.

- [ ] **Step 3: Implement the Hospitality HTML layout**

Use the approved structure in this exact order:

1. green top band;
2. seller identity and bilingual `QUOTATION` / `ใบเสนอราคา` header;
3. highlighted customer recipient panel beside compact metadata;
4. accommodation/service item table with description priority;
5. payment and notes content beside a green settlement panel when content fits;
6. compact certification row;
7. seller footer containing address, phone, email, website, and the named
   contact's name/phone/email when present.

Keep the A4 root at `210mm × minimum 297mm`. Use `#286a5b` for the primary,
`#c79b58` for the warm accent, `#fffdf8` for the paper, and existing text/money
formatters. Render every conditional strictly from the shared model flags.

- [ ] **Step 4: Implement the Hospitality PDF layout**

Mirror the HTML semantic order with React PDF primitives. Use a thin green top
rule, the same palette, a repeated fixed table header, and
`canKeepQuotationPdfItemTogether` for item rows. Do not shrink text below the
Current PDF base size. Payments and summary may wrap to sequential blocks when
React PDF cannot safely maintain the side-by-side arrangement.

- [ ] **Step 5: Verify Hospitality content and pagination**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Manually inspect one-page and multi-page Hospitality Preview and PDF with long
descriptions, 20 payment methods, missing optional images, auto PromptPay QR,
uploaded QR, and all certification visibility flags. Expected: complete data,
repeat headings, readable type, no overlap, and no blank trailing page.

- [ ] **Step 6: Commit Hospitality**

```powershell
git add components/admin/quotations/templates/quotation-document-hospitality.tsx components/admin/quotations/templates/quotation-pdf-hospitality.tsx components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-pdf.tsx tests/quotation-ui.test.ts tests/quotation-pdf.test.ts
git commit -m "feat: add hospitality quotation template"
```

---

### Task 8: Implement Corporate across HTML and PDF

**Files:**
- Modify: `components/admin/quotations/templates/quotation-document-corporate.tsx`
- Modify: `components/admin/quotations/templates/quotation-pdf-corporate.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-pdf.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-pdf.test.ts`

**Interfaces:**
- Consumes: shared renderer contracts and helpers from Tasks 5-6.
- Produces: real `CorporateQuotationDocument` and `CorporateQuotationPdf`.

- [ ] **Step 1: Write failing Corporate structure tests**

```ts
assert.match(corporateHtml, /data-quotation-template="corporate"/);
assert.match(corporateHtml, /#142d4c/);
assert.match(corporateHtml, /#f2f5f8/);
assert.match(corporateHtml, /data-corporate-company-metadata/);
assert.match(corporateHtml, /data-corporate-recipient/);
assert.match(corporateHtml, /data-corporate-settlement/);
assert.match(corporatePdf, /CorporateQuotationPdf/);
assert.match(corporatePdf, /#142d4c/);
```

Require standard item, payment, notes, certification, and visibility markers in
both surfaces and removal of the final Corporate pass-through.

- [ ] **Step 2: Run HTML/PDF tests and verify failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts
```

Expected: FAIL on Corporate markers and palette.

- [ ] **Step 3: Implement the Corporate HTML layout**

Use the approved order:

1. navy top rule, seller identity, quotation title, and document-number badge;
2. two-column seller/document metadata block, including the named contact's
   name/phone/email when present;
3. restrained gray customer recipient panel;
4. navy table heading with explicit numeric alignment;
5. payment/notes beside a bordered settlement panel when content fits;
6. certification row separated by a strong navy rule.

Use `#142d4c` and `#f2f5f8`, preserve A4 dimensions, and let shared visibility
flags remove optional columns without leaving empty gaps.

- [ ] **Step 4: Implement the Corporate PDF layout**

Mirror the same semantic order in React PDF, repeat the navy table header, keep
numeric columns aligned, use the shared item wrap decision, and flow the
settlement/payment blocks sequentially when necessary for page safety.

- [ ] **Step 5: Verify Corporate content and pagination**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Inspect one-page and multi-page Corporate Preview and PDF using the same stress
fixtures as Hospitality. Expected: complete fields, strong numeric hierarchy,
repeat headings, no clipping, no overlap, and no blank trailing page.

- [ ] **Step 6: Commit Corporate**

```powershell
git add components/admin/quotations/templates/quotation-document-corporate.tsx components/admin/quotations/templates/quotation-pdf-corporate.tsx components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-pdf.tsx tests/quotation-ui.test.ts tests/quotation-pdf.test.ts
git commit -m "feat: add corporate quotation template"
```

---

### Task 9: Complete cross-surface verification and documentation

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `tests/quotation-pdf.test.ts`
- Modify: `tests/quotation-public-share.test.ts`
- Modify: `docs/quotation-management.md`
- Modify: `docs/manuals/quotation/README.md`
- Modify after Staging capture: `docs/manuals/quotation/assets/source/03-quotation-editor.png`
- Modify after annotation: `docs/manuals/quotation/assets/annotated/03-quotation-editor-annotated.png`
- Modify: `docs/manuals/quotation/exports/quotation-user-manual-th.pdf`

**Interfaces:**
- Consumes: complete MVP 1 behavior from Tasks 1-8.
- Produces: regression evidence, updated user documentation, and the release candidate for Task 10.

- [ ] **Step 1: Add explicit cross-surface parity tests**

For each template key, require both HTML and PDF implementations to contain
seller, metadata, customer, items, totals, payment, notes, and certification
sections. Require the public page to pass `quotation.payload` to the shared
dispatcher and the editor to pass `payload` to Preview but `lastSavedPayload`
to Print and PDF.

Add a source-level assertion that no template component references
`internalNotes`, recalculates totals, or directly reads an account default.

- [ ] **Step 2: Run the complete automated verification suite**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
```

Expected: all commands PASS with no warnings introduced by MVP 1.

- [ ] **Step 3: Perform responsive and document visual QA locally**

Use safe synthetic quotation data and inspect Create/Edit, Preview, Print, PDF,
and Public Read-only at widths 390, 768, 1280, and 1536 pixels for all three
templates. Cover:

- one and 100 items;
- long seller, customer, subject, reference, and item descriptions;
- discounts/VAT absent and present;
- every one of the ten display flags disabled independently;
- zero and 20 payment methods;
- missing logo/signature/stamp/QR;
- uploaded and auto PromptPay QR;
- one-page and multi-page pagination.

Record failures with the template, surface, viewport, data fixture, and page
number. Fix and rerun the full affected surface before proceeding.

- [ ] **Step 4: Update architecture and Thai user documentation**

Document:

- fixed template keys and visual purposes;
- account default versus quotation snapshot;
- Preview draft versus saved Print/PDF/Public behavior;
- the two selector actions;
- Current compatibility and migration backfill;
- MVP 2 layout editing remaining unavailable.

Change the manual's updated date to `4 สิงหาคม 2026` and add a template-selection
subsection before the quotation-entry instructions.

- [ ] **Step 5: Regenerate and verify the manual PDF**

Invoke the PDF skill before editing the exported PDF. Capture a real editor
screenshot using safe local or Staging test data, update the annotated image,
regenerate `quotation-user-manual-th.pdf`, render every page to PNG, and inspect
for clipped Thai text, broken image links, incorrect numbering, and blank
pages. Do not use Production data.

- [ ] **Step 6: Re-run documentation-sensitive tests and final verification**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts
npm.cmd run verify
npm.cmd run build
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 7: Commit documentation and final regression coverage**

```powershell
git add tests/quotation-ui.test.ts tests/quotation-pdf.test.ts tests/quotation-public-share.test.ts docs/quotation-management.md docs/manuals/quotation/README.md docs/manuals/quotation/assets/source/03-quotation-editor.png docs/manuals/quotation/assets/annotated/03-quotation-editor-annotated.png docs/manuals/quotation/exports/quotation-user-manual-th.pdf
git commit -m "docs: document quotation templates"
```

---

### Task 10: Deploy MVP 1 to Staging and complete the gate

**Files:**
- Read only: `.env.staging`
- Read only: `wrangler.staging.jsonc`
- Read only: `scripts/assert-staging-cloudflare-target.mjs`
- Read only: the one file matching `supabase/migrations/*_quotation_document_templates_mvp1.sql`
- Modify only if acceptance findings require documentation: `docs/quotation-management.md`

**Interfaces:**
- Consumes: the fully verified MVP 1 release candidate.
- Produces: applied Staging migration, deployed Staging Worker, recorded acceptance result, and permission to begin MVP 2 implementation only after success.

- [ ] **Step 1: Verify the exact Staging targets without printing secrets**

Run a small local assertion that outputs only booleans and public identifiers:

```powershell
node scripts/assert-staging-cloudflare-target.mjs
Select-String -Path .env.staging -Pattern '^NEXT_PUBLIC_SUPABASE_URL=https://sxvkhzhqtrpxgzumsswl\.supabase\.co$'
Select-String -Path wrangler.staging.jsonc -Pattern '0df55f166fa309dcc904e992c43f86db|webook-staging'
```

Expected: the guard exits 0; the Supabase URL and Cloudflare account match the
approved Staging table exactly. Stop if either target is absent or ambiguous.

- [ ] **Step 2: Repeat release-candidate verification immediately before deployment**

```powershell
git status --short
npm.cmd run verify
npm.cmd run build
npx.cmd --no-install supabase migration list --local
```

Expected: clean intended worktree, all verification PASS, and the MVP 1
migration applied locally.

- [ ] **Step 3: Dry-run the Staging database migration**

Confirm `$env:STAGING_DB_URL` exists without printing it, then run:

```powershell
if (-not $env:STAGING_DB_URL) { throw 'STAGING_DB_URL is required' }
npx.cmd --no-install supabase db push --db-url $env:STAGING_DB_URL --dry-run
```

Expected: target project ref is `sxvkhzhqtrpxgzumsswl`; the dry run contains
the single CLI-generated MVP 1 migration and no unexpected historical repair.
If history differs, stop and investigate; do not use `--include-all`, repair,
or migration-history mutation automatically.

- [ ] **Step 4: Apply the Staging database migration**

```powershell
npx.cmd --no-install supabase db push --db-url $env:STAGING_DB_URL
```

Expected: the MVP 1 migration applies successfully. Verify with a read-only
query or Supabase migration list using the same secure connection; do not print
credentials or row data.

- [ ] **Step 5: Deploy the application to the Staging Cloudflare Worker**

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '0df55f166fa309dcc904e992c43f86db'
$env:OPEN_NEXT_DEPLOY = 'true'
npm.cmd run deploy:cf:staging
Remove-Item Env:OPEN_NEXT_DEPLOY
Remove-Item Env:CLOUDFLARE_ACCOUNT_ID
```

Expected: OpenNext build succeeds and Wrangler deploys `webook-staging` only.

- [ ] **Step 6: Complete authenticated Staging acceptance**

Using a disposable Staging quotation account and synthetic data:

1. confirm existing quotations render as Current;
2. set Hospitality as the account default and create a new quotation;
3. confirm the new draft starts as Hospitality;
4. save it and verify Preview, Print, downloaded PDF, and Public Read-only;
5. change the account default to Corporate and verify the saved Hospitality
   quotation remains Hospitality;
6. change that quotation to Corporate, verify Preview changes immediately and
   Public remains Hospitality before save, then save and verify all saved
   surfaces become Corporate;
7. repeat a Current quotation to confirm compatibility;
8. inspect mobile 390 px and desktop 1280 px plus A4 multi-page output.

Expected: all acceptance cases pass with no data loss, cross-account access,
content mismatch, clipping, or blank page.

- [ ] **Step 7: Close the MVP 1 gate**

Record the Staging deployment URL/version and acceptance date without secrets
in the task handoff. Confirm explicitly:

```text
MVP 1 Staging gate: PASS
Supabase project: sxvkhzhqtrpxgzumsswl
Cloudflare account: 0df55f166fa309dcc904e992c43f86db
MVP 2 implementation: unblocked
```

If any step fails, record `MVP 1 Staging gate: FAIL`, keep MVP 2 blocked, and
fix/reverify MVP 1. Do not deploy to Production under this plan.
