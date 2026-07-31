# User Manager Stable Loading Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Central User Manager results area stable while the route or a Tenant user page loads.

**Architecture:** A shared `UserTableSkeleton` owns the responsive loading geometry. `UserTable` reserves the same fixed results viewport for loading, empty, mobile-card, and desktop-table states; pagination remains outside that viewport. Desktop columns use fixed table layout and explicit widths without changing the existing user-management API or Agent contract.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn UI, Node.js test runner.

## Global Constraints

- Keep the existing 10-user pagination and previous/next behavior.
- Do not change the Agent or API contracts.
- Reuse the existing `Skeleton`, `Table`, `Card`, and `Button` primitives.
- Preserve responsive mobile cards and desktop tables.
- Do not add dependencies.

---

### Task 1: Shared stable results viewport

**Files:**
- Create: `components/admin/user-manager/user-table-skeleton.tsx`
- Modify: `components/admin/user-manager/user-table.tsx`
- Modify: `app/admin/user-manager/loading.tsx`
- Test: `tests/central-user-manager-page.test.ts`

**Interfaces:**
- Produces: `UserTableSkeleton`, a responsive skeleton with the same reserved viewport geometry as the final results.
- Consumes: existing `UserTable` props and route-level `loading.tsx`; no contract changes.

- [ ] Add failing source-contract assertions for a shared skeleton, accessible loading label, stable scroll viewport, fixed desktop columns, and pagination outside the viewport.
- [ ] Run `node --test --import ./tests/register-server-only.mjs --experimental-strip-types tests/central-user-manager-page.test.ts` and confirm the new assertions fail for missing behavior.
- [ ] Add `UserTableSkeleton` with 10 responsive rows/cards and decorative skeleton blocks.
- [ ] Render the skeleton while the user list is busy and empty; otherwise render empty or populated content inside the same reserved scroll viewport.
- [ ] Apply `table-fixed`, explicit column widths, safe truncation, `aria-busy`, and keep pagination outside the results viewport.
- [ ] Rebuild route-level loading UI to match the real header action and three-column workspace, reusing `UserTableSkeleton` in the center.
- [ ] Re-run the focused test, typecheck, lint, and inspect mobile/desktop behavior.

