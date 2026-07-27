# Quotation ข้อมูลลูกค้า With DBD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared quotation ข้อมูลลูกค้า for juristic and individual customers, with optional contacts, manual DBD verification/default reset, and independent quotation snapshots.

**Architecture:** A new RLS-protected `quotation_customers` table is shared by users who pass the existing quotation permission function. Focused server-only modules own DBD parsing, customer validation, and persistence; server actions are the only browser mutation/search boundary. The approved admin page reuses existing Shadcn primitives, and the quotation editor copies only the five existing customer snapshot fields.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind, ShadcnUI, Supabase PostgreSQL/Auth/RLS, native `fetch`, Node.js `node:test`.

## Global Constraints

- Do not add, remove, or upgrade dependencies.
- Create the schema change with the local Supabase CLI; never edit an existing migration.
- Do not deploy or modify a remote database while implementing this plan.
- Enable RLS and use explicit grants on the new `public` table. Current Supabase guidance treats grants and RLS as separate required controls.
- Reuse `private.has_quotation_permission()`; never authorize from user-editable metadata.
- Keep DBD calls server-only and fixed to `https://openapi.dbd.go.th/api/v1/juristic_person/{taxId}`.
- Do not persist or log the full DBD payload.
- Require exactly 13 ASCII digits for both customer types.
- Optional `contactName`, `contactPhone`, and `contactEmail` remain master-only.
- Keep quotation `CustomerSnapshot` unchanged and do not add a customer foreign key to quotations.
- Do not import historical quotation customers.
- Do not create separate branch rows for the same tax ID.
- Use deactivation/reactivation; do not hard-delete customers.
- Use the approved ordinary admin layout, not House Workspace Shell.
- Verify mobile, tablet, laptop, and desktop layouts.
- Only the main agent edits files. Project subagents are read-only reviewers/explorers.

---

## File Map

### Create

- `lib/quotation-customer-types.ts` — browser-safe ข้อมูลลูกค้า contracts and snapshot conversion.
- `server/services/dbd-juristic-person.ts` — native-fetch DBD adapter and defensive parser.
- `server/services/quotation-customers.ts` — ข้อมูลลูกค้า normalization and validation.
- `server/repositories/quotation-customers.ts` — Supabase row mapping, pagination, search, and mutations.
- `app/admin/quotations/customers/actions.ts` — permission-checked customer/DBD server actions.
- `app/admin/quotations/customers/page.tsx` — protected ข้อมูลลูกค้า page.
- `components/admin/quotations/customers/customer-form.tsx` — reusable add/edit form and DBD controls.
- `components/admin/quotations/customers/customer-list.tsx` — approved table/card list and row actions.
- `components/admin/quotations/customers/customer-picker-dialog.tsx` — search/select/inline-create dialog for the editor.
- `tests/quotation-customer-dbd.test.ts` — DBD response and network-boundary tests.
- `tests/quotation-customer-service.test.ts` — normalization, validation, reset, and snapshot tests.
- `tests/quotation-customer-migration.test.ts` — SQL structure/grant/RLS assertions.
- `tests/quotation-customer-repository-actions.test.ts` — repository/action boundary assertions.
- `tests/quotation-customer-ui.test.ts` — page/list/form/picker responsive contract assertions.
- `tests/quotation-customer-database-integration.test.ts` — optional local Supabase RLS and sharing verification.
- `supabase/migrations/*_quotation_customer_master_dbd.sql` — exact CLI-generated path printed during Task 2.

### Modify

- `components/layout/admin-desktop-sidebar.tsx` — quotation sub-navigation for list and ข้อมูลลูกค้า.
- `app/admin/quotations/page.tsx` — visible ข้อมูลลูกค้า entry action.
- `components/admin/quotations/quotation-editor.tsx` — picker trigger and atomic snapshot replacement.
- `README.md` — route/capability summary.
- `docs/architecture.md` — DBD/server/RLS data flow.
- `docs/quotation-management.md` — user behavior and validation.

## Stable Interfaces

Define these names once and keep them unchanged across tasks:

```ts
export type QuotationCustomerType = "juristic" | "individual";

export interface DbdCustomerDefaults {
  address: string;
  name: string;
  status: string;
  taxId: string;
  verifiedAt: string;
}

export interface QuotationCustomerMaster {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  customerType: QuotationCustomerType;
  dbdAddress: string | null;
  dbdName: string | null;
  dbdStatus: string | null;
  dbdVerifiedAt: string | null;
  id: string;
  isActive: boolean;
  name: string;
  officeType: OfficeType;
  taxId: string;
  updatedAt: string;
}

export interface QuotationCustomerInput {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  customerType: QuotationCustomerType;
  id: string | null;
  name: string;
  officeType: OfficeType;
  saveUnverified: boolean;
  taxId: string;
}

export function quotationCustomerToSnapshot(
  customer: QuotationCustomerMaster,
): CustomerSnapshot;
```

The only accepted action results are:

```ts
export type CustomerMutationResult =
  | { customer: QuotationCustomerMaster; ok: true }
  | {
      existingCustomer?: QuotationCustomerMaster;
      fieldErrors: Record<string, string>;
      formError: string;
      ok: false;
      requiresUnverifiedConfirmation?: boolean;
    };

export type DbdLookupActionResult =
  | { defaults: DbdCustomerDefaults; ok: true }
  | { formError: string; ok: false; reason: "not_found" | "unavailable" };
```

---

### Task 1: Customer Domain And DBD Adapter

**Files:**
- Create: `lib/quotation-customer-types.ts`
- Create: `server/services/dbd-juristic-person.ts`
- Create: `server/services/quotation-customers.ts`
- Test: `tests/quotation-customer-dbd.test.ts`
- Test: `tests/quotation-customer-service.test.ts`

**Interfaces:**
- Consumes: `OfficeType` and `CustomerSnapshot` from `lib/quotation-types.ts`; native `fetch`.
- Produces: all contracts under **Stable Interfaces**, `lookupDbdJuristicPerson()`, `prepareQuotationCustomerInput()`, `resetQuotationCustomerFromDbd()`.

- [ ] **Step 1: Write failing DBD parser tests**

Create `tests/quotation-customer-dbd.test.ts` with focused fixtures. Use valid UTF-8 Thai strings and inject `fetchImpl`; never call the live service.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lookupDbdJuristicPerson } from "../server/services/dbd-juristic-person.ts";

const successBody = {
  status: { code: "1000", description: "Success" },
  data: [{
    "cd:OrganizationJuristicPerson": {
      "cd:OrganizationJuristicAddress": {
        "cr:AddressType": {
          "cd:Address": "99 ถนนสุขุมวิท",
          "cd:CitySubDivision": { "cr:CitySubDivisionTextTH": "คลองตันเหนือ" },
          "cd:City": { "cr:CityTextTH": "เขตวัฒนา" },
          "cd:CountrySubDivision": { "cr:CountrySubDivisionTextTH": "กรุงเทพมหานคร" },
        },
      },
      "cd:OrganizationJuristicID": "0107544000108",
      "cd:OrganizationJuristicNameTH": "บริษัท ตัวอย่าง จำกัด",
      "cd:OrganizationJuristicStatus": "ยังดำเนินกิจการอยู่",
    },
  }],
};

describe("DBD juristic lookup", () => {
  it("maps namespaced fields and composes a null-safe address", async () => {
    const result = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response(JSON.stringify(successBody), { status: 200 }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.defaults, {
      address: "99 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร",
      name: "บริษัท ตัวอย่าง จำกัด",
      status: "ยังดำเนินกิจการอยู่",
      taxId: "0107544000108",
      verifiedAt: result.defaults.verifiedAt,
    });
    assert.match(result.defaults.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("maps non-1000, non-JSON, HTTP failure, and abort to safe reasons", async () => {
    const notFound = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response(JSON.stringify({ status: { code: "1001" }, data: [] })));
    assert.deepEqual(notFound, { ok: false, reason: "not_found" });
    const invalid = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response("not-json", { status: 200 }));
    assert.deepEqual(invalid, { ok: false, reason: "unavailable" });
    const failed = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response("", { status: 503 }));
    assert.deepEqual(failed, { ok: false, reason: "unavailable" });
    const aborted = await lookupDbdJuristicPerson("0107544000108", async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    assert.deepEqual(aborted, { ok: false, reason: "unavailable" });
  });
});
```

- [ ] **Step 2: Run the DBD test and confirm it fails**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-dbd.test.ts
```

Expected: FAIL because `server/services/dbd-juristic-person.ts` does not exist.

- [ ] **Step 3: Implement the browser-safe contracts and DBD adapter**

In `lib/quotation-customer-types.ts`, define the stable interfaces exactly as listed above and add:

```ts
export function quotationCustomerToSnapshot(
  customer: QuotationCustomerMaster,
): CustomerSnapshot {
  return {
    address: customer.address,
    branchNumber: customer.officeType === "branch" ? customer.branchNumber : "",
    name: customer.name,
    officeType: customer.officeType,
    taxId: customer.taxId,
  };
}
```

In `server/services/dbd-juristic-person.ts`, export:

```ts
export type DbdLookupResult =
  | { defaults: DbdCustomerDefaults; ok: true }
  | { ok: false; reason: "not_found" | "unavailable" };

export async function lookupDbdJuristicPerson(
  taxId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DbdLookupResult>;
```

Implementation requirements:

```ts
const DBD_URL = "https://openapi.dbd.go.th/api/v1/juristic_person";
const TAX_ID = /^[0-9]{13}$/;

const response = await fetchImpl(`${DBD_URL}/${encodeURIComponent(taxId)}`, {
  cache: "no-store",
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(5_000),
});
```

Narrow every response level from `unknown`; require status code `1000`, one
`cd:OrganizationJuristicPerson` object, matching tax ID, nonblank Thai name,
nonblank composed address, and a string status. Build the Thai address from
`cd:Address`, subdistrict, district, and province, prefixing `แขวง`/`เขต` for
Bangkok and `ตำบล`/`อำเภอ` elsewhere. Catch all provider/parse errors and return
only `not_found` or `unavailable`.

- [ ] **Step 4: Write and run customer validation tests**

Create `tests/quotation-customer-service.test.ts` covering:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  prepareQuotationCustomerInput,
  resetQuotationCustomerFromDbd,
} from "../server/services/quotation-customers.ts";

const valid = {
  address: "ที่อยู่ลูกค้า",
  branchNumber: "",
  contactEmail: " account@example.com ",
  contactName: " ฝ่ายบัญชี ",
  contactPhone: " 0812345678 ",
  customerType: "juristic",
  id: null,
  name: " บริษัท ตัวอย่าง จำกัด ",
  officeType: "head_office",
  saveUnverified: false,
  taxId: "0107544000108",
};

describe("quotation customer service", () => {
  it("trims valid input and keeps contacts optional", () => {
    const result = prepareQuotationCustomerInput(valid);
    assert.equal(result.name, "บริษัท ตัวอย่าง จำกัด");
    assert.equal(result.contactEmail, "account@example.com");
  });

  it("rejects malformed tax ID, email, branch, and required fields", () => {
    assert.throws(() => prepareQuotationCustomerInput({
      ...valid,
      address: "",
      contactEmail: "invalid",
      officeType: "branch",
      taxId: "๐107544000108",
    }));
  });

  it("resets only current DBD-backed fields", () => {
    const result = resetQuotationCustomerFromDbd({
      ...valid,
      branchNumber: "00001",
      officeType: "branch",
    }, {
      address: "ที่อยู่ DBD",
      name: "ชื่อ DBD",
      status: "ยังดำเนินกิจการอยู่",
      taxId: valid.taxId,
      verifiedAt: "2026-07-22T00:00:00.000Z",
    });
    assert.equal(result.name, "ชื่อ DBD");
    assert.equal(result.address, "ที่อยู่ DBD");
    assert.equal(result.officeType, "head_office");
    assert.equal(result.branchNumber, "");
    assert.equal(result.contactName, " ฝ่ายบัญชี ");
  });
});
```

Run both targeted files. Expected: FAIL before `server/services/quotation-customers.ts` exists, then PASS after implementing strict unknown narrowing, 200/2,000-character limits matching quotation services, exact tax ID, optional email syntax, and branch normalization.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- lib/quotation-customer-types.ts server/services/dbd-juristic-person.ts server/services/quotation-customers.ts tests/quotation-customer-dbd.test.ts tests/quotation-customer-service.test.ts
git commit -m "feat: add quotation customer and DBD domain services"
```

---

### Task 2: Customer Schema, Grants, RLS, And Local Database Check

**Files:**
- Create: `supabase/migrations/*_quotation_customer_master_dbd.sql`
- Create: `tests/quotation-customer-migration.test.ts`
- Create: `tests/quotation-customer-database-integration.test.ts`

**Interfaces:**
- Consumes: `private.has_quotation_permission()` from existing quotation migrations.
- Produces: `public.quotation_customers` and `public.list_quotation_customers(integer, integer, text, boolean)`.

- [ ] **Step 1: Write the failing migration structure test**

Create `tests/quotation-customer-migration.test.ts`. Locate the migration by the
approved suffix, then assert the table, constraints, grants, RLS, policies,
trigger, list RPC, no delete grant, and no destructive statements:

```ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const name = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((entry) => entry.endsWith("_quotation_customer_master_dbd.sql"));
assert.ok(name, "customer migration must be created by the Supabase CLI");
const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

describe("quotation customer migration", () => {
  it("creates the shared customer boundary", () => {
    assert.match(sql, /create table public\.quotation_customers/i);
    assert.match(sql, /tax_id text not null unique/i);
    assert.match(sql, /tax_id ~ '\^\[0-9\]\{13\}\$'/i);
    assert.match(sql, /quotation_customers_dbd_complete/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all .* from anon, authenticated/i);
    assert.match(sql, /grant select, insert, update .* to authenticated/i);
    assert.doesNotMatch(sql, /grant delete .* authenticated/i);
    assert.match(sql, /private\.has_quotation_permission\(\)/i);
    assert.match(sql, /create or replace function public\.list_quotation_customers/i);
    assert.doesNotMatch(sql, /^\s*(?:drop table|truncate)\b/im);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-migration.test.ts
```

Expected: FAIL because no CLI-generated migration has the required suffix.

- [ ] **Step 3: Create the migration with the local CLI**

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'
.\node_modules\.bin\supabase.cmd migration new quotation_customer_master_dbd
$migrationPath = (Get-ChildItem 'supabase/migrations/*_quotation_customer_master_dbd.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$migrationPath
```

Expected: one exact generated SQL path is printed. Use only that path in the
remaining Task 2 steps.

- [ ] **Step 4: Implement the schema and secure list function**

Put these operations in the generated migration:

```sql
create table public.quotation_customers (
  id uuid primary key default gen_random_uuid(),
  customer_type text not null check (customer_type in ('juristic', 'individual')),
  tax_id text not null unique check (tax_id ~ '^[0-9]{13}$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text not null check (char_length(btrim(address)) between 1 and 2000),
  office_type text not null default 'unspecified'
    check (office_type in ('head_office', 'branch', 'unspecified')),
  branch_number text not null default ''
    check (char_length(branch_number) <= 200 and (office_type <> 'branch' or btrim(branch_number) <> '')),
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  contact_phone text not null default '' check (char_length(contact_phone) <= 200),
  contact_email text not null default '' check (
    char_length(contact_email) <= 200
    and (contact_email = '' or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  dbd_name text check (dbd_name is null or char_length(dbd_name) between 1 and 200),
  dbd_address text check (dbd_address is null or char_length(dbd_address) between 1 and 2000),
  dbd_status text check (dbd_status is null or char_length(dbd_status) between 1 and 200),
  dbd_verified_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_customers_dbd_complete check (
    (dbd_name is null and dbd_address is null and dbd_status is null and dbd_verified_at is null)
    or (
      customer_type = 'juristic'
      and dbd_name is not null
      and dbd_address is not null
      and dbd_status is not null
      and dbd_verified_at is not null
    )
  )
);

create index quotation_customers_active_name_idx
  on public.quotation_customers (is_active, lower(name), updated_at desc);

create or replace function private.touch_quotation_customer()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger quotation_customers_touch
before update on public.quotation_customers
for each row execute function private.touch_quotation_customer();

alter table public.quotation_customers enable row level security;
revoke all privileges on table public.quotation_customers from public, anon, authenticated;
grant select, insert, update on table public.quotation_customers to authenticated;

create policy "Quotation users manage shared customers"
on public.quotation_customers for all to authenticated
using ((select private.has_quotation_permission()))
with check ((select private.has_quotation_permission()));

create or replace function public.list_quotation_customers(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default '',
  p_active boolean default true
)
returns table (
  id uuid, customer_type text, tax_id text, name text, address text,
  office_type text, branch_number text, contact_name text, contact_phone text,
  contact_email text, dbd_name text, dbd_address text, dbd_status text,
  dbd_verified_at timestamptz, is_active boolean, updated_at timestamptz,
  total_count bigint
)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.customer_type, c.tax_id, c.name, c.address,
    c.office_type, c.branch_number, c.contact_name, c.contact_phone,
    c.contact_email, c.dbd_name, c.dbd_address, c.dbd_status,
    c.dbd_verified_at, c.is_active, c.updated_at, count(*) over ()
  from public.quotation_customers c
  where c.is_active = p_active
    and (
      nullif(btrim(p_search), '') is null
      or c.name ilike '%' || btrim(p_search) || '%'
      or c.tax_id ilike '%' || btrim(p_search) || '%'
      or c.contact_name ilike '%' || btrim(p_search) || '%'
      or c.contact_phone ilike '%' || btrim(p_search) || '%'
      or c.contact_email ilike '%' || btrim(p_search) || '%'
    )
  order by c.updated_at desc, c.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100);
$$;

revoke all on function public.list_quotation_customers(integer, integer, text, boolean)
  from public, anon;
grant execute on function public.list_quotation_customers(integer, integer, text, boolean)
  to authenticated;
```

- [ ] **Step 5: Add the local integration check and run Task 2 verification**

Create `tests/quotation-customer-database-integration.test.ts`, following the
existing conditional local-test setup. It must create two users with
`allow_quotation`, one denied user, and assert:

```ts
const inserted = await allowed.from("quotation_customers").insert({
  address: "Shared address",
  customer_type: "juristic",
  name: "Shared customer",
  office_type: "head_office",
  tax_id: "0107544000108",
}).select("id").single();
assert.equal(inserted.error, null, inserted.error?.message);

const sharedRead = await otherAllowed.from("quotation_customers")
  .select("id").eq("id", inserted.data.id).single();
assert.equal(sharedRead.error, null, sharedRead.error?.message);

const deniedRead = await denied.from("quotation_customers").select("id");
assert.equal(deniedRead.error, null, deniedRead.error?.message);
assert.deepEqual(deniedRead.data, []);

const hardDelete = await allowed.from("quotation_customers")
  .delete().eq("id", inserted.data.id);
assert.equal(hardDelete.error?.code, "42501");
```

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-migration.test.ts
$env:RUN_LOCAL_SUPABASE_TESTS='1'
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-database-integration.test.ts
```

Expected: migration test PASS. Run the integration test only when the existing
local Supabase environment variables and container are available; otherwise
record it as skipped for the final handoff.

Commit:

```powershell
git add -- supabase/migrations/*_quotation_customer_master_dbd.sql tests/quotation-customer-migration.test.ts tests/quotation-customer-database-integration.test.ts
git commit -m "feat: add shared quotation customer schema"
```

---

### Task 3: Repository And Permission-Checked Server Actions

**Files:**
- Create: `server/repositories/quotation-customers.ts`
- Create: `app/admin/quotations/customers/actions.ts`
- Create: `tests/quotation-customer-repository-actions.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts/services, Task 2 table/RPC, `requireAdmin()`, `canUseQuotation()`.
- Produces: `listQuotationCustomers()`, `getQuotationCustomer()`, `saveQuotationCustomerAction()`, `lookupQuotationCustomerDbdAction()`, `refreshQuotationCustomerDbdAction()`, `setQuotationCustomerActiveAction()`, `searchActiveQuotationCustomersAction()`.

- [ ] **Step 1: Write failing repository/action boundary tests**

Assert exact imports and source boundaries:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repository = readFileSync(new URL("../server/repositories/quotation-customers.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/admin/quotations/customers/actions.ts", import.meta.url), "utf8");

describe("quotation customer repository and actions", () => {
  it("uses the safe list RPC and never hard deletes", () => {
    assert.match(repository, /\.rpc\("list_quotation_customers"/);
    assert.match(repository, /\.from\("quotation_customers"\)/);
    assert.doesNotMatch(repository, /\.delete\(\)/);
  });

  it("checks permission before every action", () => {
    assert.match(actions, /requireAdmin\(\)/);
    assert.match(actions, /canUseQuotation\(adminUser\)/);
    assert.match(actions, /lookupDbdJuristicPerson/);
    assert.doesNotMatch(actions, /serviceRole|SUPABASE_SERVICE_ROLE/i);
  });

  it("persists trusted DBD defaults only after a server lookup", () => {
    assert.match(actions, /lookupDbdJuristicPerson\(prepared\.taxId\)/);
    assert.match(actions, /requiresUnverifiedConfirmation: true/);
    assert.doesNotMatch(actions, /value\.dbd(?:Name|Address|Status|VerifiedAt)/);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-repository-actions.test.ts
```

Expected: FAIL because both implementation files are absent.

- [ ] **Step 3: Implement the focused repository**

Map database `unknown` values defensively into `QuotationCustomerMaster`. Export:

```ts
export interface QuotationCustomerListResult {
  items: QuotationCustomerMaster[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listQuotationCustomers(
  supabase: SupabaseClient,
  options: { active: boolean; page: number; pageSize: number; search: string },
): Promise<QuotationCustomerListResult>;

export async function getQuotationCustomer(
  supabase: SupabaseClient,
  id: string,
): Promise<QuotationCustomerMaster | null>;

export async function findQuotationCustomerByTaxId(
  supabase: SupabaseClient,
  taxId: string,
): Promise<QuotationCustomerMaster | null>;

export async function insertQuotationCustomer(
  supabase: SupabaseClient,
  input: QuotationCustomerInput,
  defaults: DbdCustomerDefaults | null,
): Promise<QuotationCustomerMaster>;

export async function updateQuotationCustomer(
  supabase: SupabaseClient,
  input: QuotationCustomerInput,
): Promise<QuotationCustomerMaster>;

export async function updateQuotationCustomerDbd(
  supabase: SupabaseClient,
  id: string,
  defaults: DbdCustomerDefaults,
): Promise<QuotationCustomerMaster>;

export async function setQuotationCustomerActive(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
): Promise<QuotationCustomerMaster>;
```

For `individual`, inserts/updates explicitly write every DBD column as null.
For type changes and ordinary juristic edits, do not accept DBD values from the
caller. Resolve unique races by catching Postgres `23505`, calling
`findQuotationCustomerByTaxId()`, and returning the existing row to the action.

- [ ] **Step 4: Implement actions and safe failure mapping**

All actions call this guard first:

```ts
async function requireQuotationAccess() {
  const context = await requireAdmin();
  if (!canUseQuotation(context.adminUser)) throw new Error("quotation_access_denied");
  return context;
}
```

Behavior must be exact:

- `lookupQuotationCustomerDbdAction(taxId)` validates 13 digits, calls DBD, and
  returns only `DbdLookupActionResult`.
- New `juristic` save rechecks DBD on the server unless `saveUnverified` is true.
- Failed required lookup returns `requiresUnverifiedConfirmation: true` without
  a database mutation.
- New `individual` save skips DBD and stores null defaults.
- Edit save changes only current/customer/contact fields; DBD defaults remain
  unchanged unless changing to `individual`, which clears them.
- Duplicate create returns `existingCustomer` and Thai copy directing the user
  to review/reactivate it.
- Refresh loads the stored row, rejects individual customers, calls DBD using
  the stored tax ID, and updates only DBD columns.
- Active toggle changes only `is_active`.
- Search action always requests `active: true`, `page: 1`, and `pageSize: 50`.
- Logs contain only the operation name and normalized `Error.message`; action
  results never expose raw database or provider payloads.

Add `revalidatePath("/admin/quotations/customers")` after mutations.

- [ ] **Step 5: Run and commit Task 3**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-repository-actions.test.ts tests/quotation-customer-dbd.test.ts tests/quotation-customer-service.test.ts
git add -- server/repositories/quotation-customers.ts app/admin/quotations/customers/actions.ts tests/quotation-customer-repository-actions.test.ts
git commit -m "feat: add quotation customer server actions"
```

Expected: targeted tests PASS.

---

### Task 4: ข้อมูลลูกค้า Page, Form, List, And Navigation

**Files:**
- Create: `app/admin/quotations/customers/page.tsx`
- Create: `components/admin/quotations/customers/customer-form.tsx`
- Create: `components/admin/quotations/customers/customer-list.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Modify: `app/admin/quotations/page.tsx`
- Create: `tests/quotation-customer-ui.test.ts`

**Interfaces:**
- Consumes: Task 3 list repository and actions.
- Produces: `QuotationCustomerForm`, `QuotationCustomerList`, approved customer route and navigation.

- [ ] **Step 1: Write failing UI contract tests**

Create source-contract tests for:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("quotation customer UI", () => {
  it("protects and renders the approved customer page", () => {
    const page = source("../app/admin/quotations/customers/page.tsx");
    assert.match(page, /requireAdmin\(\)/);
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /listQuotationCustomers/);
    assert.match(page, /ข้อมูลลูกค้า/);
  });

  it("uses cards on mobile and a table on larger screens", () => {
    const list = source("../components/admin/quotations/customers/customer-list.tsx");
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden[^"]*md:block/);
    assert.match(list, /<Table/);
    assert.match(list, /setQuotationCustomerActiveAction/);
  });

  it("shows DBD only for juristic customers and keeps contacts master-only", () => {
    const form = source("../components/admin/quotations/customers/customer-form.tsx");
    assert.match(form, /customerType === "juristic"/);
    assert.match(form, /lookupQuotationCustomerDbdAction/);
    assert.match(form, /บันทึกแบบยังไม่ยืนยัน/);
    assert.match(form, /resetQuotationCustomerFromDbd/);
    assert.match(form, /contactName/);
    assert.match(form, /contactPhone/);
    assert.match(form, /contactEmail/);
  });
});
```

- [ ] **Step 2: Run the UI test and confirm failure**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
```

Expected: FAIL because the customer page/components are absent.

- [ ] **Step 3: Implement the protected server page**

`app/admin/quotations/customers/page.tsx` must:

- parse `q`, `page`, and `status=active|inactive`,
- call `requireAdmin()` and reject without `canUseQuotation`,
- call `listQuotationCustomers()` with page size 20,
- render the approved title/subtitle, search, status filter, count, add action,
- reuse `Pagination`, `Empty`, `Skeleton`, `Input`, and `Button`,
- render `QuotationCustomerList` for results,
- use ordinary admin content without House Workspace Shell.

Use these stable query values:

```ts
const active = status !== "inactive";
const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
const search = q?.trim() ?? "";
```

- [ ] **Step 4: Implement the shared form and approved responsive list**

`QuotationCustomerForm` props:

```ts
export interface QuotationCustomerFormProps {
  customer: QuotationCustomerMaster | null;
  onCancel: () => void;
  onSaved: (customer: QuotationCustomerMaster) => void;
}
```

Form requirements:

- radio customer type,
- required name/address/tax ID,
- office type and conditionally enabled branch number,
- optional contact name/phone/email,
- juristic-only check/refresh/reset controls and visible DBD status/date,
- preview defaults returned from lookup,
- explicit confirmation Dialog before retrying save with
  `saveUnverified: true`,
- server field errors connected with `aria-invalid`/`aria-describedby`,
- one pending state that disables duplicate submissions,
- successful toast and callback.

`QuotationCustomerList` props:

```ts
export function QuotationCustomerList({
  customers,
}: {
  customers: QuotationCustomerMaster[];
})
```

Match the approved mockup: cards below `md`, table at `md` and above, customer
type badge, office label, tax ID, optional contact summary, DBD verification
state/date, and an existing DropdownMenu for edit/deactivate/reactivate. Add a
confirmation Dialog before active-state changes and call `router.refresh()` on
success.

- [ ] **Step 5: Add navigation, run, and commit Task 4**

Use existing `SidebarMenuSub`, `SidebarMenuSubItem`, and
`SidebarMenuSubButton` to expose `รายการใบเสนอราคา` and `ข้อมูลลูกค้า` beneath
the quotation item while preserving collapsed/mobile behavior. Add an outline
`ข้อมูลลูกค้า` action beside quotation settings on `/admin/quotations`.

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts tests/quotation-auth-ui.test.ts tests/quotation-ui.test.ts
npm run typecheck
```

Expected: targeted tests and typecheck PASS.

Commit:

```powershell
git add -- app/admin/quotations/customers/page.tsx components/admin/quotations/customers/customer-form.tsx components/admin/quotations/customers/customer-list.tsx components/layout/admin-desktop-sidebar.tsx app/admin/quotations/page.tsx tests/quotation-customer-ui.test.ts
git commit -m "feat: add quotation ข้อมูลลูกค้า UI"
```

---

### Task 5: Quotation Customer Picker And Independent Snapshot Copy

**Files:**
- Create: `components/admin/quotations/customers/customer-picker-dialog.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-customer-ui.test.ts`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: Task 1 `quotationCustomerToSnapshot()`, Task 3 search/save actions, Task 4 shared form.
- Produces: `QuotationCustomerPickerDialog` and editor snapshot replacement.

- [ ] **Step 1: Add failing picker and snapshot tests**

Append assertions:

```ts
it("searches active customers and copies only the existing snapshot fields", () => {
  const picker = source("../components/admin/quotations/customers/customer-picker-dialog.tsx");
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(picker, /searchActiveQuotationCustomersAction/);
  assert.match(picker, /QuotationCustomerForm/);
  assert.match(picker, /quotationCustomerToSnapshot/);
  assert.match(picker, /แทนที่ข้อมูลลูกค้า/);
  assert.match(editor, /QuotationCustomerPickerDialog/);
  assert.match(editor, /function replaceCustomerSnapshot/);
  assert.doesNotMatch(editor, /customer\.(contactName|contactPhone|contactEmail)/);
});
```

Run the two UI test files. Expected: FAIL because picker integration is absent.

- [ ] **Step 2: Implement the self-contained picker dialog**

Use this contract:

```ts
export interface QuotationCustomerPickerDialogProps {
  current: CustomerSnapshot;
  onSelect: (snapshot: CustomerSnapshot) => void;
}
```

The component must:

- open from `เลือกลูกค้าจาก Master`,
- search only after submit or a deliberate Search button; do not request on
  every keystroke,
- call `searchActiveQuotationCustomersAction(search)`,
- show type, name, tax ID, and address for each result,
- switch the same Dialog body into `QuotationCustomerForm` for inline create,
- copy through `quotationCustomerToSnapshot()` only,
- if any current snapshot field is nonblank and differs, open an internal
  confirmation state with `แทนที่ข้อมูลลูกค้า`; cancellation preserves draft,
- select a newly saved customer automatically,
- never expose contacts in the snapshot or quotation editor.

- [ ] **Step 3: Integrate one atomic editor update**

Import the picker and add:

```ts
function replaceCustomerSnapshot(customer: CustomerSnapshot) {
  for (const field of ["name", "address", "taxId", "officeType", "branchNumber"] as const) {
    changed(`customer.${field}`);
  }
  setPayload((current) => ({ ...current, customer }));
}
```

Render the picker in the `01 ลูกค้า` section header. Keep every existing manual
field and validation binding unchanged.

- [ ] **Step 4: Run regression checks**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts tests/quotation-service.test.ts
npm run typecheck
```

Expected: PASS and the existing customer snapshot remains exactly five fields.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- components/admin/quotations/customers/customer-picker-dialog.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts
git commit -m "feat: select ข้อมูลลูกค้า in quotations"
```

---

### Task 6: Documentation, Responsive Verification, And Full Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/quotation-management.md`
- Review: every file from Tasks 1–5

**Interfaces:**
- Consumes: completed feature.
- Produces: user/developer documentation and verified implementation.

- [ ] **Step 1: Update behavior documentation**

Add exact documentation for:

- `/admin/quotations/customers`,
- shared access via `allow_quotation`,
- juristic versus individual creation,
- exact 13-digit rule,
- optional master-only contacts,
- verified/unverified DBD states,
- refresh preserving overrides,
- reset restoring DBD name/address/head-office state only,
- inactive customers omitted from the picker,
- snapshot independence and no historical import,
- DBD timeout/not-found safe behavior,
- automated and local-database test commands.

Do not add an environment variable because the approved DBD URL is fixed and
public.

- [ ] **Step 2: Run static and unit verification**

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: build exits `0` with the new customer route compiled.

- [ ] **Step 4: Verify responsive and interaction behavior**

Using the local app, verify widths 390px, 768px, 1366px, and 1920px:

- page header/actions do not overflow,
- mobile cards and desktop table switch at `md`,
- dialogs fit the viewport and keep actions reachable,
- keyboard reaches search, form, DBD, menu, confirmation, and picker controls,
- focus returns after dialogs close,
- DBD errors and unverified confirmation are visible and announced,
- selecting a master copies the five fields once,
- editing the quotation does not mutate Master,
- contact fields never render in quotation preview/print/public page.

Record any skipped browser or local-Supabase check with the exact reason.

- [ ] **Step 5: Run the required project reviewer, fix evidence-backed findings, rerun gates, and commit**

Spawn `webook_reviewer` read-only after Tasks 1–5. Give it the approved spec,
this plan, and the diff. Fix only findings supported by code/tests, then rerun
Steps 2–4.

Commit documentation and reviewer-supported corrections:

```powershell
git status --short
git add -- README.md docs/architecture.md docs/quotation-management.md
git commit -m "docs: document quotation ข้อมูลลูกค้า"
```

Expected: clean `git status --short`, or only clearly identified unrelated user
changes remain.

## Plan Self-Review

- Spec coverage: every approved data, DBD, sharing, UI, snapshot, testing, and
  documentation requirement maps to Tasks 1–6.
- Scope: one cohesive ข้อมูลลูกค้า capability; no contact table, scheduler,
  import, branch master, or quotation schema expansion.
- Type consistency: the stable interfaces at the top are consumed unchanged by
  services, repositories, actions, UI, and tests.
- Migration filename: the timestamp wildcard is the sole dynamic path and is
  resolved by the exact Supabase CLI output during Task 2; no timestamp is
  invented.
- Dependency check: the plan uses only installed packages and native platform
  features.
