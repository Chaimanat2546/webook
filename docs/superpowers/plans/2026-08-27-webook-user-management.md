# Webook User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Role 1-only Webook user manager that lists, edits, bans, and unbans local `public.users` records while synchronizing linked Supabase Auth accounts.

**Architecture:** `/admin/users` loads local user records through a server repository and renders reusable responsive management components. Server Actions call a dedicated service which authorizes Role 1, validates input, updates `public.users`, and coordinates compensating Supabase Auth Admin API updates. The existing Central User Manager remains isolated at `/admin/user-manager`.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Supabase PostgreSQL/Auth, Tailwind CSS, shadcn/ui, Lucide, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-08-27-webook-user-management-design.md`

## Global Constraints

- Only `public.users.role_id === 1` may view or mutate Webook User Management.
- Keep `/admin/user-manager` and its Central User Manager behavior unchanged.
- Never expose the Supabase service-role key or privileged client to a client component.
- Use a new migration; never edit an existing migration.
- Edit only `name`, `username`, `tel`, and `email`; creating users and changing roles are out of scope.
- Ban must prevent new sign-in and deny a current session on its next Webook server request; a user cannot ban themselves.
- Reuse existing UI primitives and do not add dependencies.
- Complete `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before release.

---

## File Structure

- `supabase/migrations/20260827120000_webook_user_management.sql` — adds `is_banned`, a management list index, and explicit Role 1 read/update policies for `public.users`.
- `server/auth/admin.ts` — defines `canManageWebookUsers`, rejects banned current sessions, and defines `requireWebookUserManagerAdmin`.
- `server/repositories/webook-users.ts` — owns select, duplicate lookup, and local record update queries only.
- `server/services/webook-users.ts` — owns request validation and coordinated database/Auth lifecycle operations.
- `app/admin/users/page.tsx` — Role 1-gated route and initial data load.
- `app/admin/users/actions.ts` — small server-action adapters that invoke the service and revalidate the page.
- `components/admin/user-management/user-table.tsx` — responsive list/cards and mutually exclusive icon-based row actions.
- `components/admin/user-management/user-management-page.tsx` — client interaction state, edit dialog, confirmation dialog, and safe status notifications.
- `components/layout/admin-shell.tsx`, `components/layout/admin-desktop-sidebar.tsx`, `app/admin/layout.tsx` — pass and use the dedicated permission to render the new menu.
- `tests/webook-user-management-*.test.ts` — unit/source-contract tests for authorization, repository/service behavior, migration, actions, and UI.
- `docs/webook-user-management.md` — describes authorization, editable fields, and Ban semantics for maintainers.

### Task 1: Database contract and Role 1 authorization

**Files:**
- Create: `supabase/migrations/20260827120000_webook_user_management.sql`
- Modify: `server/auth/admin.ts`
- Modify: `server/repositories/admin-users.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Modify: `tests/admin-auth.test.ts`
- Create: `tests/webook-user-management-migration.test.ts`

**Interfaces:**
- Produces: `canManageWebookUsers(user: Pick<AdminUserForAuth, "role_id"> | null): boolean`.
- Produces: `requireWebookUserManagerAdmin(): Promise<Awaited<ReturnType<typeof requireAdmin>>>` that throws `Forbidden` for non-Role-1 sessions.
- Produces: `public.users.is_banned boolean not null default false`.

- [ ] **Step 1: Write failing authorization and migration tests**

```ts
it("reserves Webook User Management for role 1", () => {
  assert.equal(canManageWebookUsers({ role_id: 1 }), true);
  assert.equal(canManageWebookUsers({ role_id: 2 }), false);
  assert.equal(canManageWebookUsers(null), false);
});

it("loads the Ban state with the current authenticated user", () => {
  assert.match(repositorySource, /\.select\("mid, role_id, allow_tools, is_banned"\)/);
  assert.match(adminAuthSource, /if \(adminUser\?\.is_banned\) \{/);
});

it("adds a durable Ban state and Role 1-only policies", () => {
  assert.match(sql, /add column if not exists is_banned boolean not null default false/);
  assert.match(sql, /create policy "Role 1 can manage Webook users"/);
  assert.match(sql, /where users\.role_id = 1/);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --import ./tests/register-server-only.mjs --test tests/admin-auth.test.ts tests/webook-user-management-migration.test.ts`

Expected: FAIL because the predicate and migration do not exist.

- [ ] **Step 3: Add the migration and permission plumbing**

Implement the migration with the exact invariants below:

```sql
alter table public.users
  add column if not exists is_banned boolean not null default false;

create index if not exists users_management_order_idx
  on public.users (is_banned, updated_at desc, id);

drop policy if exists "selected" on public.users;
```

After removing the legacy anonymous `selected` policy, add an administrator `for all to authenticated` policy with a `using` and `with check` expression that proves the caller is a non-banned `users.role_id = 1` record matching `auth.uid()` or the JWT email. Extend `AdminUserForAuth` and `findAdminUserByAuthIdentity` to include `is_banned`. In `requireAdmin`, after resolving the local record, sign out the current cookie session and redirect to `/login?error=invalid` if `adminUser?.is_banned` is true. Add `canManageWebookUsers` with the same strict `role_id === 1` rule as `canManageCentralUsers`, and pass its result as `canManageWebookUsers` through the admin layout, shell, and sidebar. Render `/admin/users` with a `UsersIcon` only when true.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `node --import ./tests/register-server-only.mjs --test tests/admin-auth.test.ts tests/webook-user-management-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the authorization and schema contract**

```powershell
git add supabase/migrations/20260827120000_webook_user_management.sql server/auth/admin.ts server/repositories/admin-users.ts app/admin/layout.tsx components/layout/admin-shell.tsx components/layout/admin-desktop-sidebar.tsx tests/admin-auth.test.ts tests/webook-user-management-migration.test.ts
git commit -m "feat: add Webook user management access control"
```

### Task 2: Repository and validated lifecycle service

**Files:**
- Create: `server/repositories/webook-users.ts`
- Create: `server/services/webook-users.ts`
- Create: `tests/webook-user-management-service.test.ts`

**Interfaces:**
- Consumes: `requireWebookUserManagerAdmin` and `createSupabaseAdminClient`.
- Produces: `WebookManagedUser` with `id`, `uid`, `name`, `username`, `tel`, `email`, `isBanned`, and `updatedAt`.
- Produces: `listWebookUsers(supabase): Promise<WebookManagedUser[]>`.
- Produces: `updateWebookUser(input)`, `banWebookUser(input)`, and `unbanWebookUser(input)` returning `{ ok: true; user: WebookManagedUser } | { ok: false; message: string }`.

- [ ] **Step 1: Write failing repository and service tests**

```ts
it("rejects an edit with an empty name, duplicate username, or invalid email", async () => {
  await assert.rejects(() => updateWebookUser({ id, name: " ", username: "used", tel: "081", email: "not-email" }), /Invalid user data/);
});

it("bans Auth, then persists the local Ban state", async () => {
  const result = await banWebookUser({ id, actorUid: "admin-uid" });
  assert.equal(result.ok, true);
  assert.deepEqual(auth.calls, [["updateUserById", userUid, { ban_duration: "876000h" }]]);
  assert.equal(repository.updated.isBanned, true);
});

it("refuses a self-Ban and compensates Auth if local persistence fails", async () => {
  await assert.rejects(() => banWebookUser({ id: actorUserId, actorUid: "admin-uid" }), /cannot ban yourself/);
  assert.deepEqual(auth.calls.at(-1), ["updateUserById", userUid, { ban_duration: "none" }]);
});
```

- [ ] **Step 2: Run the focused service test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-service.test.ts`

Expected: FAIL because the repository and service modules do not exist.

- [ ] **Step 3: Implement local data access and lifecycle orchestration**

The repository must issue only `public.users` queries and map unknown Supabase data to explicit values:

```ts
export interface WebookManagedUser {
  id: string;
  uid: string | null;
  name: string;
  username: string;
  tel: string;
  email: string;
  isBanned: boolean;
  updatedAt: string | null;
}

export async function findWebookUserById(
  supabase: SupabaseClient,
  id: string,
): Promise<WebookManagedUser | null>;
```

The service must call the Role 1 guard before querying. Validate a UUID record id; require a non-empty trimmed `name`; limit `name` to 150 characters, `username` to 100 characters, and `tel` to 30 characters; accept `tel` only as digits, spaces, `+`, `-`, and parentheses; normalize email with `trim().toLowerCase()` and require a valid email. Reject a duplicate username or email belonging to another record.

For a linked `uid`, Ban calls `auth.admin.updateUserById(uid, { ban_duration: "876000h" })`, then applies the local Ban state. If the local update fails, call `updateUserById(uid, { ban_duration: "none" })` and return a safe failure. Unban calls `updateUserById(uid, { ban_duration: "none" })`, then applies the local state; if local persistence fails, reapply the long ban. Do not call server-side `signOut` for another user: Supabase requires that person's JWT. A temporary Auth ban blocks new logins but does not revoke an issued JWT; `requireAdmin` checking `is_banned` is the Webook-specific current-session enforcement point and must be covered by Task 1 tests.

For an email edit, update Auth first with `{ email: normalizedEmail, email_confirm: true }`, then update `public.users`. If the local update fails, restore Auth to the previous email with the same admin API. For records without `uid`, update only the local record and return a safe success; Ban still prevents application access through `is_banned`.

- [ ] **Step 4: Run the focused service test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the service boundary**

```powershell
git add server/repositories/webook-users.ts server/services/webook-users.ts tests/webook-user-management-service.test.ts
git commit -m "feat: add Webook user lifecycle service"
```

### Task 3: Route and Server Action boundary

**Files:**
- Create: `app/admin/users/page.tsx`
- Create: `app/admin/users/actions.ts`
- Create: `tests/webook-user-management-actions.test.ts`

**Interfaces:**
- Consumes: `listWebookUsers`, `updateWebookUser`, `banWebookUser`, and `unbanWebookUser`.
- Produces: `updateWebookUserAction`, `banWebookUserAction`, and `unbanWebookUserAction` accepting a `FormData` and returning the service safe-result union.

- [ ] **Step 1: Write failing route/action authorization tests**

```ts
it("guards the users route before loading the list", () => {
  assert.match(page, /await requireWebookUserManagerAdmin\(\)/);
  assert.match(page, /listWebookUsers\(supabase\)/);
});

it("checks Role 1 and revalidates only the Webook users route in every mutation", () => {
  assert.match(actions, /requireWebookUserManagerAdmin\(\)/);
  assert.match(actions, /revalidatePath\("\/admin\/users"\)/);
  assert.doesNotMatch(actions, /createSupabaseAdminClient/);
});
```

- [ ] **Step 2: Run the focused route/action test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-actions.test.ts`

Expected: FAIL because the route and actions do not exist.

- [ ] **Step 3: Implement the page and narrow Server Actions**

The page obtains `{ supabase }` from `requireWebookUserManagerAdmin()`, passes `await listWebookUsers(supabase)` into `UserManagementPage`, and never accesses Auth Admin directly. Actions must enforce a maximum 16 KiB form payload, read known string fields only, pass the actor `user.id` into lifecycle service calls, return safe service results, and call `revalidatePath("/admin/users")` only after successful mutations.

- [ ] **Step 4: Run the focused route/action test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the route and action boundary**

```powershell
git add app/admin/users/page.tsx app/admin/users/actions.ts tests/webook-user-management-actions.test.ts
git commit -m "feat: add Webook user management route"
```

### Task 4: Responsive user list and edit/lifecycle dialogs

**Files:**
- Create: `components/admin/user-management/user-table.tsx`
- Create: `components/admin/user-management/user-management-page.tsx`
- Create: `tests/webook-user-management-ui.test.ts`

**Interfaces:**
- Consumes: `WebookManagedUser` and the three Server Action functions.
- Produces: `UserManagementPage({ initialUsers }): JSX.Element`.
- Produces: `getWebookUserActions(isBanned: boolean): Array<"edit" | "ban" | "unban">`.

- [ ] **Step 1: Write failing UI contract tests**

```ts
it("shows desktop columns and mobile cards for every editable field", () => {
  assert.match(table, /<TableHead[^>]*>ชื่อ/);
  assert.match(table, /<TableHead[^>]*>Username/);
  assert.match(table, /<TableHead[^>]*>อีเมล/);
  assert.match(table, /<TableHead[^>]*>เบอร์โทร/);
  assert.match(table, /md:hidden/);
  assert.match(table, /hidden p-0 md:block/);
});

it("makes Ban and Unban mutually exclusive and icon-labelled", () => {
  assert.deepEqual(getWebookUserActions(false), ["edit", "ban"]);
  assert.deepEqual(getWebookUserActions(true), ["edit", "unban"]);
  assert.match(table, /BanIcon|Ban/);
  assert.match(table, /ShieldCheckIcon|Unban/);
});

it("uses an edit dialog and a confirmation dialog", () => {
  assert.match(page, /DialogTitle>แก้ไขผู้ใช้/);
  assert.match(page, /DialogTitle>ยืนยันการ Ban ผู้ใช้/);
  assert.match(page, /DialogTitle>ยืนยันการปลด Ban ผู้ใช้/);
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement accessible responsive interactions**

Render table rows for desktop and cards for mobile using existing `Table`, `Card`, `Badge`, `Button`, `Dialog`, `Input`, and `DropdownMenu` components. Use `PencilIcon` for Edit, `BanIcon` for Ban, and `ShieldCheckIcon` for Unban; each `DropdownMenuItem` needs Thai visible copy and an icon marked `aria-hidden`. The status badge must display `ใช้งานอยู่` or `ถูก Ban`.

Keep draft values only in client state while the edit dialog is open. Submit `FormData` to the corresponding action in a `useTransition`; disable the confirm button while pending, show safe status/error text with `role="status"` or `role="alert"`, close the dialog only on success, and call `router.refresh()` after success. The confirmation dialog must display the selected user name/email and submit only the selected immutable record id.

- [ ] **Step 4: Run the focused UI test to verify it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the user management interface**

```powershell
git add components/admin/user-management/user-table.tsx components/admin/user-management/user-management-page.tsx tests/webook-user-management-ui.test.ts
git commit -m "feat: add Webook user management interface"
```

### Task 5: Documentation and full verification

**Files:**
- Create: `docs/webook-user-management.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed authorization, migration, service, route, and UI contracts.
- Produces: maintainers' documentation for access control, local/Auth synchronization, operational Ban behavior, and schema rollout.

- [ ] **Step 1: Write the maintainer documentation**

Document the exact route (`/admin/users`), the strict Role 1 requirement, fields editable in this release, `is_banned` migration dependency, self-Ban guard, and the Ban/Unban synchronization protocol. State that Central User Manager at `/admin/user-manager` is independent. Link the document from the README administration section.

- [ ] **Step 2: Check migration and documentation references**

Run: `rg -n "admin/users|is_banned|role_id === 1|admin/user-manager" docs/webook-user-management.md README.md supabase/migrations/20260827120000_webook_user_management.sql`

Expected: each required behavior is documented and references the correct route.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm test`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Review the final change set**

Run: `git diff HEAD~5..HEAD --check; git status --short`

Expected: no whitespace errors and no unintended files.

- [ ] **Step 5: Commit documentation**

```powershell
git add docs/webook-user-management.md README.md
git commit -m "docs: document Webook user management"
```
