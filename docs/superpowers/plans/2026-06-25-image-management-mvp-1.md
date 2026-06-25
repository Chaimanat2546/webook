# Image Management MVP 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only admin image-management MVP with Supabase Auth, Administrator-only access, paginated house listing, and read-only house image display.

**Architecture:** Use server-first Next.js App Router pages. Keep Supabase/auth/database logic behind `server/` modules, keep image URL validation in `lib/`, and keep UI read-only/mobile-first so MVP 2-5 can add client draft state and mutations without rewriting data access.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, `@supabase/ssr`, `@supabase/supabase-js`, Node `--test`.

---

## File Structure

- Modify `package.json`: add `typecheck` and `test` scripts if they are still missing.
- Modify `.env.example`: document required Supabase env names without real secrets.
- Create/modify `components.json`, `lib/utils.ts`, `components/ui/*`, and `app/globals.css`: shadcn setup and selected primitives.
- Modify `next.config.ts`: allow the Lambda image host for Next image rendering.
- Create `lib/env.ts`: read and validate public Supabase env values.
- Create `lib/aws-image-url.ts`: validate `image_name` and build display URLs.
- Create `tests/aws-image-url.test.ts`: regression tests for image URL safety.
- Create `server/auth/admin.ts`: Administrator-only authorization logic.
- Create `tests/admin-auth.test.ts`: pure tests for role and lookup behavior.
- Create `lib/supabase/server.ts`: lazy server Supabase client from cookies.
- Create `lib/supabase/browser.ts`: browser Supabase client for login only.
- Create `server/repositories/admin-users.ts`: read allowed auth user row without selecting `password`.
- Create `server/repositories/listings.ts`: paginated/searchable house reads.
- Create `server/repositories/images.ts`: house image reads.
- Create `server/services/houses.ts`: normalize pagination/search inputs and call listing repository.
- Create `server/services/images.ts`: group image records by zone and sort by `image_move`.
- Create `tests/house-listing.test.ts`: pure tests for pagination/search/sort helpers.
- Create `tests/house-images.test.ts`: pure tests for zone grouping/order.
- Modify `app/layout.tsx`: update metadata and html lang.
- Replace `app/page.tsx`: redirect to `/admin/houses`.
- Create `app/login/actions.ts`: login/logout server actions.
- Create `app/login/page.tsx`: email/password login UI.
- Create `components/layout/admin-shell.tsx`: responsive admin shell using shadcn `Sheet`, `Button`, and `Separator`.
- Create `components/admin/houses/house-list.tsx`: mobile cards and desktop table using shadcn `Card`, `Table`, `Badge`, and `Button`.
- Create `components/admin/houses/pagination.tsx`: numbered pagination links using shadcn `Pagination`.
- Create `components/admin/images/image-zone-viewer.tsx`: selected-zone read-only image UI using shadcn `Card`, `Badge`, `ScrollArea`, and `AspectRatio`.
- Create `app/admin/layout.tsx`: protected admin layout.
- Create `app/admin/houses/page.tsx`: server-rendered paginated house list.
- Create `app/admin/houses/[propertyId]/images/page.tsx`: server-rendered image page.
- Create `app/admin/houses/loading.tsx` and `app/admin/houses/[propertyId]/images/loading.tsx`: simple skeleton states.
- Create `docs/api.md` entries only if route/API behavior changes. For this MVP no new API routes are planned.

Use shadcn/ui for MVP 1 because it improves maintainability, reuse, accessible shell navigation, tables, cards, loading states, and future MVP mutation dialogs. The implementing agent must not run shadcn install/add commands without explicit user approval in that session.

### Task 1: Project Scripts, Env Documentation, And Shadcn Setup

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create/Modify: `components.json`
- Create/Modify: `lib/utils.ts`
- Create/Modify: `components/ui/button.tsx`
- Create/Modify: `components/ui/input.tsx`
- Create/Modify: `components/ui/field.tsx`
- Create/Modify: `components/ui/card.tsx`
- Create/Modify: `components/ui/table.tsx`
- Create/Modify: `components/ui/badge.tsx`
- Create/Modify: `components/ui/alert.tsx`
- Create/Modify: `components/ui/skeleton.tsx`
- Create/Modify: `components/ui/sheet.tsx`
- Create/Modify: `components/ui/separator.tsx`
- Create/Modify: `components/ui/scroll-area.tsx`
- Create/Modify: `components/ui/aspect-ratio.tsx`
- Create/Modify: `components/ui/pagination.tsx`
- Create/Modify: `components/ui/empty.tsx`

- [ ] **Step 1: Add missing scripts**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "node --test \"tests/**/*.test.ts\""
  }
}
```

- [ ] **Step 2: Document env names**

Update `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Verify scripts exist**

Run:

```powershell
npm.cmd run typecheck
```

Expected: TypeScript runs. It may fail only for code not yet implemented in later tasks; if it fails here, the failure should be from existing scaffold only, not JSON syntax.

- [ ] **Step 4: Ask the user to run shadcn setup**

Ask the user to run these commands from `C:\Projects\webook`:

```powershell
npx shadcn@latest init --defaults
npx shadcn@latest add button input field card table badge alert skeleton sheet separator scroll-area aspect-ratio pagination empty
```

Expected: `components.json`, `lib/utils.ts`, and `components/ui/*` are created or updated. Do not run these commands yourself unless the user explicitly approves installation/modification commands in the current session.

- [ ] **Step 5: Inspect generated shadcn files**

Read:

```powershell
Get-Content -Raw components.json
Get-Content -Raw lib\utils.ts
Get-ChildItem components\ui | Select-Object Name
```

Expected: aliases match the project `@/*` path, and the listed UI components exist.

- [ ] **Step 6: Verify after shadcn setup**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS or only pre-existing scaffold errors. Fix shadcn-related import/CSS issues before continuing.

- [ ] **Step 7: Commit**

```powershell
git add -- package.json package-lock.json .env.example components.json lib/utils.ts components/ui app/globals.css
git commit -m "chore: set up shadcn ui"
```

### Task 2: Image URL Builder

**Files:**
- Create: `lib/aws-image-url.ts`
- Create: `tests/aws-image-url.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Write failing image URL tests**

Create `tests/aws-image-url.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAwsImageUrl } from "../lib/aws-image-url";

describe("buildAwsImageUrl", () => {
  it("builds a Lambda image URL from a safe image name", () => {
    const url = buildAwsImageUrl("villa-01.webp");

    assert.equal(
      url,
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa-01.webp",
    );
  });

  it("rejects path traversal", () => {
    assert.throws(() => buildAwsImageUrl("../secret.webp"), /Invalid image name/);
    assert.throws(() => buildAwsImageUrl("%2e%2e/secret.webp"), /Invalid image name/);
  });

  it("rejects unsupported extensions", () => {
    assert.throws(() => buildAwsImageUrl("villa.svg"), /Invalid image extension/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/aws-image-url.test.ts
```

Expected: FAIL because `lib/aws-image-url.ts` does not exist.

- [ ] **Step 3: Implement image URL builder**

Create `lib/aws-image-url.ts`:

```ts
const AWS_IMAGE_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid image name");
  }
}

export function buildAwsImageUrl(imageName: string): string {
  const trimmed = imageName.trim();
  const decoded = decodePathSegment(trimmed).replace(/\\/g, "/");

  if (
    !trimmed ||
    trimmed.startsWith("//") ||
    decoded.includes("/") ||
    decoded.split("/").includes("..")
  ) {
    throw new Error("Invalid image name");
  }

  if (!ALLOWED_EXTENSIONS.some((extension) => decoded.toLowerCase().endsWith(extension))) {
    throw new Error("Invalid image extension");
  }

  return `${AWS_IMAGE_BASE_URL}/${encodeURIComponent(decoded)}`;
}

export const awsImageHostname = new URL(AWS_IMAGE_BASE_URL).hostname;
```

- [ ] **Step 4: Allow the Lambda image host**

Update `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
node --test tests/aws-image-url.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- lib/aws-image-url.ts tests/aws-image-url.test.ts next.config.ts
git commit -m "feat: add safe aws image urls"
```

### Task 3: Administrator Authorization Logic

**Files:**
- Create: `server/auth/admin.ts`
- Create: `tests/admin-auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

Create `tests/admin-auth.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_ROLE_ID,
  canAccessAdmin,
  pickAdminUser,
} from "../server/auth/admin";

describe("admin authorization", () => {
  it("allows only Administrator role", () => {
    assert.equal(canAccessAdmin({ role_id: ADMIN_ROLE_ID }), true);
    assert.equal(canAccessAdmin({ role_id: 2 }), false);
    assert.equal(canAccessAdmin({ role_id: 3 }), false);
    assert.equal(canAccessAdmin(null), false);
  });

  it("prefers uid match before email fallback", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: { id: 1, role_id: 3 },
      byEmail: { id: 2, role_id: 1 },
    });

    assert.deepEqual(user, { id: 1, role_id: 3 });
  });

  it("uses email fallback when uid match is missing", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: null,
      byEmail: { id: 2, role_id: 1 },
    });

    assert.deepEqual(user, { id: 2, role_id: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/admin-auth.test.ts
```

Expected: FAIL because `server/auth/admin.ts` does not exist.

- [ ] **Step 3: Implement pure auth helpers**

Create `server/auth/admin.ts`:

```ts
export const ADMIN_ROLE_ID = 1;

export interface AdminUserForAuth {
  id: number;
  role_id: number | null;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export function canAccessAdmin(user: Pick<AdminUserForAuth, "role_id"> | null): boolean {
  return user?.role_id === ADMIN_ROLE_ID;
}

export function pickAdminUser({
  byEmail,
  byUid,
}: {
  authUser: AuthUserIdentity;
  byEmail: AdminUserForAuth | null;
  byUid: AdminUserForAuth | null;
}): AdminUserForAuth | null {
  return byUid ?? byEmail;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test tests/admin-auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- server/auth/admin.ts tests/admin-auth.test.ts
git commit -m "feat: add administrator authorization rules"
```

### Task 4: Supabase Clients And Admin User Repository

**Files:**
- Create: `lib/env.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/browser.ts`
- Create: `server/repositories/admin-users.ts`
- Modify: `server/auth/admin.ts`

- [ ] **Step 1: Add env helper**

Create `lib/env.ts`:

```ts
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { anonKey, url };
}
```

- [ ] **Step 2: Add server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "../env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { anonKey, url } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, options, value } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
```

- [ ] **Step 3: Add browser client**

Create `lib/supabase/browser.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "../env";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
```

- [ ] **Step 4: Add admin user repository**

Create `server/repositories/admin-users.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminUserForAuth, AuthUserIdentity } from "../auth/admin";

type AdminUserRow = AdminUserForAuth;

export async function findAdminUserByAuthIdentity(
  supabase: SupabaseClient,
  authUser: AuthUserIdentity,
): Promise<{ byEmail: AdminUserRow | null; byUid: AdminUserRow | null }> {
  const { data: byUid, error: uidError } = await supabase
    .from("users")
    .select("id, role_id")
    .eq("uid", authUser.id)
    .maybeSingle();

  if (uidError) {
    throw new Error(uidError.message);
  }

  if (!authUser.email) {
    return { byEmail: null, byUid };
  }

  const { data: byEmail, error: emailError } = await supabase
    .from("users")
    .select("id, role_id")
    .eq("email", authUser.email)
    .maybeSingle();

  if (emailError) {
    throw new Error(emailError.message);
  }

  return { byEmail, byUid };
}
```

- [ ] **Step 5: Add server auth orchestration**

Replace `server/auth/admin.ts` with:

```ts
import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import { findAdminUserByAuthIdentity } from "../repositories/admin-users";

export const ADMIN_ROLE_ID = 1;

export interface AdminUserForAuth {
  id: number;
  role_id: number | null;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export function canAccessAdmin(user: Pick<AdminUserForAuth, "role_id"> | null): boolean {
  return user?.role_id === ADMIN_ROLE_ID;
}

export function pickAdminUser({
  byEmail,
  byUid,
}: {
  authUser: AuthUserIdentity;
  byEmail: AdminUserForAuth | null;
  byUid: AdminUserForAuth | null;
}): AdminUserForAuth | null {
  return byUid ?? byEmail;
}

export const requireAdmin = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const matches = await findAdminUserByAuthIdentity(supabase, {
    email: user.email,
    id: user.id,
  });
  const adminUser = pickAdminUser({ authUser: user, ...matches });

  return {
    adminUser,
    isAuthorized: canAccessAdmin(adminUser),
    supabase,
    user,
  };
});
```

- [ ] **Step 6: Run verification**

Run:

```powershell
npm.cmd run typecheck
node --test tests/admin-auth.test.ts
```

Expected: typecheck PASS and auth tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- lib/env.ts lib/supabase/server.ts lib/supabase/browser.ts server/auth/admin.ts server/repositories/admin-users.ts
git commit -m "feat: add supabase admin auth helpers"
```

### Task 5: House Listing Data Rules

**Files:**
- Create: `server/services/houses.ts`
- Create: `server/repositories/listings.ts`
- Create: `tests/house-listing.test.ts`

- [ ] **Step 1: Write failing house-listing tests**

Create `tests/house-listing.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOUSE_PAGE_SIZE,
  getPageRange,
  normalizeHouseSearch,
  sortActiveFirst,
} from "../server/services/houses";

describe("house listing rules", () => {
  it("uses 8 records per page", () => {
    assert.equal(HOUSE_PAGE_SIZE, 8);
    assert.deepEqual(getPageRange(1), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(3), { from: 16, to: 23 });
  });

  it("normalizes invalid pages to page 1", () => {
    assert.deepEqual(getPageRange(0), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(Number.NaN), { from: 0, to: 7 });
  });

  it("trims search text", () => {
    assert.equal(normalizeHouseSearch("  pool villa  "), "pool villa");
    assert.equal(normalizeHouseSearch("   "), "");
  });

  it("sorts active houses first without losing inactive houses", () => {
    const houses = [
      { is_active: false, property_id: "B" },
      { is_active: true, property_id: "A" },
      { is_active: false, property_id: "C" },
    ];

    assert.deepEqual(sortActiveFirst(houses).map((house) => house.property_id), [
      "A",
      "B",
      "C",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/house-listing.test.ts
```

Expected: FAIL because `server/services/houses.ts` does not exist.

- [ ] **Step 3: Implement house service helpers**

Create `server/services/houses.ts`:

```ts
export const HOUSE_PAGE_SIZE = 8;

export interface HouseListItem {
  bathrooms: number | null;
  bedrooms: number | null;
  is_active: boolean | null;
  location_zone: string | null;
  property_id: string;
  title: string | null;
}

export function normalizeHouseSearch(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export function normalizePage(value: string | string[] | number | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function getPageRange(pageInput: string | string[] | number | undefined) {
  const page = normalizePage(pageInput);
  const from = (page - 1) * HOUSE_PAGE_SIZE;
  return { from, to: from + HOUSE_PAGE_SIZE - 1 };
}

export function sortActiveFirst<T extends { is_active: boolean | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.is_active === true) - Number(a.is_active === true));
}
```

- [ ] **Step 4: Implement listings repository**

Create `server/repositories/listings.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPageRange, normalizeHouseSearch } from "../services/houses";

export async function getPaginatedListings(
  supabase: SupabaseClient,
  {
    page,
    search,
  }: {
    page: number;
    search: string;
  },
) {
  const { from, to } = getPageRange(page);
  const normalizedSearch = normalizeHouseSearch(search);
  let query = supabase
    .from("listings")
    .select("property_id,title,bedrooms,bathrooms,location_zone,is_active", {
      count: "exact",
    })
    .order("is_active", { ascending: false })
    .order("property_id", { ascending: true })
    .range(from, to);

  if (normalizedSearch) {
    const escaped = normalizedSearch.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(
      `title.ilike.%${escaped}%,property_id.ilike.%${escaped}%,location_zone.ilike.%${escaped}%`,
    );
  }

  const { count, data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { count: count ?? 0, houses: data ?? [] };
}

export async function getListingByPropertyId(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("property_id,title,bedrooms,bathrooms,location_zone,is_active")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests/house-listing.test.ts
npm.cmd run typecheck
```

Expected: tests PASS and typecheck PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- server/services/houses.ts server/repositories/listings.ts tests/house-listing.test.ts
git commit -m "feat: add paginated house listing rules"
```

### Task 6: House Image Data Rules

**Files:**
- Create: `server/services/images.ts`
- Create: `server/repositories/images.ts`
- Create: `tests/house-images.test.ts`

- [ ] **Step 1: Write failing image grouping tests**

Create `tests/house-images.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupImagesByZone } from "../server/services/images";

describe("house image grouping", () => {
  it("groups by image_zone and sorts folders by lowest global image_move", () => {
    const groups = groupImagesByZone([
      { id: 1, image_move: 4, image_name: "b.webp", image_zone: "bedroom" },
      { id: 2, image_move: 1, image_name: "c.webp", image_zone: "cover" },
      { id: 3, image_move: 2, image_name: "l.webp", image_zone: "living_room" },
      { id: 4, image_move: 3, image_name: "l2.webp", image_zone: "living_room" },
    ]);

    assert.deepEqual(groups.map((group) => group.zone), ["cover", "living_room", "bedroom"]);
    assert.deepEqual(groups[1].images.map((image) => image.image_move), [2, 3]);
  });

  it("uses Thai unassigned label for empty zones", () => {
    const groups = groupImagesByZone([
      { id: 1, image_move: 9, image_name: "x.webp", image_zone: "" },
    ]);

    assert.equal(groups[0].zone, "ไม่ระบุหมวด");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/house-images.test.ts
```

Expected: FAIL because `server/services/images.ts` does not exist.

- [ ] **Step 3: Implement image grouping**

Create `server/services/images.ts`:

```ts
export const UNASSIGNED_IMAGE_ZONE = "ไม่ระบุหมวด";

export interface HouseImageItem {
  created_at?: string | null;
  id: number;
  image_move: number | null;
  image_name: string | null;
  image_zone: string | null;
  updated_at?: string | null;
}

export interface ImageZoneGroup {
  images: HouseImageItem[];
  maxMove: number;
  minMove: number;
  zone: string;
}

function moveValue(image: HouseImageItem): number {
  return Number.isFinite(image.image_move) ? Number(image.image_move) : Number.MAX_SAFE_INTEGER;
}

export function groupImagesByZone(images: HouseImageItem[]): ImageZoneGroup[] {
  const groups = new Map<string, HouseImageItem[]>();

  for (const image of images) {
    const zone = image.image_zone?.trim() || UNASSIGNED_IMAGE_ZONE;
    groups.set(zone, [...(groups.get(zone) ?? []), image]);
  }

  return [...groups.entries()]
    .map(([zone, zoneImages]) => {
      const sortedImages = [...zoneImages].sort((a, b) => moveValue(a) - moveValue(b));
      const moves = sortedImages.map(moveValue);
      return {
        images: sortedImages,
        maxMove: Math.max(...moves),
        minMove: Math.min(...moves),
        zone,
      };
    })
    .sort((a, b) => a.minMove - b.minMove);
}
```

- [ ] **Step 4: Implement image repository**

Create `server/repositories/images.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getImagesByPropertyId(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("images")
    .select("id,property_id,image_name,image_zone,image_move,created_at,updated_at")
    .eq("property_id", propertyId)
    .order("image_move", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests/house-images.test.ts
npm.cmd run typecheck
```

Expected: tests PASS and typecheck PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- server/services/images.ts server/repositories/images.ts tests/house-images.test.ts
git commit -m "feat: group house images by zone"
```

### Task 7: Login Page

**Files:**
- Create: `app/login/actions.ts`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create login actions**

Create `app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  redirect("/admin/houses");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Create login page**

Create `app/login/page.tsx`:

```tsx
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        action={signIn}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">VillaAdmin</p>
            <CardTitle>เข้าสู่ระบบผู้ดูแล</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>อีเมลหรือรหัสผ่านไม่ถูกต้อง</AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </FieldGroup>

            <Button type="submit">เข้าสู่ระบบ</Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add -- app/login/actions.ts app/login/page.tsx
git commit -m "feat: add admin login"
```

### Task 8: Admin Shell And Routing

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `components/layout/admin-shell.tsx`
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Update root metadata**

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VillaAdmin",
  description: "Admin-only pool villa image management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-950">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Redirect home to admin houses**

Modify `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin/houses");
}
```

- [ ] **Step 3: Create admin shell**

Create `components/layout/admin-shell.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../../app/login/actions";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">VillaAdmin</p>
            <p className="text-xs text-muted-foreground">จัดการรูปบ้านพัก</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline">เมนู</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle>VillaAdmin</SheetTitle>
              <nav className="mt-4 flex flex-col gap-2">
                <Button asChild variant="secondary">
                  <Link href="/admin/houses">บ้านพัก</Link>
                </Button>
              </nav>
              <Separator className="my-4" />
              <form action={signOut}>
                <Button className="w-full" type="submit" variant="outline">
                  ออกจากระบบ
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r bg-background p-4 md:block">
          <p className="mb-6 text-sm font-semibold">VillaAdmin</p>
          <nav className="flex flex-col gap-1">
            <Button asChild className="justify-start" variant="secondary">
              <Link href="/admin/houses">บ้านพัก</Link>
            </Button>
          </nav>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="outline">ออกจากระบบ</Button>
          </form>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Protect admin layout**

Create `app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";

import { requireAdmin } from "../../server/auth/admin";
import { AdminShell } from "../../components/layout/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthorized } = await requireAdmin();

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm rounded-lg border bg-card p-5 text-center">
          <h1 className="text-lg font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm text-muted-foreground">MVP นี้เปิดให้ Administrator เท่านั้น</p>
        </div>
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- app/layout.tsx app/page.tsx app/admin/layout.tsx components/layout/admin-shell.tsx
git commit -m "feat: add protected admin shell"
```

### Task 9: Houses Page UI

**Files:**
- Create: `components/admin/houses/pagination.tsx`
- Create: `components/admin/houses/house-list.tsx`
- Create: `app/admin/houses/page.tsx`
- Create: `app/admin/houses/loading.tsx`

- [ ] **Step 1: Create pagination component**

Create `components/admin/houses/pagination.tsx`:

```tsx
import Link from "next/link";

import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "../../ui/pagination";

export function Pagination({
  currentPage,
  search,
  totalPages,
}: {
  currentPage: number;
  search: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <ShadcnPagination className="mt-4">
      <PaginationContent className="flex-wrap">
        {pages.map((page) => {
          const params = new URLSearchParams();
          params.set("page", String(page));
          if (search) params.set("q", search);

          return (
            <PaginationItem key={page}>
              <PaginationLink asChild isActive={page === currentPage}>
                <Link href={`/admin/houses?${params.toString()}`}>{page}</Link>
              </PaginationLink>
            </PaginationItem>
          );
        })}
      </PaginationContent>
    </ShadcnPagination>
  );
}
```

- [ ] **Step 2: Create house list component**

Create `components/admin/houses/house-list.tsx`:

```tsx
import Link from "next/link";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import type { HouseListItem } from "../../../server/services/houses";

function StatusBadge({ active }: { active: boolean | null }) {
  return (
    <Badge variant={active ? "default" : "secondary"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function HouseList({ houses }: { houses: HouseListItem[] }) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {houses.map((house) => (
          <Card
            className={house.is_active ? "" : "opacity-70"}
            key={house.property_id}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{house.title || "-"}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{house.property_id}</p>
              </div>
              <StatusBadge active={house.is_active} />
            </CardHeader>
            <CardContent>
            <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div><dt>ห้องนอน</dt><dd className="font-medium">{house.bedrooms ?? "-"}</dd></div>
              <div><dt>ห้องน้ำ</dt><dd className="font-medium">{house.bathrooms ?? "-"}</dd></div>
              <div><dt>โซน</dt><dd className="font-medium">{house.location_zone || "-"}</dd></div>
            </dl>
            <Button asChild className="mt-4 w-full">
              <Link href={`/admin/houses/${encodeURIComponent(house.property_id)}/images`}>
                จัดการรูป
              </Link>
            </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>บ้านพัก</TableHead>
              <TableHead>property_id</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {houses.map((house) => (
              <TableRow className={house.is_active ? "" : "opacity-70"} key={house.property_id}>
                <TableCell className="font-medium">{house.title || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{house.property_id}</TableCell>
                <TableCell className="text-muted-foreground">
                  {house.bedrooms ?? "-"} ห้องนอน / {house.bathrooms ?? "-"} ห้องน้ำ / {house.location_zone || "-"}
                </TableCell>
                <TableCell><StatusBadge active={house.is_active} /></TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/houses/${encodeURIComponent(house.property_id)}/images`}>
                      จัดการรูป
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Create houses page**

Create `app/admin/houses/page.tsx`:

```tsx
import { getPaginatedListings } from "../../../server/repositories/listings";
import {
  HOUSE_PAGE_SIZE,
  normalizeHouseSearch,
  normalizePage,
} from "../../../server/services/houses";
import { requireAdmin } from "../../../server/auth/admin";
import { HouseList } from "../../../components/admin/houses/house-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

export default async function HousesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const search = normalizeHouseSearch(params.q);
  const { supabase } = await requireAdmin();
  const { count, houses } = await getPaginatedListings(supabase, { page, search });
  const totalPages = Math.max(1, Math.ceil(count / HOUSE_PAGE_SIZE));

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-medium text-muted-foreground">Image management</p>
        <h1 className="text-xl font-semibold">บ้านพัก</h1>
      </div>

      <form className="mb-4">
        <Input
          className="md:max-w-sm"
          defaultValue={search}
          name="q"
          placeholder="ค้นหาบ้านพัก..."
          type="search"
        />
      </form>

      {houses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {search ? "ไม่พบบ้านพักที่ค้นหา" : "ยังไม่มีข้อมูลบ้านพัก"}
          </CardContent>
        </Card>
      ) : (
        <>
          <HouseList houses={houses} />
          <Pagination currentPage={page} search={search} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add loading state**

Create `app/admin/houses/loading.tsx`:

```tsx
import { Skeleton } from "../../../components/ui/skeleton";

export default function HousesLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-10 w-full max-w-sm" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton className="h-24 rounded-lg" key={index} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- app/admin/houses/page.tsx app/admin/houses/loading.tsx components/admin/houses/house-list.tsx components/admin/houses/pagination.tsx
git commit -m "feat: add paginated admin houses page"
```

### Task 10: House Images Page UI

**Files:**
- Create: `components/admin/images/image-zone-viewer.tsx`
- Create: `app/admin/houses/[propertyId]/images/page.tsx`
- Create: `app/admin/houses/[propertyId]/images/loading.tsx`

- [ ] **Step 1: Create image zone viewer**

Create `components/admin/images/image-zone-viewer.tsx`:

```tsx
import Image from "next/image";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import type { ImageZoneGroup } from "../../../server/services/images";
import { AspectRatio } from "../../ui/aspect-ratio";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

export function ImageZoneViewer({ groups }: { groups: ImageZoneGroup[] }) {
  const selected = groups[0];

  if (!selected) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          บ้านนี้ยังไม่มีรูป
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">หมวดรูป</CardTitle>
        </CardHeader>
        <CardContent>
        <ScrollArea>
        <div className="flex gap-2 lg:flex-col">
          {groups.map((group) => (
            <a
              className="block shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted lg:w-full"
              href={`#zone-${encodeURIComponent(group.zone)}`}
              key={group.zone}
            >
              <span className="block font-medium">{group.zone}</span>
              <span className="text-xs text-muted-foreground">
                {group.images.length} รูป / #{group.minMove}-{group.maxMove}
              </span>
            </a>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
        </ScrollArea>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        {groups.map((group) => (
          <div id={`zone-${group.zone}`} key={group.zone}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{group.zone}</h2>
              <Badge variant="secondary">{group.images.length} รูป</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.images.map((image) => {
                const imageName = image.image_name;
                const src = imageName ? buildAwsImageUrl(imageName) : null;

                return (
                  <Card key={image.id}>
                    <CardContent className="p-3">
                    <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-md bg-muted">
                      {src ? (
                        <Image
                          alt={imageName ?? "house image"}
                          className="object-cover"
                          fill
                          sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 100vw"
                          src={src}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          แสดงรูปไม่ได้
                        </div>
                      )}
                    </AspectRatio>
                    <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                      <p className="font-mono text-foreground">{imageName ?? "-"}</p>
                      <p>image_move: {image.image_move ?? "-"}</p>
                      <p>created_at: {image.created_at ?? "-"}</p>
                      <p>updated_at: {image.updated_at ?? "-"}</p>
                    </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create image page**

Create `app/admin/houses/[propertyId]/images/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageZoneViewer } from "../../../../../components/admin/images/image-zone-viewer";
import { Badge } from "../../../../../components/ui/badge";
import { requireAdmin } from "../../../../../server/auth/admin";
import { getImagesByPropertyId } from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import { groupImagesByZone } from "../../../../../server/services/images";

export default async function HouseImagesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { supabase } = await requireAdmin();
  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const images = await getImagesByPropertyId(supabase, propertyId);
  const groups = groupImagesByZone(images);

  return (
    <div>
      <Link className="text-sm text-zinc-600 hover:text-zinc-950" href="/admin/houses">
        ← กลับไปบ้านพัก
      </Link>

      <div className="mb-4 mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{house.property_id}</p>
          <h1 className="text-xl font-semibold">{house.title || "ไม่พบชื่อบ้านพัก"}</h1>
        </div>
        <Badge className="w-fit" variant="secondary">ดูอย่างเดียว</Badge>
      </div>

      <ImageZoneViewer groups={groups} />
    </div>
  );
}
```

- [ ] **Step 3: Add loading state**

Create `app/admin/houses/[propertyId]/images/loading.tsx`:

```tsx
import { Skeleton } from "../../../../../components/ui/skeleton";

export default function ImagesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-48 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-64 rounded-lg" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- app/admin/houses/[propertyId]/images/page.tsx app/admin/houses/[propertyId]/images/loading.tsx components/admin/images/image-zone-viewer.tsx
git commit -m "feat: add read-only house images page"
```

### Task 11: Final Verification And Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update README scripts and MVP status**

Add or update these README sections:

```md
## Current focus

MVP 1: read-only admin image management.

Access is limited to Administrator users (`public.users.role_id = 1`).

## Scripts

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
```

- [ ] **Step 2: Update architecture with implemented flow**

Add to `docs/architecture.md`:

```md
## MVP 1 Admin Image Flow

Supabase Auth session is checked server-side in admin routes.
The app looks up `public.users` by `uid = auth.user.id`, then falls back to `email = auth.user.email` while legacy rows are backfilled.
Only `role_id = 1` can access MVP 1 admin image management.
Listings and images are read through server repositories; client components do not access Supabase directly.
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all PASS.

- [ ] **Step 4: Supabase read-only smoke test**

Run:

```powershell
node --use-system-ca --eval "const { loadEnvConfig } = require('@next/env'); loadEnvConfig(process.cwd()); (async()=>{ const { createClient } = await import('@supabase/supabase-js'); const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}); const { count: listingCount, error: listingError } = await supabase.from('listings').select('property_id',{count:'exact',head:true}); const { count: imageCount, error: imageError } = await supabase.from('images').select('id',{count:'exact',head:true}); if (listingError || imageError) throw new Error((listingError||imageError).message); console.log(JSON.stringify({listingCount,imageCount},null,2)); })().catch(err=>{console.error(err); process.exit(1);});"
```

Expected: prints counts without secret values.

- [ ] **Step 5: Commit final docs**

```powershell
git add -- README.md docs/architecture.md
git commit -m "docs: document mvp 1 admin image flow"
```

## Self-Review

- Spec coverage: covers Supabase Auth, Administrator-only access, uid/email lookup, pagination size 8, active-first sorting, search, image URL validation, read-only house list, read-only image page, mobile-first layouts, and future MVP boundaries.
- Placeholder scan: no TBD/TODO/fill-in-later instructions.
- Type consistency: `propertyId`, `role_id`, `image_move`, `image_zone`, `uid`, and `email` names match the spec and Supabase columns found during read-only inspection.
