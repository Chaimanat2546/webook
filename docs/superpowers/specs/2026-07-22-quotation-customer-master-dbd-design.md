# Quotation Customer Master With DBD Design

Date: 2026-07-22

Status: Approved

## Goal

Add a shared Customer Master for quotation users. The master supports Thai
juristic persons whose official defaults can be verified through DBD Open Data,
and individual customers entered manually. Selecting a customer copies the
existing quotation customer snapshot; later master changes must not alter saved
quotations.

## Confirmed Decisions

- Customer Master is shared by every authenticated user with
  `allow_tools.allow_quotation = true`.
- All quotation users may view, create, edit, deactivate, and reactivate master
  customers.
- Customer types are `juristic` and `individual`.
- Every customer requires an exact 13-ASCII-digit tax ID.
- An individual tax ID has one master row. A juristic tax ID may have one
  main-office row and multiple rows with distinct branch numbers. These
  identities remain unique across active and inactive rows.
- Juristic names and addresses are editable after DBD verification.
- Stored DBD values remain available as defaults that the user can restore.
- DBD refresh is manual and shows the last successful verification time.
- A juristic customer may be saved as unverified when DBD is unavailable or
  returns no matching record, after an explicit warning and confirmation.
- Individual customers never use DBD and have no DBD verification state.
- Contact name, phone, and email are optional and remain only in Customer
  Master. They are not copied to or printed on quotations.
- Editing a copied quotation snapshot never updates Customer Master.
- Existing quotation customer snapshots are not imported into Customer Master.
- Deactivation replaces hard deletion.
- No new dependency is required.

## Scope

### Included

- Shared customer table, constraints, indexes, grants, and RLS.
- Customer repository and server-side validation.
- DBD Open Data adapter using the platform `fetch` implementation.
- Customer list, search, add, edit, deactivate, reactivate, DBD refresh, and DBD
  reset flows.
- Customer selection and inline creation from the quotation editor.
- Automated tests and responsive verification.
- Updates to quotation documentation and architecture documentation.

### Excluded

- Importing customers from existing quotations.
- Scheduled or automatic DBD refresh.
- A separate contact table or multiple contacts per customer.
- Customer history, merge, approval, or audit-log UI.
- Persisting the full DBD response.
- DBD lookup for individual customers.
- Adding contact fields to the quotation snapshot or document.
- Automatic synchronization between saved quotations and Customer Master.
- A separate branch table or branch CRUD module. Reusable juristic branches are
  represented by Customer Master rows under the same tax ID.

Ponytail ceiling: keep branches in the existing Customer Master table. Do not
add a branch table or another abstraction while identity indexes can enforce
the required behavior directly.

## Data Model

Create `public.quotation_customers` in a new migration. Do not edit an existing
migration.

| Column | Purpose |
|---|---|
| `id uuid primary key` | Stable master identifier |
| `customer_type text` | `juristic` or `individual` |
| `tax_id text` | Required 13-ASCII-digit tax ID; part of the customer identity |
| `name text` | Current editable display/billing name |
| `address text` | Current editable display/billing address |
| `office_type text` | Same values as the quotation `OfficeType` contract |
| `branch_number text` | Current branch number; empty unless branch is selected |
| `contact_name text` | Optional master-only contact name |
| `contact_phone text` | Optional master-only phone |
| `contact_email text` | Optional master-only email |
| `dbd_name text null` | Last verified registered name used as a reset default |
| `dbd_address text null` | Last verified registered address used as a reset default |
| `dbd_status text null` | Last verified juristic status returned by DBD |
| `dbd_verified_at timestamptz null` | Last successful DBD verification time |
| `is_active boolean` | Active/closed state; defaults to true |
| `created_by`, `updated_by` | Authenticated actors |
| `created_at`, `updated_at` | Row timestamps |

Required database checks:

- `customer_type` is one of the two approved values.
- `tax_id` matches exactly 13 ASCII digits.
- `name` and `address` are nonblank after trimming.
- `office_type` and `branch_number` follow the existing quotation customer
  rules.
- Individual rows have all DBD fields set to null.
- An optional email must be syntactically valid after trimming.
- Branch numbers are trimmed, nonblank for branch rows, and preserve leading
  zeroes. `head_office` and `unspecified` share one main-office identity.

DBD verification state is derived rather than stored separately:

- `individual`: not applicable.
- `juristic` with `dbd_verified_at is null`: unverified.
- `juristic` with `dbd_verified_at is not null`: verified.

Keep inactive rows subject to customer identity uniqueness. Individual identity
is `(customer_type, tax_id)`. Juristic main-office identity is its tax ID, while
juristic branch identity is `(tax_id, branch_number)`. Attempting to add an
existing identity should return the matching row, including an inactive row,
so the user can review or reactivate it instead of creating a duplicate.

## Authorization And Data Access

Enable RLS on the new public table. Reuse
`private.has_quotation_permission()` for select, insert, and update policies so
all quotation users share the same master. Do not use user-editable metadata for
authorization.

Customer data access stays server-side:

1. Server actions call `requireAdmin()` and `canUseQuotation()`.
2. A customer service validates and normalizes input.
3. A focused customer repository reads or mutates the Supabase table using the
   authenticated server client.
4. RLS remains the database backstop.

The browser must not call Supabase or DBD directly. There is no hard-delete
action and no new public API route.

## DBD Adapter

Use the official endpoint:

```text
GET https://openapi.dbd.go.th/api/v1/juristic_person/{taxId}
```

The adapter is server-only and uses native `fetch` with a bounded timeout and no
shared cache. Calls happen only when a user explicitly checks or refreshes a
juristic customer.

The parser must be defensive because the response uses namespaced keys such as
`cd:OrganizationJuristicNameTH` and nullable nested address fields. A response
is successful only when the DBD status code is `1000` and the required juristic
record can be parsed. Compose the registered address from nonblank address,
subdistrict, district, and province values without emitting `null` text.

Return a small internal result containing only:

- tax ID,
- registered Thai name,
- composed registered address,
- juristic status,
- verification timestamp.

Do not persist or return the full provider payload. Do not log raw responses,
authorization data, or unnecessary customer data.

## Customer Workflows

### Create a juristic customer

1. Select `นิติบุคคล` and enter a 13-digit tax ID.
2. Select `ตรวจสอบ DBD`.
3. On success, copy the registered name and address into both the DBD default
   fields and the editable current fields. Set office type to head office and
   clear the branch number.
4. The user may edit current fields and optionally enter master-only contact
   data before saving.
5. If DBD is unavailable, invalid, or has no matching record, show a warning.
   The user may explicitly confirm `บันทึกแบบยังไม่ยืนยัน`; the row saves with
   null DBD fields and may be verified later.
6. If DBD reports a non-normal juristic status, show a warning but allow save.

### Create an individual customer

1. Select `บุคคลธรรมดา`.
2. Enter required name, address, and 13-digit tax ID.
3. Optionally enter master-only contact data.
4. Save immediately without DBD controls or verification labels.

### Refresh and reset

- `รีเฟรชจาก DBD` is available only for juristic customers.
- A successful refresh replaces `dbd_name`, `dbd_address`, `dbd_status`, and
  `dbd_verified_at` but preserves current editable fields and contact fields.
- `รีเซ็ตเป็นข้อมูล DBD` explicitly copies `dbd_name` and `dbd_address` into
  current fields, sets office type to head office, and clears branch number.
- Reset never changes contact fields.
- Reset is disabled until a successful DBD verification exists.
- A refresh failure never prevents saving unrelated edits to an existing row.

### Deactivate and reactivate

- Deactivation sets `is_active = false` after confirmation.
- Inactive customers remain searchable through the inactive filter and may be
  reactivated.
- Inactive customers are omitted from the quotation customer picker.
- Existing quotations remain unchanged.

## User Interface

Add `/admin/quotations/customers` and a `ข้อมูลลูกค้า` entry under the quotation
navigation. This is an ordinary admin page, not a House Workspace Shell,
because it is shared quotation data and is not a workspace for one house.

The approved layout uses:

- a page title and `เพิ่มลูกค้า` primary action,
- one search field covering name, tax ID, contact name, phone, and email,
- an active/inactive filter,
- a desktop/laptop table,
- mobile/tablet customer cards,
- DBD state and last verification date for juristic rows,
- row actions for edit, deactivate, or reactivate.

Reuse the existing Shadcn Dialog for add/edit rather than introducing another
dependency. The shared form changes fields and DBD controls according to
customer type. Every loading, error, warning, and disabled state must be
accessible by keyboard and announced through visible text or an appropriate
live region.

## Quotation Editor Integration

Add a `เลือกลูกค้าจาก Master` action to the existing customer section. It opens
a Dialog containing a search input and active customer results. The same Dialog
may switch to the shared new-customer form through `เพิ่มลูกค้าใหม่`; successful
creation selects that customer and returns to the draft.

Selecting a master copies only these existing snapshot fields:

- `name`,
- `address`,
- `taxId`,
- `officeType`,
- `branchNumber`.

Do not add a contact field or persistent master reference to the quotation
payload. The editor's existing fields stay editable, and edits affect only the
current quotation. Selecting another master replaces the five draft snapshot
fields after confirmation when the customer section already contains user
input.

## Error Handling

| Case | Behavior |
|---|---|
| Invalid customer input | Return field-level messages; do not mutate the database |
| Duplicate customer identity | Return the matching active or inactive main office, branch, or individual row for review instead of inserting |
| DBD timeout/network failure | Offer explicit unverified save for a new juristic customer; preserve existing data on refresh |
| DBD not found | Offer explicit unverified save and retain the entered tax ID |
| Invalid/non-JSON DBD response | Treat as provider failure; never expose the raw response |
| Non-normal juristic status | Show warning, retain status, and allow save |
| Unauthorized user | Deny page, action, and database access |
| Database failure | Preserve form values and show a retryable general error |

## Testing

Automated coverage must include:

- DBD parser success, namespace keys, nullable address fields, missing required
  data, non-JSON responses, non-`1000` statuses, timeout, and network failure.
- Customer normalization for both types, exact tax ID validation, optional
  contacts, branch rules, and reset behavior.
- Duplicate individual, juristic main-office, and juristic branch identity
  handling across active and inactive rows.
- RLS verification that quotation users share customer rows and users without
  quotation permission cannot read or mutate them.
- Repository list, search, status filter, create, update, deactivate, and
  reactivate behavior.
- Server-action permission and safe error mapping.
- UI source/behavior coverage for customer navigation, responsive table/cards,
  DBD controls, unverified confirmation, customer picker, inline creation, and
  snapshot copying.
- Regression coverage proving quotation snapshot edits do not mutate Customer
  Master and contact fields are not included in the snapshot.

Tests mock the DBD request; the normal test suite must not depend on the live
external service. Verify the completed UI at mobile, tablet, laptop, and desktop
widths.

Run:

```text
npm run typecheck
npm run lint
npm run test
npm run build
```

## Documentation

Implementation updates:

- `README.md` for the new route and current quotation capability.
- `docs/architecture.md` for shared customer data, DBD boundary, and RLS flow.
- `docs/quotation-management.md` for user behavior, validation, DBD states,
  error handling, and testing.
- `.env.example` only if implementation discovers a real environment variable
  requirement; the approved design needs none.

## Definition Of Done

- Approved data model and RLS are represented by a new migration.
- Both customer types work with the confirmed validation rules.
- DBD defaults, manual override, refresh, reset, and unverified save work.
- Customer Master is shared only among quotation-authorized users.
- Quotation selection creates an independent snapshot without contacts.
- Existing quotations and public quotation rendering remain unchanged.
- Responsive and accessibility checks pass.
- Relevant automated checks and documentation are complete.
