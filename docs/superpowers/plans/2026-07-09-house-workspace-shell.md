# House Workspace Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the house detail and house image task pages around the house detail shell style, while keeping each task body independent.

**Architecture:** Add small shared house workspace components for the fixed shell pieces, then move the existing house detail and image pages onto those components. Keep behavior in the current page-specific components; only standardize the surrounding header, frame, sidebar header, nav item style, and content header pattern.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, lucide-react, node:test source-structure tests.

## Global Constraints

- Do not add dependencies.
- Do not change database schema, RLS, API contracts, upload logic, delete logic, cover selection logic, or house form business logic.
- Use the house detail page shell as the visual source of truth.
- Keep `Content Body` task-specific.
- Use `16rem` desktop sidebar width.
- Keep mobile horizontal nav and active item scrolling behavior.
- Update `AGENTS.md` with a decision gate so future agents decide whether the house workspace shell applies before changing house admin pages.
- Before completion, run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test`.

---

## File Structure

- Create `components/admin/houses/house-task-header.tsx`.
  - Responsibility: fixed top shell header for one-house task pages.
  - Interface: `HouseTaskHeader({ backHref, title, propertyId, subtitle, actions })`.

- Create `components/admin/houses/house-workspace-shell.tsx`.
  - Responsibility: fixed workspace frame with sidebar, content header, and task-specific body slot.
  - Interface: `HouseWorkspaceShell({ sidebarTitle, sidebar, contentIcon, contentTitle, contentMeta, contentActions, contentClassName, children })`.

- Create `components/admin/houses/house-workspace-nav-item.tsx`.
  - Responsibility: shared nav item style for house sections and image zones.
  - Interface: `HouseWorkspaceNavItem` wraps `next/link` and supports `active`, `icon`, `label`, `badge`, `href`, `ref`, and `onClick`.

- Modify `components/admin/houses/house-detail-section-nav.tsx`.
  - Responsibility: keep section data and active scrolling, delegate repeated nav item styling to `HouseWorkspaceNavItem`.

- Modify `app/admin/houses/[propertyId]/page.tsx`.
  - Responsibility: use shared task header and workspace shell; move rating from shell header to the content header action area; remove the permanent image management button from the shell header.

- Modify `app/admin/houses/[propertyId]/images/page.tsx`.
  - Responsibility: use shared task header.

- Modify `components/admin/images/image-zone-viewer.tsx`.
  - Responsibility: use shared workspace shell and nav item style; keep upload/delete/image grid behavior unchanged.

- Modify `components/admin/images/cover-select-viewer.tsx`.
  - Responsibility: use shared workspace shell and nav item style; keep cover selection behavior unchanged.

- Modify `AGENTS.md`.
  - Responsibility: add the house workspace shell style decision gate for future agents.

- Modify tests:
  - `tests/house-detail-shell-ui.test.ts`
  - `tests/house-images-ui.test.ts`
  - Create `tests/house-workspace-shell-guidance.test.ts`
  - Create `tests/house-workspace-shell-components.test.ts`

---

### Task 1: Add Agent Guidance Gate

**Files:**
- Modify: `AGENTS.md`
- Create: `tests/house-workspace-shell-guidance.test.ts`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-09-house-workspace-shell-design.md`
- Produces: `AGENTS.md` section heading `## House workspace shell style gate`

- [ ] **Step 1: Write the failing test**

Create `tests/house-workspace-shell-guidance.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const agentsSource = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

describe("house workspace shell agent guidance", () => {
  it("requires agents to decide whether the house workspace shell applies", () => {
    assert.match(agentsSource, /## House workspace shell style gate/);
    assert.match(agentsSource, /Before creating or changing any admin house-related page/);
    assert.match(agentsSource, /Use the shell when:/);
    assert.match(agentsSource, /app\/admin\/houses\/\[propertyId\]\/\.\.\./);
    assert.match(agentsSource, /Do not use the shell when:/);
    assert.match(agentsSource, /The page is the house list page/);
    assert.match(agentsSource, /When the shell applies:/);
    assert.match(agentsSource, /When the shell does not apply:/);
    assert.match(
      agentsSource,
      /docs\/superpowers\/specs\/2026-07-09-house-workspace-shell-design\.md/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/house-workspace-shell-guidance.test.ts
```

Expected: FAIL because `## House workspace shell style gate` is not in `AGENTS.md`.

- [ ] **Step 3: Write minimal implementation**

Insert this section in `AGENTS.md` after the Architecture rules list:

```md
## House workspace shell style gate

Before creating or changing any admin house-related page, first decide whether the House Workspace Shell applies.

Use the shell when:

- The page is under house management, especially `app/admin/houses/[propertyId]/...`.
- The page is a task workspace for one house.
- The page has, or should have, a page header, sidebar navigation, and content area.
- Examples include house details, prices, facilities, image management, and cover image ordering.

Do not use the shell when:

- The page is the house list page.
- The flow is only a dialog, dropdown, card, or small embedded widget.
- The page is login, public listing or search, advertisement management, booking, payment, or an unrelated admin module.
- The requested UI intentionally needs a different layout.

When the shell applies:

- Keep Shell Header fixed: back link, house title, DV badge, current task subtitle.
- Keep Workspace Shell fixed: rounded border frame, `16rem` desktop sidebar, mobile horizontal sidebar, content-owned scroll.
- Keep Sidebar Nav Item style fixed: icon, label, optional badge, active state.
- Keep Content Header structure fixed: icon, title, badge or subtext, and actions.
- Let Content Body be task-specific.

When the shell does not apply:

- Briefly state why before choosing another layout.

For details, read `docs/superpowers/specs/2026-07-09-house-workspace-shell-design.md`.
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/house-workspace-shell-guidance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add AGENTS.md tests/house-workspace-shell-guidance.test.ts
git commit -m "docs: add house workspace shell guidance"
```

---

### Task 2: Add Shared House Workspace Components

**Files:**
- Create: `components/admin/houses/house-task-header.tsx`
- Create: `components/admin/houses/house-workspace-shell.tsx`
- Create: `components/admin/houses/house-workspace-nav-item.tsx`
- Create: `tests/house-workspace-shell-components.test.ts`

**Interfaces:**
- Consumes: `components/ui/badge.tsx`, `components/ui/button.tsx`, `lib/utils.ts`
- Produces:
  - `HouseTaskHeader(props: HouseTaskHeaderProps): JSX.Element`
  - `HouseWorkspaceShell(props: HouseWorkspaceShellProps): JSX.Element`
  - `HouseWorkspaceNavItem(props: HouseWorkspaceNavItemProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `tests/house-workspace-shell-components.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const headerUrl = new URL("../components/admin/houses/house-task-header.tsx", import.meta.url);
const shellUrl = new URL("../components/admin/houses/house-workspace-shell.tsx", import.meta.url);
const navItemUrl = new URL("../components/admin/houses/house-workspace-nav-item.tsx", import.meta.url);

describe("house workspace shared components", () => {
  it("provides the fixed house task header", () => {
    assert.equal(existsSync(headerUrl), true);
    const source = readFileSync(headerUrl, "utf8");

    assert.match(source, /export function HouseTaskHeader/);
    assert.match(source, /backHref: string/);
    assert.match(source, /title: string/);
    assert.match(source, /propertyId: string \| number/);
    assert.match(source, /subtitle: string/);
    assert.match(source, /actions\?: ReactNode/);
    assert.match(source, /ArrowLeftIcon/);
    assert.match(source, /<Badge variant="secondary">DV-\{propertyId\}<\/Badge>/);
    assert.match(source, /className="text-base font-semibold sm:text-lg lg:text-xl"/);
  });

  it("provides the fixed workspace frame and content header slots", () => {
    assert.equal(existsSync(shellUrl), true);
    const source = readFileSync(shellUrl, "utf8");

    assert.match(source, /export function HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle: string/);
    assert.match(source, /sidebar: ReactNode/);
    assert.match(source, /contentIcon: ReactNode/);
    assert.match(source, /contentTitle: ReactNode/);
    assert.match(source, /contentMeta\?: ReactNode/);
    assert.match(source, /contentActions\?: ReactNode/);
    assert.match(source, /contentClassName\?: string/);
    assert.match(source, /rounded-lg border/);
    assert.match(source, /lg:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
    assert.match(source, /hidden border-b px-4 py-3 lg:block/);
    assert.match(source, /grid min-h-0 min-w-0 grid-rows-\[auto_minmax\(0,1fr\)\]/);
  });

  it("provides one nav item style for sections and zones", () => {
    assert.equal(existsSync(navItemUrl), true);
    const source = readFileSync(navItemUrl, "utf8");

    assert.match(source, /"use client"/);
    assert.match(source, /export const HouseWorkspaceNavItem = forwardRef/);
    assert.match(source, /active\?: boolean/);
    assert.match(source, /badge\?: ReactNode/);
    assert.match(source, /icon: ReactNode/);
    assert.match(source, /label: ReactNode/);
    assert.match(source, /min-w-44/);
    assert.match(source, /bg-primary text-primary-foreground/);
    assert.match(source, /hidden shrink-0 lg:inline-flex/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/house-workspace-shell-components.test.ts
```

Expected: FAIL because the three shared components do not exist.

- [ ] **Step 3: Create `HouseTaskHeader`**

Create `components/admin/houses/house-task-header.tsx`:

```tsx
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface HouseTaskHeaderProps {
  actions?: ReactNode;
  backHref: string;
  propertyId: string | number;
  subtitle: string;
  title: string;
}

export function HouseTaskHeader({
  actions,
  backHref,
  propertyId,
  subtitle,
  title,
}: HouseTaskHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between lg:pb-4">
      <div className="flex flex-col gap-2">
        <Button asChild className="w-fit px-0" size="sm" variant="ghost">
          <Link href={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            กลับไปบ้านพัก
          </Link>
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold sm:text-lg lg:text-xl">{title}</h1>
            <Badge variant="secondary">DV-{propertyId}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
```

- [ ] **Step 4: Create `HouseWorkspaceShell`**

Create `components/admin/houses/house-workspace-shell.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

interface HouseWorkspaceShellProps {
  children: ReactNode;
  contentActions?: ReactNode;
  contentClassName?: string;
  contentIcon: ReactNode;
  contentMeta?: ReactNode;
  contentTitle: ReactNode;
  sidebar: ReactNode;
  sidebarTitle: string;
}

export function HouseWorkspaceShell({
  children,
  contentActions,
  contentClassName,
  contentIcon,
  contentMeta,
  contentTitle,
  sidebar,
  sidebarTitle,
}: HouseWorkspaceShellProps) {
  return (
    <div className="grid overflow-hidden rounded-lg border lg:min-h-0 lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="hidden border-b px-4 py-3 lg:block">
          <h2 className="text-sm font-semibold">{sidebarTitle}</h2>
        </div>
        {sidebar}
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header
          className={cn(
            "border-b bg-muted/20 px-4 py-3",
            contentActions
              ? "flex flex-wrap items-center justify-between gap-3"
              : "hidden lg:flex lg:items-center lg:justify-between lg:gap-3",
          )}
        >
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
              {contentIcon}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{contentTitle}</h2>
              {contentMeta ? <p className="text-xs text-muted-foreground">{contentMeta}</p> : null}
            </div>
          </div>
          {contentActions ? (
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              {contentActions}
            </div>
          ) : null}
        </header>

        <div className={cn("p-4 lg:min-h-0 lg:overflow-y-auto", contentClassName)}>
          {children}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create `HouseWorkspaceNavItem`**

Create `components/admin/houses/house-workspace-nav-item.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";

import { cn } from "../../../lib/utils";
import { Badge } from "../../ui/badge";

interface HouseWorkspaceNavItemProps
  extends Omit<ComponentProps<typeof Link>, "children" | "className"> {
  active?: boolean;
  badge?: ReactNode;
  className?: string;
  icon: ReactNode;
  label: ReactNode;
}

export const HouseWorkspaceNavItem = forwardRef<HTMLAnchorElement, HouseWorkspaceNavItemProps>(
  function HouseWorkspaceNavItem(
    { active = false, badge, className, icon, label, ...props },
    ref,
  ) {
    return (
      <Link
        {...props}
        aria-current={active ? "page" : props["aria-current"]}
        className={cn(
          "flex min-w-44 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
          active && "bg-primary text-primary-foreground hover:bg-primary",
          className,
        )}
        ref={ref}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
            {icon}
          </span>
          <span className="block min-w-0 truncate font-medium">{label}</span>
        </span>
        {badge ? (
          <Badge className="hidden shrink-0 lg:inline-flex" variant={active ? "secondary" : "outline"}>
            {badge}
          </Badge>
        ) : null}
      </Link>
    );
  },
);
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
node --test tests/house-workspace-shell-components.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add components/admin/houses/house-task-header.tsx components/admin/houses/house-workspace-shell.tsx components/admin/houses/house-workspace-nav-item.tsx tests/house-workspace-shell-components.test.ts
git commit -m "feat: add house workspace shell components"
```

---

### Task 3: Move House Detail Page Onto Shared Shell

**Files:**
- Modify: `app/admin/houses/[propertyId]/page.tsx`
- Modify: `components/admin/houses/house-detail-section-nav.tsx`
- Modify: `tests/house-detail-shell-ui.test.ts`

**Interfaces:**
- Consumes:
  - `HouseTaskHeader`
  - `HouseWorkspaceShell`
  - `HouseWorkspaceNavItem`
- Produces:
  - House detail page uses the fixed shell header and workspace frame.
  - Rating is rendered in `contentActions` only for the details section so its `form={HOUSE_DETAILS_FORM_ID}` still submits through the house details form.

- [ ] **Step 1: Write the failing tests**

Update `tests/house-detail-shell-ui.test.ts`.

Add these constants near the existing component URLs:

```ts
const taskHeaderUrl = new URL(
  "../components/admin/houses/house-task-header.tsx",
  import.meta.url,
);
const workspaceShellUrl = new URL(
  "../components/admin/houses/house-workspace-shell.tsx",
  import.meta.url,
);
const navItemUrl = new URL(
  "../components/admin/houses/house-workspace-nav-item.tsx",
  import.meta.url,
);
```

Add this test inside `describe("house detail shell UI", () => { ... })`:

```ts
  it("uses the shared house workspace shell components", () => {
    const source = readFileSync(pageUrl, "utf8");
    const navSource = readFileSync(sectionNavUrl, "utf8");

    assert.equal(existsSync(taskHeaderUrl), true);
    assert.equal(existsSync(workspaceShellUrl), true);
    assert.equal(existsSync(navItemUrl), true);
    assert.match(source, /import \{ HouseTaskHeader \}/);
    assert.match(source, /import \{ HouseWorkspaceShell \}/);
    assert.match(source, /<HouseTaskHeader/);
    assert.match(source, /subtitle="จัดการข้อมูลบ้านพัก"/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle="หมวดข้อมูล"/);
    assert.match(source, /contentIcon=\{<ActiveSectionIcon aria-hidden \/>\}/);
    assert.match(source, /contentTitle=\{activeSection\.label\}/);
    assert.match(source, /contentMeta=\{sectionBadges\[activeSection\.key\]\}/);
    assert.match(source, /contentActions=\{activeSection\.key === "details" \? ratingAction : undefined\}/);
    assert.match(navSource, /HouseWorkspaceNavItem/);
  });
```

Update the existing mobile compact test:

```ts
    assert.doesNotMatch(source, /className="hidden w-fit lg:inline-flex"/);
    assert.doesNotMatch(source, /imageHref\(propertyId, safeReturnTo\)/);
```

Keep the existing assertion that `name="rating"` exists, but change the nearby rating assertion to:

```ts
    assert.match(source, /const ratingAction = \(/);
    assert.match(source, /form=\{HOUSE_DETAILS_FORM_ID\}/);
    assert.match(source, /contentActions=\{activeSection\.key === "details" \? ratingAction : undefined\}/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/house-detail-shell-ui.test.ts
```

Expected: FAIL because the page and section nav still use inline shell markup.

- [ ] **Step 3: Update section nav to use shared nav item**

In `components/admin/houses/house-detail-section-nav.tsx`, add:

```tsx
import { HouseWorkspaceNavItem } from "./house-workspace-nav-item";
```

Replace the current `<Link ...>` block inside `sections.map` with:

```tsx
            <HouseWorkspaceNavItem
              active={isActive}
              badge={item.badge}
              href={sectionHref(propertyId, item.key, returnTo)}
              icon={<SectionIcon aria-hidden className="size-4 shrink-0" />}
              key={item.key}
              label={item.label}
              ref={isActive ? activeSectionRef : undefined}
            />
```

Remove the unused imports:

```tsx
import Link from "next/link";
import { cn } from "../../../lib/utils";
import { Badge } from "../../ui/badge";
```

- [ ] **Step 4: Update the house detail page imports**

In `app/admin/houses/[propertyId]/page.tsx`, replace the lucide import:

```tsx
import { BanknoteIcon, HouseIcon, SaveIcon, SparklesIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
```

Remove these imports:

```tsx
import { ArrowLeftIcon, ImageIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "../../../../components/ui/badge";
```

Add shared component imports:

```tsx
import { HouseTaskHeader } from "../../../../components/admin/houses/house-task-header";
import { HouseWorkspaceShell } from "../../../../components/admin/houses/house-workspace-shell";
```

- [ ] **Step 5: Add the active section icon map**

Add below `type HouseDetailSectionKey`:

```tsx
const sectionIconByKey: Record<HouseDetailSectionKey, LucideIcon> = {
  details: HouseIcon,
  prices: BanknoteIcon,
  facilities: SparklesIcon,
};
```

- [ ] **Step 6: Remove dead image header helper**

Delete the `imageHref` function from `app/admin/houses/[propertyId]/page.tsx`.

- [ ] **Step 7: Create the rating action and active icon**

Add after `const canManageRating = canManageHouseRating(adminUser);`:

```tsx
  const ActiveSectionIcon = sectionIconByKey[activeSection.key];
  const ratingAction = (
    <div className="grid gap-1">
      <Label htmlFor="rating">เรตติ้ง</Label>
      <HouseDetailCombobox
        defaultValue={ratingValue(house.rating)}
        disabled={!canManageRating}
        emptyText="ไม่พบเรตติ้ง"
        form={HOUSE_DETAILS_FORM_ID}
        id="rating"
        name="rating"
        options={RATING_OPTIONS}
        placeholder="เลือกเรตติ้ง"
      />
    </div>
  );
```

- [ ] **Step 8: Replace the inline header and workspace frame**

Replace the current `<header ...>` and outer workspace `<div className="grid overflow-hidden rounded-lg border ...">` with:

```tsx
      <HouseTaskHeader
        backHref={backHref}
        propertyId={house.property_id}
        subtitle="จัดการข้อมูลบ้านพัก"
        title={house.title || "ไม่พบชื่อบ้านพัก"}
      />

      <HouseWorkspaceShell
        contentActions={activeSection.key === "details" ? ratingAction : undefined}
        contentIcon={<ActiveSectionIcon aria-hidden />}
        contentMeta={sectionBadges[activeSection.key]}
        contentTitle={activeSection.label}
        sidebar={
          <HouseDetailSectionNav
            propertyId={propertyId}
            returnTo={safeReturnTo}
            sections={detailSections}
            selectedSection={selectedSection}
          />
        }
        sidebarTitle="หมวดข้อมูล"
      >
```

Keep the existing form body branches unchanged inside the shell children. Close the shell with:

```tsx
      </HouseWorkspaceShell>
```

Remove the old inline `<aside>`, old inline content `<section>`, and old content header wrapper.

- [ ] **Step 9: Run tests to verify they pass**

Run:

```bash
node --test tests/house-workspace-shell-components.test.ts tests/house-detail-shell-ui.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add app/admin/houses/[propertyId]/page.tsx components/admin/houses/house-detail-section-nav.tsx tests/house-detail-shell-ui.test.ts
git commit -m "feat: use shared shell on house details"
```

---

### Task 4: Move Image Workspaces Onto Shared Shell

**Files:**
- Modify: `app/admin/houses/[propertyId]/images/page.tsx`
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `components/admin/images/cover-select-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

**Interfaces:**
- Consumes:
  - `HouseTaskHeader`
  - `HouseWorkspaceShell`
  - `HouseWorkspaceNavItem`
- Produces:
  - Image pages use the fixed shell header.
  - Image viewer and cover selection viewer use `sidebarTitle="ทำเล"`.
  - Image workspace frame uses `rounded-lg`, `16rem` sidebar, and the same content header structure.

- [ ] **Step 1: Write the failing tests**

Update `tests/house-images-ui.test.ts`.

Add URLs near the current source constants:

```ts
const taskHeaderPath = new URL(
  "../components/admin/houses/house-task-header.tsx",
  import.meta.url,
);
const workspaceShellPath = new URL(
  "../components/admin/houses/house-workspace-shell.tsx",
  import.meta.url,
);
const navItemPath = new URL(
  "../components/admin/houses/house-workspace-nav-item.tsx",
  import.meta.url,
);
```

Add this test near the top of the describe block:

```ts
  it("uses the shared house workspace shell on image task pages", () => {
    assert.equal(existsSync(taskHeaderPath), true);
    assert.equal(existsSync(workspaceShellPath), true);
    assert.equal(existsSync(navItemPath), true);
    assert.match(pageSource, /import \{ HouseTaskHeader \}/);
    assert.match(pageSource, /<HouseTaskHeader/);
    assert.match(source, /import \{ HouseWorkspaceShell \}/);
    assert.match(source, /import \{ HouseWorkspaceNavItem \}/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle="ทำเล"/);
    assert.match(coverSelectSource, /import \{ HouseWorkspaceShell \}/);
    assert.match(coverSelectSource, /import \{ HouseWorkspaceNavItem \}/);
    assert.match(coverSelectSource, /<HouseWorkspaceShell/);
    assert.match(coverSelectSource, /sidebarTitle="ทำเล"/);
    assert.doesNotMatch(source, />Zones</);
    assert.doesNotMatch(coverSelectSource, />Zones</);
  });
```

Update the existing "keeps the image manager bounded" test to expect the shared `16rem` frame:

```ts
    assert.match(source, /contentClassName="grid min-h-0 min-w-0 grid-rows-\[minmax\(0,1fr\)\] gap-3 p-2"/);
    assert.doesNotMatch(source, /rounded-xl/);
    assert.doesNotMatch(source, /lg:grid-cols-\[220px_1fr\]/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/house-images-ui.test.ts
```

Expected: FAIL because image pages still use inline headers and frame markup.

- [ ] **Step 3: Update image page header**

In `app/admin/houses/[propertyId]/images/page.tsx`, replace imports:

```tsx
import { HouseTaskHeader } from "../../../../../components/admin/houses/house-task-header";
```

Remove:

```tsx
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
```

Replace the inline `<header ...>` block with:

```tsx
      <HouseTaskHeader
        backHref={backHref}
        propertyId={house.property_id}
        subtitle={imageTaskLabel}
        title={house.title || "ไม่พบชื่อบ้านพัก"}
      />
```

Keep the root wrapper:

```tsx
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-4">
```

- [ ] **Step 4: Update image zone viewer imports**

In `components/admin/images/image-zone-viewer.tsx`, add:

```tsx
import { HouseWorkspaceNavItem } from "../houses/house-workspace-nav-item";
import { HouseWorkspaceShell } from "../houses/house-workspace-shell";
```

- [ ] **Step 5: Replace image zone sidebar links**

Replace each zone `<Link ...>` inside `sidebarGroups.map` with:

```tsx
                <HouseWorkspaceNavItem
                  active={isActive}
                  badge={`${group.images.length} รูป`}
                  href={imageZoneHref(propertyId, group.zone, returnTo)}
                  icon={<ZoneIcon icon={meta.icon} />}
                  key={group.zone}
                  label={meta.label}
                  onClick={clearBulkDeleteSelection}
                  ref={isActive ? activeZoneRef : undefined}
                  title={group.zone}
                />
```

- [ ] **Step 6: Wrap image zone viewer in shared shell**

Replace the current top-level workspace `<div className="grid min-w-0 ...">` through the opening of the content body with:

```tsx
    <HouseWorkspaceShell
      contentActions={
        isBulkSelecting ? (
          <>
            <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium">
              <input
                aria-label="เลือกทั้งหมดในโซนปัจจุบัน"
                checked={allCurrentZoneImagesSelected}
                className="size-4 accent-primary"
                disabled={deletableImages.length === 0 || isBusy}
                onChange={(event) => toggleSelectAllInCurrentZone(event.currentTarget.checked)}
                type="checkbox"
              />
              เลือกทั้งหมด
            </label>
            <Button
              disabled={selectedBulkDeleteImages.length === 0 || isBusy}
              onClick={openBulkDeleteDialog}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              ลบที่เลือก ({selectedBulkDeleteImages.length})
            </Button>
            <Button disabled={isBusy} onClick={clearBulkDeleteSelection} size="sm" type="button" variant="outline">
              ยกเลิก
            </Button>
          </>
        ) : (
          <>
            <Button asChild disabled={isBusy} size="sm" type="button" variant="outline">
              <Link href={coverSelectHref(propertyId, returnTo)}>
                <ImageIcon data-icon="inline-start" />
                จัดลำดับรูปแสดง
              </Link>
            </Button>
            <Button
              disabled={deletableImages.length === 0 || isBusy}
              onClick={() => setIsBulkSelecting(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2Icon data-icon="inline-start" />
              เลือกลบ
            </Button>
            <Label
              aria-disabled={isBusy}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer text-foreground",
                isBusy && "pointer-events-none opacity-50",
              )}
              htmlFor="house-images-upload"
            >
              {isBusy ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <UploadCloudIcon data-icon="inline-start" />
              )}
              {isBusy ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
            </Label>
            <input
              accept="image/avif,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={isBusy}
              id="house-images-upload"
              multiple
              name="images"
              onChange={onFilesChange}
              ref={inputRef}
              type="file"
            />
          </>
        )
      }
      contentClassName="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2"
      contentIcon={<ZoneIcon icon={selectedMeta.icon} />}
      contentMeta={`${visibleImages.length} รูป`}
      contentTitle={selectedMeta.label}
      sidebar={
        <ScrollArea className="w-full min-w-0 lg:h-full">
          <nav
            aria-label="Image zones"
            className="flex w-max min-w-full gap-2 p-2 lg:w-auto lg:min-w-0 lg:flex-col lg:p-3"
          >
            {sidebarGroups.map((group) => {
              const isActive = group.zone === selectedGroup.zone;
              const meta = getImageZoneMeta(group.zone);

              return (
                <HouseWorkspaceNavItem
                  active={isActive}
                  badge={`${group.images.length} รูป`}
                  href={imageZoneHref(propertyId, group.zone, returnTo)}
                  icon={<ZoneIcon icon={meta.icon} />}
                  key={group.zone}
                  label={meta.label}
                  onClick={clearBulkDeleteSelection}
                  ref={isActive ? activeZoneRef : undefined}
                  title={group.zone}
                />
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      }
      sidebarTitle="ทำเล"
    >
```

Keep the existing body starting at:

```tsx
          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-lg">
```

Close with:

```tsx
    </HouseWorkspaceShell>
```

Remove the old inline `<aside>`, `<section>`, and content `<header>` wrappers.

- [ ] **Step 7: Update cover select viewer imports**

In `components/admin/images/cover-select-viewer.tsx`, add:

```tsx
import { HouseWorkspaceNavItem } from "../houses/house-workspace-nav-item";
import { HouseWorkspaceShell } from "../houses/house-workspace-shell";
```

- [ ] **Step 8: Wrap cover select viewer in shared shell**

Replace the current workspace frame with `HouseWorkspaceShell` using this shape:

```tsx
    <HouseWorkspaceShell
      contentActions={
        <>
          <Button asChild size="sm" type="button" variant="outline">
            <Link
              aria-disabled={isPending}
              className={cn(isPending && "pointer-events-none opacity-50")}
              href={normalImageHref(propertyId, returnTo)}
            >
              <XIcon data-icon="inline-start" />
              ยกเลิก
            </Link>
          </Button>
          <Button disabled={!canSort} onClick={openSortDialog} size="sm" type="button" variant="outline">
            <ArrowLeftRightIcon data-icon="inline-start" />
            เรียงรูป
          </Button>
          <Button disabled={!canSave} onClick={saveSelection} size="sm" type="button">
            {isPending ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            บันทึก ({selectedIds.length})
          </Button>
        </>
      }
      contentClassName="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2"
      contentIcon={selectedMeta ? <ZoneIcon icon={selectedMeta.icon} /> : <ImageIcon aria-hidden className="size-4" />}
      contentMeta={`เลือก ${HOUSE_COVER_SELECT_MIN}-${HOUSE_COVER_SELECT_MAX} รูป · ${selectedCountLabel(selectedIds.length)}`}
      contentTitle="จัดลำดับรูปแสดง"
      sidebar={
        <ScrollArea className="w-full min-w-0 lg:h-full">
          <nav
            aria-label="Cover select image zones"
            className="flex w-max min-w-full gap-2 p-2 lg:w-auto lg:min-w-0 lg:flex-col lg:p-3"
          >
            <HouseWorkspaceNavItem
              active={!selectedZone}
              badge={`${allImages.length} รูป`}
              href={coverSelectHref(propertyId, allZonesKey, returnTo)}
              icon={<ImageIcon aria-hidden className="size-4" />}
              label="ทั้งหมด"
              ref={!selectedZone ? activeZoneRef : undefined}
            />
            {groups.map((group) => {
              const isActive = group.zone === selectedZone;
              const meta = getImageZoneMeta(group.zone);

              return (
                <HouseWorkspaceNavItem
                  active={isActive}
                  badge={`${group.images.length} รูป`}
                  href={coverSelectHref(propertyId, group.zone, returnTo)}
                  icon={<ZoneIcon icon={meta.icon} />}
                  key={group.zone}
                  label={meta.label}
                  ref={isActive ? activeZoneRef : undefined}
                  title={group.zone}
                />
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      }
      sidebarTitle="ทำเล"
    >
```

Keep the existing image-grid body and close with:

```tsx
    </HouseWorkspaceShell>
```

Remove old inline frame, sidebar, content header, and duplicated action wrapper.

- [ ] **Step 9: Run tests to verify they pass**

Run:

```bash
node --test tests/house-workspace-shell-components.test.ts tests/house-images-ui.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add app/admin/houses/[propertyId]/images/page.tsx components/admin/images/image-zone-viewer.tsx components/admin/images/cover-select-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: align image workspaces to house shell"
```

---

### Task 5: Final Verification

**Files:**
- Review: all files changed in Tasks 1-4
- Modify: none

**Interfaces:**
- Consumes: all prior task outputs
- Produces: verified implementation ready for user review

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS and produce a Next.js build.

- [ ] **Step 4: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Check changed files**

Run:

```bash
git status --short
```

Expected: only intended changes remain unstaged or all task commits are present with no accidental dependency, lockfile, migration, or unrelated file changes.
