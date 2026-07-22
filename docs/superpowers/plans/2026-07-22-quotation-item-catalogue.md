# Quotation Item Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the five allowed quotation item names in a read-only Supabase catalogue and use it to drive and validate the quotation editor.

**Architecture:** A seeded `quotation_item_catalog` table is the single source of truth. Server pages load it through the quotation repository, the editor renders a native select and copies every selection into the editable description, and the save action reloads the catalogue before service validation. A `NOT VALID` foreign key preserves legacy rows while rejecting unsupported new writes.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Next.js App Router, React, TypeScript, `node:test`.

## Global Constraints

- Catalogue values are exactly the five Thai names in the approved design and remain read-only to the application.
- No admin CRUD, new dependency, custom select component, or client-side Supabase query.
- Selecting or changing a name always replaces the description; the description remains editable afterward.
- Existing unsupported names remain readable but must be reselected before saving.
- Only the main agent edits files; project subagents remain read-only.

---

### Task 1: Database Catalogue Boundary

**Files:**
- Create via Supabase CLI: `supabase/migrations/*_quotation_item_catalog.sql`
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Produces: `public.quotation_item_catalog(name text, sort_order smallint)` readable by quotation-authorized authenticated users.
- Produces: `quotation_items_name_catalog_fk`, enforced for new writes and not validated against legacy rows.

- [ ] **Step 1: Write the failing migration source test**

Find the migration by its fixed suffix, assert it exists, then assert the complete database boundary:

```ts
const catalogueMigration = readdirSync(
  new URL("../supabase/migrations/", import.meta.url),
).find((name) => name.endsWith("_quotation_item_catalog.sql"));

it("installs the read-only quotation item catalogue", () => {
  assert.ok(catalogueMigration);
  const catalogueSql = readFileSync(
    new URL(`../supabase/migrations/${catalogueMigration}`, import.meta.url),
    "utf8",
  );
  assert.match(catalogueSql, /create table public\.quotation_item_catalog/i);
  assert.match(catalogueSql, /name text primary key/i);
  assert.match(catalogueSql, /sort_order smallint not null unique check \(sort_order > 0\)/i);
  for (const name of [
    "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)",
    "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)",
    "ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)",
    "ค่าบริการ",
    "ประกันความเสียหาย",
  ]) assert.match(catalogueSql, new RegExp(name.replace(/[()/]/g, "\\$&")));
  assert.match(catalogueSql, /enable row level security/i);
  assert.match(catalogueSql, /revoke all .* quotation_item_catalog .* anon, authenticated/i);
  assert.match(catalogueSql, /grant select .* quotation_item_catalog to authenticated/i);
  assert.match(catalogueSql, /for select to authenticated[\s\S]*private\.has_quotation_permission\(\)/i);
  assert.match(catalogueSql, /quotation_items_name_catalog_fk[\s\S]*foreign key \(name\)[\s\S]*references public\.quotation_item_catalog\(name\)[\s\S]*not valid/i);
  assert.doesNotMatch(catalogueSql, /for (?:insert|update|delete)|grant (?:insert|update|delete)/i);
});
```

- [ ] **Step 2: Run the migration test and verify RED**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts`

Expected: FAIL because no `_quotation_item_catalog.sql` migration exists.

- [ ] **Step 3: Generate the migration with the installed CLI**

Run: `npx --no-install supabase migration new quotation_item_catalog`

Expected: the CLI prints one new migration path ending in `_quotation_item_catalog.sql`. Use that exact path in the following steps. Do not install or update packages.

- [ ] **Step 4: Add the minimal schema, rows, grants, RLS, and legacy-safe foreign key**

Write this SQL into the generated migration:

```sql
create table public.quotation_item_catalog (
  name text primary key,
  sort_order smallint not null unique check (sort_order > 0)
);

insert into public.quotation_item_catalog (name, sort_order) values
  ('ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)', 1),
  ('ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)', 2),
  ('ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)', 3),
  ('ค่าบริการ', 4),
  ('ประกันความเสียหาย', 5);

alter table public.quotation_item_catalog enable row level security;
revoke all privileges on table public.quotation_item_catalog from anon, authenticated;
grant select on table public.quotation_item_catalog to authenticated;

create policy "Quotation users read item catalogue"
  on public.quotation_item_catalog for select to authenticated
  using ((select private.has_quotation_permission()));

alter table public.quotation_items
  add constraint quotation_items_name_catalog_fk
  foreign key (name) references public.quotation_item_catalog(name)
  on update restrict on delete restrict not valid;
```

- [ ] **Step 5: Add database integration checks**

Change the integration payload item name to `ค่าบริการ`. Add assertions that an allowed quotation user reads the five rows ordered by `sort_order`, a denied user reads zero rows, authenticated writes fail, and a direct `save_quotation_with_payments` payload containing `รายการอื่น` returns PostgreSQL code `23503`.

```ts
it("exposes the ordered item catalogue as read-only to quotation users", async () => {
  const { data, error } = await allowed
    .from("quotation_item_catalog")
    .select("name")
    .order("sort_order");
  assert.equal(error, null, error?.message);
  assert.deepEqual((data ?? []).map((row) => row.name), [
    "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)",
    "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)",
    "ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)",
    "ค่าบริการ",
    "ประกันความเสียหาย",
  ]);

  const deniedRead = await denied.from("quotation_item_catalog").select("name");
  assert.equal(deniedRead.error, null, deniedRead.error?.message);
  assert.deepEqual(deniedRead.data, []);

  const write = await allowed
    .from("quotation_item_catalog")
    .insert({ name: "รายการอื่น", sort_order: 6 });
  assert.equal(write.error?.code, "42501");
});

it("rejects unsupported item names in the direct save RPC", async () => {
  const invalid = payload(null);
  invalid.items[0]!.name = "รายการอื่น";
  const { error } = await allowed.rpc("save_quotation_with_payments", {
    p_payload: invalid,
  });
  assert.equal(error?.code, "23503");
});
```

- [ ] **Step 6: Verify GREEN**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts`

Expected: PASS.

If the local Supabase test environment is configured, also run: `node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts`

Expected: PASS, or SKIP when `RUN_LOCAL_SUPABASE_TESTS` and `RUN_QUOTATION_DB_TESTS` are both unset.

- [ ] **Step 7: Commit**

```bash
git add tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts supabase/migrations/*_quotation_item_catalog.sql
git commit -m "feat: add quotation item catalogue"
```

### Task 2: Server Loading and Validation

**Files:**
- Modify: `server/repositories/quotations.ts`
- Modify: `server/services/quotations.ts`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `tests/quotation-service.test.ts`
- Modify: `tests/quotation-certification.test.ts`
- Modify: `tests/quotation-repository-actions.test.ts`

**Interfaces:**
- Produces: `listQuotationItemNames(supabase: SupabaseClient): Promise<string[]>`.
- Changes: `prepareQuotationPayload(value: unknown, itemNames: readonly string[]): PreparedQuotation`.
- Consumes: `public.quotation_item_catalog` from Task 1.

- [ ] **Step 1: Write failing service and repository/action tests**

Use this catalogue in service tests and make the valid fixture use `ค่าบริการ`:

```ts
const itemNames = [
  "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)",
  "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)",
  "ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)",
  "ค่าบริการ",
  "ประกันความเสียหาย",
] as const;

it("rejects item names outside the database catalogue", () => {
  const value = validPayload();
  value.items[0]!.name = "รายการอื่น";
  assert.throws(
    () => prepareQuotationPayload(value, itemNames),
    (error) => error instanceof QuotationValidationError
      && error.fieldErrors["items.0.name"] === "กรุณาเลือกชื่อรายการจากรายการที่กำหนด",
  );
});
```

Update every existing service/certification test call to pass `itemNames`. In repository/action source tests assert:

```ts
assert.match(repository, /export async function listQuotationItemNames/);
assert.match(repository, /from\("quotation_item_catalog"\)[\s\S]*select\("name"\)[\s\S]*order\("sort_order"\)/);
assert.match(actions, /const itemNames = await listQuotationItemNames\(supabase\)/);
assert.match(actions, /prepareQuotationPayload\(value, itemNames\)/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-certification.test.ts tests/quotation-repository-actions.test.ts`

Expected: FAIL because catalogue loading and membership validation do not exist.

- [ ] **Step 3: Implement ordered repository loading**

Add beside `listQuotationBanks`:

```ts
export async function listQuotationItemNames(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("quotation_item_catalog")
    .select("name")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => stringValue(item.name));
}
```

- [ ] **Step 4: Implement service membership validation**

Change the signature and item-name branch:

```ts
export function prepareQuotationPayload(
  value: unknown,
  itemNames: readonly string[],
): PreparedQuotation {
  // existing parsing
}

const name = bounded(stringValue(item, "name"), 200, `${prefix}.name`, errors);
if (!name) errors[`${prefix}.name`] = REQUIRED_MESSAGES.itemName;
else if (!itemNames.includes(name)) {
  errors[`${prefix}.name`] = "กรุณาเลือกชื่อรายการจากรายการที่กำหนด";
}
```

- [ ] **Step 5: Load trusted names in the save action**

Import `listQuotationItemNames` and, after `canUseQuotation` succeeds, use:

```ts
const itemNames = await listQuotationItemNames(supabase);
const prepared = prepareQuotationPayload(value, itemNames);
```

- [ ] **Step 6: Verify GREEN**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-certification.test.ts tests/quotation-repository-actions.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/repositories/quotations.ts server/services/quotations.ts app/admin/quotations/actions.ts tests/quotation-service.test.ts tests/quotation-certification.test.ts tests/quotation-repository-actions.test.ts
git commit -m "feat: validate quotation item catalogue"
```

### Task 3: Server-Hydrated Item Select

**Files:**
- Modify: `app/admin/quotations/new/page.tsx`
- Modify: `app/admin/quotations/[id]/page.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: `listQuotationItemNames` from Task 2.
- Changes: `QuotationEditorProps` gains `itemNames: string[]`.
- Behavior: selecting an item name calls `onUpdate("name", name)` and `onUpdate("description", name)`.

- [ ] **Step 1: Write the failing UI source regression test**

```ts
it("loads the database item catalogue and uses it as the item-name select", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const newPage = source("../app/admin/quotations/new/page.tsx");
  const editPage = source("../app/admin/quotations/[id]/page.tsx");
  const itemDetails = editor.slice(
    editor.indexOf("function ItemDetailsControls"),
    editor.indexOf("function ItemQuantityControl"),
  );
  assert.match(newPage, /listQuotationItemNames\(supabase\)/);
  assert.match(editPage, /listQuotationItemNames\(supabase\)/);
  assert.match(newPage, /itemNames=\{itemNames\}/);
  assert.match(editPage, /itemNames=\{itemNames\}/);
  assert.match(editor, /itemNames: string\[\]/);
  assert.match(itemDetails, /<select[\s\S]*aria-label="ชื่อรายการ"[\s\S]*itemNames\.map/);
  assert.match(itemDetails, /onUpdate\("name", name\)[\s\S]*onUpdate\("description", name\)/);
  assert.match(itemDetails, /disabled[\s\S]*ค่าเดิม[\s\S]*กรุณาเลือกใหม่/);
  assert.doesNotMatch(itemDetails, /<Input/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`

Expected: FAIL because pages do not load the catalogue and the editor still uses a free-text input.

- [ ] **Step 3: Hydrate both server pages**

Import `listQuotationItemNames`, add it to each existing `Promise.all`, and pass `itemNames={itemNames}` into `QuotationEditor`. Keep the existing permission check before the queries.

```tsx
const [profile, banks, paymentMethods, itemNames] = await Promise.all([
  getQuotationCompanyProfile(supabase, user.id),
  listQuotationBanks(supabase),
  listCompanyPaymentMethods(supabase, user.id),
  listQuotationItemNames(supabase),
]);

const [quotation, banks, itemNames] = await Promise.all([
  getQuotationById(supabase, id),
  listQuotationBanks(supabase),
  listQuotationItemNames(supabase),
]);

return <QuotationEditor banks={banks} documentNumber={null} initialPayload={initialPayload} itemNames={itemNames} publicOrigin={publicOrigin} publicToken={null} />;

return <QuotationEditor banks={banks} documentNumber={quotation.documentNumber} initialPayload={initialPayload} itemNames={itemNames} printOnLoad={print === "1"} publicOrigin={publicOrigin} publicToken={quotation.publicToken} />;
```

- [ ] **Step 4: Render the native select and overwrite description**

Add `itemNames` to `QuotationEditorProps` and `ItemProps`, pass it through `itemProps`, and replace the name `Input` with:

```tsx
const legacyItemName = item.name && !itemNames.includes(item.name)
  ? item.name
  : null;

<select
  aria-describedby={error("name") ? fieldErrorId(`items.${index}.name`) : undefined}
  aria-invalid={Boolean(error("name"))}
  aria-label="ชื่อรายการ"
  className={cn("w-full", selectClassName)}
  data-field={`items.${index}.name`}
  onChange={(event) => {
    const name = event.target.value;
    onUpdate("name", name);
    onUpdate("description", name);
  }}
  value={item.name}
>
  <option value="">เลือกรายการ</option>
  {legacyItemName ? (
    <option disabled value={legacyItemName}>
      ค่าเดิม: {legacyItemName} — กรุณาเลือกใหม่
    </option>
  ) : null}
  {itemNames.map((name) => (
    <option key={name} value={name}>{name}</option>
  ))}
</select>
```

- [ ] **Step 5: Update feature documentation**

Replace the deferred free-text statement in `docs/quotation-management.md` with the five DB-backed, read-only catalogue values, server validation, legacy reselection behavior, and description overwrite behavior.

- [ ] **Step 6: Verify GREEN and responsive integrity**

Run: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no missing `itemNames` prop or changed service signature.

- [ ] **Step 7: Commit**

```bash
git add app/admin/quotations/new/page.tsx app/admin/quotations/[id]/page.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts docs/quotation-management.md
git commit -m "feat: select quotation items from catalogue"
```

### Task 4: Final Verification and Read-Only Review

**Files:**
- Verify all files changed in Tasks 1-3.

**Interfaces:**
- Consumes the complete feature.
- Produces a verified implementation ready for handoff.

- [ ] **Step 1: Run required checks**

Run individually:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands PASS. If the database integration suite is skipped, report the missing local Supabase environment explicitly.

- [ ] **Step 2: Spawn the required read-only `webook_reviewer`**

Ask it to compare the implementation against the approved spec, inspect security/RLS/FK behavior, legacy handling, server validation, UI accessibility, tests, and documentation. It must not edit files, install dependencies, deploy, or modify remote databases.

- [ ] **Step 3: Fix only evidence-supported findings with a failing regression test first**

For each accepted finding, run its focused test RED, apply the smallest correction, then rerun the focused test GREEN.

- [ ] **Step 4: Re-run required checks**

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 5: Commit reviewer-supported corrections if any**

Use `git status --short` to identify only the files changed for accepted Step 3 findings, stage those exact files, and commit them with `git commit -m "fix: harden quotation item catalogue"`. Skip this step when the reviewer has no supported findings.
