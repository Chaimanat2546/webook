# User Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Webook user edit route into a responsive, extensible workspace whose first category is `ข้อมูลผู้ใช้`.

**Architecture:** Add User Management-specific workspace presentation components instead of reusing the house-specific shell. The edit route owns a section configuration and supplies the active `ข้อมูลผู้ใช้` content, while the existing service and Server Action keep their current authorization and update boundaries.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, existing shadcn/ui Button, Badge, Input, and Label primitives.

**Spec:** `docs/superpowers/specs/2026-08-27-webook-user-management-design.md`

## Global Constraints

- Do not use `HouseWorkspaceShell` or other house-specific components on `/admin/users/[id]`.
- Reuse existing shadcn/ui primitives; add no dependencies.
- Keep `requireWebookUserManagerAdmin`, `getWebookUserForManagement`, and `updateWebookUserFormAction` unchanged as the security and mutation boundaries.
- The first and only section is named exactly `ข้อมูลผู้ใช้`; future sections are added through one local section configuration.
- Preserve the existing editable fields: `name` and `roleId` only.
- Do not commit unless the user explicitly asks.

---

### Task 1: User Workspace presentation primitives

**Files:**
- Create: `components/admin/user-management/user-task-header.tsx`
- Create: `components/admin/user-management/user-workspace-nav-item.tsx`
- Create: `components/admin/user-management/user-workspace-shell.tsx`
- Test: `tests/webook-user-management-ui.test.ts`

**Interfaces:**
- Produces `UserTaskHeader({ backHref, dvId, subtitle, title })` for the edit-route header.
- Produces `UserWorkspaceNavItem({ active, href, icon, label })` for responsive section navigation.
- Produces `UserWorkspaceShell({ children, contentIcon, contentTitle, sidebar, sidebarTitle })` for a 16rem desktop sidebar and mobile horizontal navigation frame.

- [ ] **Step 1: Write the failing UI contract test**

```ts
const header = read("../components/admin/user-management/user-task-header.tsx");
const shell = read("../components/admin/user-management/user-workspace-shell.tsx");
const nav = read("../components/admin/user-management/user-workspace-nav-item.tsx");

assert.match(header, /กลับไปรายการผู้ใช้/);
assert.match(header, /DV-/);
assert.match(shell, /lg:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
assert.match(nav, /aria-current/);
assert.match(nav, /lg:min-w-0/);
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: FAIL because the three User Workspace component files do not exist.

- [ ] **Step 3: Implement the three focused components**

```tsx
// user-task-header.tsx
<header className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
  <Button asChild className="w-fit px-0" size="sm" variant="ghost">
    <Link href={backHref}><ArrowLeftIcon data-icon="inline-start" />กลับไปรายการผู้ใช้</Link>
  </Button>
  <div className="flex flex-wrap items-center gap-2">
    <h1 className="text-base font-semibold sm:text-lg lg:text-xl">{title}</h1>
    {dvId ? <Badge variant="secondary">DV-{dvId}</Badge> : null}
  </div>
  <p className="text-sm text-muted-foreground">{subtitle}</p>
</header>
```

```tsx
// user-workspace-shell.tsx
<div className="grid overflow-hidden rounded-lg border lg:min-h-0 lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">{sidebar}</aside>
  <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
    <header className="border-b bg-muted/20 px-4 py-3">{contentTitle}</header>
    <div className="p-4 lg:min-h-0 lg:overflow-y-auto">{children}</div>
  </section>
</div>
```

- [ ] **Step 4: Re-run the UI test and confirm it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: PASS, including the new responsive workspace contract.

### Task 2: Integrate the User Workspace into the edit route

**Files:**
- Modify: `app/admin/users/[id]/page.tsx`
- Modify: `tests/webook-user-management-ui.test.ts`

**Interfaces:**
- Consumes the Task 1 components.
- Produces the edit page with a local section configuration containing `{ key: "details", label: "ข้อมูลผู้ใช้" }`.
- Keeps the existing name/role form inside the active section.

- [ ] **Step 1: Write the failing route contract test**

```ts
const page = read("../app/admin/users/[id]/page.tsx");

assert.match(page, /label: "ข้อมูลผู้ใช้"/);
assert.match(page, /<UserTaskHeader/);
assert.match(page, /<UserWorkspaceShell/);
assert.match(page, /contentTitle="ข้อมูลผู้ใช้"/);
assert.doesNotMatch(page, /HouseWorkspaceShell/);
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: FAIL because the edit route still renders the standalone form.

- [ ] **Step 3: Implement the workspace route composition**

```tsx
const USER_EDIT_SECTIONS = [
  { key: "details", label: "ข้อมูลผู้ใช้", icon: UserRoundIcon },
] as const;

<div className="flex min-h-0 flex-1 flex-col gap-4 lg:gap-5">
  <UserTaskHeader
    backHref="/admin/users"
    dvId={user.dvId}
    subtitle="จัดการข้อมูลผู้ใช้"
    title={user.name || user.username || user.email || "ผู้ใช้ Webook"}
  />
  <UserWorkspaceShell
    contentIcon={<UserRoundIcon aria-hidden />}
    contentTitle="ข้อมูลผู้ใช้"
    sidebar={
      <nav aria-label="หมวดข้อมูลผู้ใช้" className="flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-visible">
        <UserWorkspaceNavItem active href={`/admin/users/${user.id}`} icon={<UserRoundIcon aria-hidden />} label="ข้อมูลผู้ใช้" />
      </nav>
    }
    sidebarTitle="หมวดข้อมูล"
  >
    <form action={updateWebookUserFormAction} className="space-y-4">
      <input name="id" type="hidden" value={user.id} />
      <Input defaultValue={user.name} name="name" required />
      <select defaultValue={user.roleId === null ? "" : String(user.roleId)} name="roleId" required>
        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
      <Button disabled={roles.length === 0} type="submit">บันทึก</Button>
    </form>
  </UserWorkspaceShell>
</div>
```

Keep the hidden `id`, input names, required validation, error alert, cancel link, and disabled save state unchanged.

- [ ] **Step 4: Re-run the UI test and confirm it passes**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts`

Expected: PASS with the existing edit-form assertions and the new workspace assertions.

### Task 3: Full verification and documentation check

**Files:**
- Modify: `docs/superpowers/specs/2026-08-27-webook-user-management-design.md` only if implementation exposes a design mismatch.
- Verify: `tests/webook-user-management-ui.test.ts`
- Verify: `tests/webook-user-management-service.test.ts`

**Interfaces:**
- Consumes the completed workspace route from Task 2.
- Produces evidence that responsive layout, authorization-safe edit behavior, and existing form behavior remain intact.

- [ ] **Step 1: Run focused user-management tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/webook-user-management-ui.test.ts tests/webook-user-management-service.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run static checks in safe order**

Run: `npm run build`

Expected: PASS and regenerate `.next/types`.

Run: `npm run typecheck`

Expected: PASS with zero TypeScript errors.

Run: `npm run lint`

Expected: PASS with zero lint errors.

- [ ] **Step 3: Review the final diff**

Verify that the route imports only User Management workspace components, not `components/admin/houses/*`, and that no data-access or authorization behavior changed.

- [ ] **Step 4: Request a code review**

Ask a reviewer to check the User Workspace layout, one-section configuration, responsive nav semantics, and preservation of the existing update boundary. Resolve any critical or important finding before handoff.
