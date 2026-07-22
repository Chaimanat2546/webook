# Quotation List UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the quotation list and navigation so it matches the established Admin UI, provides responsive row/card navigation and complete loading, empty, error, and delete feedback without changing quotation data contracts.

**Architecture:** Keep the existing server page, account-scoped `list_quotations` RPC, pagination, delete server action, and Admin Shell. Add a local Suspense boundary and contained error/empty states in the page, then reuse the existing mobile-card/desktop-table and DropdownMenu patterns in the client list. Do not add a shared abstraction or route-level boundary that changes unrelated quotation screens.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, existing ShadcnUI primitives, Sonner, Node.js `node:test`.

## Global Constraints

- This plan implements only MVP 1 from `docs/superpowers/specs/2026-07-21-quotation-module-ux-polish-design.md`.
- Do not change Database schema, migrations, RLS, RPC signatures, repository contracts, pagination, permissions, soft-delete behavior, or money calculations.
- Search continues to support document number, customer, reference, and subject through the existing RPC; subject is not displayed because the current List API does not return it.
- Reuse `AdminShell`, `Button`, `Input`, `Card`, `Table`, `DropdownMenu`, `Dialog`, `Empty`, `Skeleton`, and the mounted Sonner toaster.
- Use Toast for mutation results and inline content/field errors for recoverable local failures.
- Preserve Mobile-first behavior and verify at 390, 768, 1280, and 1536 px.
- Add no dependency and create no generic page-header, list, notice, or error abstraction.

## File Map

- Modify `app/admin/quotations/page.tsx`: header/search composition, Suspense list loading, empty state, and contained list-load error.
- Modify `components/admin/quotations/quotation-list.tsx`: responsive cards/table, row navigation, action menu, delete feedback, and pending state.
- Modify `tests/quotation-ui.test.ts`: source-level regressions for the approved list structure and states.
- Modify `docs/quotation-management.md`: record the actual responsive list and feedback behavior.
- Reuse unchanged `app/admin/quotations/actions.ts`, `server/repositories/quotations.ts`, `components/admin/houses/pagination.tsx`, and `components/ui/*`.

---

### Task 1: Page Hierarchy, Loading, Empty, And Load-error States

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `app/admin/quotations/page.tsx`

**Interfaces:**
- Consumes: `listQuotations(supabase, { page, pageSize, search }): Promise<QuotationListResult>` and existing `Pagination`/`QuotationList` components.
- Produces: server-rendered page with `Suspense`, `QuotationListSkeleton`, `QuotationResults`, empty CTA, and contained retry state; repository interfaces remain unchanged.

- [ ] **Step 1: Add the failing page-state regression test**

Append this test beside the existing `lists quotations with server search and pagination` test in `tests/quotation-ui.test.ts`:

```ts
it("shows complete quotation list loading, empty, and error feedback", () => {
  const page = source("../app/admin/quotations/page.tsx");

  assert.match(page, /import \{ Suspense \} from "react"/);
  assert.match(page, /import \{ Input \} from "\.\.\/\.\.\/\.\.\/components\/ui\/input"/);
  assert.match(page, /function QuotationListSkeleton/);
  assert.match(page, /<Suspense fallback=\{<QuotationListSkeleton \/>\}>/);
  assert.match(page, /<EmptyDescription>/);
  assert.match(page, /สร้างใบเสนอราคาแรก/);
  assert.match(page, /ไม่สามารถโหลดรายการใบเสนอราคาได้/);
  assert.match(page, />ลองใหม่</);
  assert.match(page, /pageSize: 20/);
  assert.doesNotMatch(page, /subject:/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL in `shows complete quotation list loading, empty, and error feedback` because the page has no Suspense skeleton, retry state, or empty CTA yet.

- [ ] **Step 3: Implement the page states with existing primitives**

Refactor `app/admin/quotations/page.tsx` so it keeps the current auth/query behavior and uses this structure:

Remove the top-level awaited `let result = await listQuotations(...)` block; the query and out-of-range page retry now live only inside `QuotationResults` so the Suspense fallback can render.

```tsx
import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { QuotationList } from "../../../components/admin/quotations/quotation-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Button } from "../../../components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";
import { listQuotations } from "../../../server/repositories/quotations";

function QuotationListSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายการใบเสนอราคา" className="space-y-3">
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="space-y-4 rounded-xl border p-4" key={index}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
      <div className="hidden rounded-xl border p-4 md:block">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="mt-3 h-10 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

async function QuotationResults({
  requestedPage,
  search,
  supabase,
}: {
  requestedPage: number;
  search: string;
  supabase: SupabaseClient;
}) {
  try {
    let result = await listQuotations(supabase, {
      page: requestedPage,
      pageSize: 20,
      search,
    });
    if (requestedPage > result.totalPages) {
      result = await listQuotations(supabase, {
        page: result.totalPages,
        pageSize: 20,
        search,
      });
    }

    if (result.items.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{search ? "ไม่พบใบเสนอราคาที่ค้นหา" : "ยังไม่มีใบเสนอราคา"}</EmptyTitle>
            <EmptyDescription>
              {search ? "ลองเปลี่ยนคำค้นหา" : "สร้างใบเสนอราคาแรกเพื่อเริ่มใช้งาน"}
            </EmptyDescription>
          </EmptyHeader>
          {!search ? (
            <EmptyContent>
              <Button asChild>
                <Link href="/admin/quotations/new">สร้างใบเสนอราคาแรก</Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      );
    }

    return (
      <>
        <QuotationList quotations={result.items} />
        <Pagination
          basePath="/admin/quotations"
          currentPage={result.page}
          search={search}
          totalPages={result.totalPages}
        />
      </>
    );
  } catch (error) {
    console.error(
      "Failed to list quotations",
      error instanceof Error ? error.message : "Unknown error",
    );
    return (
      <Empty role="alert">
        <EmptyHeader>
          <EmptyTitle>ไม่สามารถโหลดรายการใบเสนอราคาได้</EmptyTitle>
          <EmptyDescription>กรุณาลองใหม่อีกครั้ง</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/admin/quotations">ลองใหม่</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
}
```

Keep the existing permission check. Replace only the successful page composition with the established header, Shadcn `Input`, and Suspense boundary:

```tsx
return (
  <div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold">ใบเสนอราคา</h1>
        <p className="text-sm font-medium text-muted-foreground">
          สร้าง แก้ไข พิมพ์ และจัดการใบเสนอราคา
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="w-full sm:w-auto" variant="outline">
          <Link href="/admin/quotations/settings/company">ตั้งค่าใบเสนอราคา</Link>
        </Button>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/quotations/new">สร้างใบเสนอราคา</Link>
        </Button>
      </div>
    </div>
    <form className="mb-4 flex gap-2 md:max-w-sm">
      <label className="sr-only" htmlFor="quotation-search">ค้นหาใบเสนอราคา</label>
      <Input
        className="min-w-0 flex-1"
        defaultValue={search}
        id="quotation-search"
        name="q"
        placeholder="ค้นหาเลขที่ ลูกค้า อ้างอิง หรือเรื่องงาน"
        type="search"
      />
      <Button className="shrink-0" type="submit">
        <SearchIcon aria-hidden className="size-4" />
        ค้นหา
      </Button>
    </form>
    <Suspense fallback={<QuotationListSkeleton />}>
      <QuotationResults requestedPage={requestedPage} search={search} supabase={supabase} />
    </Suspense>
  </div>
);
```

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm run typecheck
```

Expected: both commands PASS. Confirm the page still calls `listQuotations` with `pageSize: 20` and has no repository or migration diff.

- [ ] **Step 5: Commit the page-state slice**

```powershell
git add -- app/admin/quotations/page.tsx tests/quotation-ui.test.ts
git commit -m "feat: polish quotation list states"
```

---

### Task 2: Responsive Rows, Action Menu, And Delete Toast

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `components/admin/quotations/quotation-list.tsx`

**Interfaces:**
- Consumes: unchanged `QuotationListItem[]`, `deleteQuotationAction(id)`, `formatBaht`, Next router, and mounted Sonner toaster.
- Produces: mouse-clickable cards/rows with a semantic primary edit link for keyboard users, `QuotationActionsMenu`, the current edit/print/delete destinations, and delete success/error Toast feedback.

- [ ] **Step 1: Add the failing responsive-list regression test**

Append this test beside the page-state test:

```ts
it("uses responsive clickable quotation rows, a compact action menu, and delete toasts", () => {
  const list = source("../components/admin/quotations/quotation-list.tsx");

  assert.match(list, /import \{ toast \} from "sonner"/);
  assert.match(list, /function QuotationActionsMenu/);
  assert.match(list, /<DropdownMenu modal=\{false\}>/);
  assert.match(list, /aria-label="เปิดเมนูจัดการใบเสนอราคา"/);
  assert.match(list, /onClick=\{\(\) => openQuotation\(quotation\)\}/);
  assert.match(list, /aria-label=\{`เปิด \$\{quotation\.documentNumber\}`\}/);
  assert.match(list, /table-fixed/);
  assert.match(list, /toast\.success/);
  assert.match(list, /toast\.error/);
  assert.match(list, /กำลังลบ…/);
  assert.doesNotMatch(list, /<Button asChild size="sm" variant="outline"><Link/);
  assert.doesNotMatch(list, /<TableHead>อัปเดต<\/TableHead>/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL in `uses responsive clickable quotation rows, a compact action menu, and delete toasts` because the list still has three visible buttons and no Toast or row navigation.

- [ ] **Step 3: Replace visible action clusters with the existing DropdownMenu pattern**

In `components/admin/quotations/quotation-list.tsx`, add these imports and replace `QuotationActions` with `QuotationActionsMenu`:

```tsx
import {
  EllipsisVerticalIcon,
  PencilLineIcon,
  PrinterIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

function QuotationActionsMenu({
  quotation,
  onDelete,
}: {
  quotation: QuotationListItem;
  onDelete: () => void;
}) {
  const href = quotationHref(quotation.id);
  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="เปิดเมนูจัดการใบเสนอราคา" size="icon" type="button" variant="outline">
            <EllipsisVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={href}><PencilLineIcon aria-hidden />แก้ไข</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${href}?print=1`}><PrinterIcon aria-hidden />พิมพ์</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} variant="destructive">
              <Trash2Icon aria-hidden />ลบ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 4: Add mouse row activation, a semantic keyboard link, and compact responsive markup**

Inside `QuotationList`, add this single mouse activation helper. Keep keyboard access on a real `Link`; do not add `role="link"` to a container that also contains an action menu.

```tsx
function openQuotation(quotation: QuotationListItem) {
  router.push(quotationHref(quotation.id));
}
```

Render Mobile cards with bounded content and the action menu:

```tsx
<div className="space-y-3 md:hidden">
  {quotations.map((quotation) => (
    <Card
      className="cursor-pointer"
      key={quotation.id}
      onClick={() => openQuotation(quotation)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm">
            <Link
              aria-label={`เปิด ${quotation.documentNumber}`}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={quotationHref(quotation.id)}
              onClick={(event) => event.stopPropagation()}
            >
              {quotation.documentNumber}
            </Link>
          </CardTitle>
          <p className="truncate text-sm text-muted-foreground">{quotation.customerName || "-"}</p>
        </div>
        <QuotationActionsMenu quotation={quotation} onDelete={() => setSelected(quotation)} />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div><dt className="text-muted-foreground">วันที่ออก</dt><dd>{formatDate(quotation.issueDate)}</dd></div>
          <div><dt className="text-muted-foreground">ใช้ได้ถึง</dt><dd>{formatDate(quotation.validUntil)}</dd></div>
          <div className="text-right"><dt className="text-muted-foreground">ยอดสุทธิ</dt><dd className="font-medium tabular-nums">{formatBaht(quotation.grandTotal)}</dd></div>
        </dl>
      </CardContent>
    </Card>
  ))}
</div>
```

Render the Desktop table with explicit widths, no updated-at column, and the same activation/action behavior:

```tsx
<Card className="hidden overflow-hidden p-0 md:block">
  <Table className="table-fixed">
    <TableHeader>
      <TableRow>
        <TableHead className="w-[24%]">เลขที่เอกสาร</TableHead>
        <TableHead className="w-[28%]">ลูกค้า</TableHead>
        <TableHead className="w-[14%]">วันที่ออก</TableHead>
        <TableHead className="w-[14%]">ใช้ได้ถึง</TableHead>
        <TableHead className="w-[14%] text-right">ยอดสุทธิ</TableHead>
        <TableHead className="w-[6%]"><span className="sr-only">การจัดการ</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {quotations.map((quotation) => (
        <TableRow
          className="cursor-pointer"
          key={quotation.id}
          onClick={() => openQuotation(quotation)}
        >
          <TableCell className="truncate font-medium">
            <Link
              aria-label={`เปิด ${quotation.documentNumber}`}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={quotationHref(quotation.id)}
              onClick={(event) => event.stopPropagation()}
            >
              {quotation.documentNumber}
            </Link>
          </TableCell>
          <TableCell className="truncate">{quotation.customerName || "-"}</TableCell>
          <TableCell>{formatDate(quotation.issueDate)}</TableCell>
          <TableCell>{formatDate(quotation.validUntil)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatBaht(quotation.grandTotal)}</TableCell>
          <TableCell className="text-right">
            <QuotationActionsMenu quotation={quotation} onDelete={() => setSelected(quotation)} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Card>
```

Remove the unused `CardFooter` import.

- [ ] **Step 5: Add delete Toast and pending copy without changing the action**

Replace `deleteSelected` with:

```tsx
function deleteSelected() {
  if (!selected) return;
  setFormError("");
  startTransition(async () => {
    const result = await deleteQuotationAction(selected.id);
    if (!result.ok) {
      setFormError(result.formError);
      toast.error(result.formError);
      return;
    }
    toast.success(`ลบ ${selected.documentNumber} แล้ว`);
    setSelected(null);
    router.refresh();
  });
}
```

Keep the existing Dialog and change only its confirm label:

```tsx
<Button disabled={isPending} onClick={deleteSelected} type="button" variant="destructive">
  {isPending ? "กำลังลบ…" : "ลบ"}
</Button>
```

- [ ] **Step 6: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm run typecheck
npm run lint -- components/admin/quotations/quotation-list.tsx app/admin/quotations/page.tsx tests/quotation-ui.test.ts
```

Expected: all commands PASS. Manually verify that mouse click opens a row, keyboard Enter on the document link opens it, the menu opens independently, and selecting Delete does not navigate.

- [ ] **Step 7: Commit the responsive-list slice**

```powershell
git add -- components/admin/quotations/quotation-list.tsx tests/quotation-ui.test.ts
git commit -m "feat: polish quotation list interactions"
```

---

### Task 3: Documentation And MVP Verification

**Files:**
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: completed MVP 1 behavior from Tasks 1-2.
- Produces: practical documentation of the current list UX; no runtime interface.

- [ ] **Step 1: Document the implemented list behavior**

Add this subsection after `## Routes` in `docs/quotation-management.md`:

```markdown
## Quotation List UX

- The list keeps server-side account-scoped search and 20-row pagination.
- Search covers document number, customer, reference, and subject; the list displays only fields already returned by the list RPC.
- Mobile uses compact cards and Tablet/Desktop use a fixed-layout table.
- A card or row opens the quotation with a mouse click. Keyboard users open it through the focused document-number link. Its action menu keeps edit, print, and soft-delete controls isolated from row navigation.
- Loading uses a shape-preserving skeleton. Empty results show a relevant next action, and list-load failures show a contained retry state.
- Soft delete still requires confirmation and reports success or failure through Toast without changing the existing ownership and permission checks.
```

- [ ] **Step 2: Run the complete verification suite**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all four commands PASS. If a pre-existing unrelated failure occurs, record its exact command and output; do not weaken or delete the failing check.

- [ ] **Step 3: Perform the responsive and accessibility acceptance pass**

With the local app already running, inspect `/admin/quotations` at:

```text
390 × 844
768 × 1024
1280 × 800
1536 × 864
```

Confirm:

```text
- no page-level horizontal overflow;
- actions stack on Mobile and align right from sm upward;
- Mobile cards change to the table at md;
- long document/customer text truncates without widening the page;
- mouse click on a card/row and keyboard Enter on its document link open the intended quotation;
- the ellipsis menu does not open the row;
- delete confirmation prevents duplicate submit and shows success/error Toast;
- empty search, initial empty, loading skeleton, and retry state use clear Thai copy;
- visible focus remains on search, row/card, menu, dialog, pagination, and page actions.
```

- [ ] **Step 4: Confirm the diff stayed inside the UX-only boundary**

Run:

```powershell
git diff --check
git diff --name-only HEAD~2..HEAD
git status --short
```

Expected changed runtime/test/docs files only:

```text
app/admin/quotations/page.tsx
components/admin/quotations/quotation-list.tsx
tests/quotation-ui.test.ts
docs/quotation-management.md
```

There must be no change under `supabase/migrations/`, `server/repositories/`, `app/admin/quotations/actions.ts`, package manifests, or lockfiles.

- [ ] **Step 5: Commit documentation**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: describe quotation list UX"
```
