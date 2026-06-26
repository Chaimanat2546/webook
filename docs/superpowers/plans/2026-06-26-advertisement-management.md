# Advertisement Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-only advertisement management with Supabase metadata, active-only public reads, and Cloudflare R2 image files served by a shared `webook-media` Worker.

**Architecture:** Keep Supabase access server-side through repositories/services. Store only `image_name` keys in Supabase; upload/delete files through a server-only Worker adapter. Use native file inputs and existing shadcn components; no new UI dependency is required for MVP.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, PostgreSQL RLS, Cloudflare Workers, R2, Tailwind, shadcn/ui, Node test runner.

---

## Source Of Truth

- Product docs: `docs/advertisement-management.md`
- MVP docs: `docs/advertisement-management/mvp-1-advertisement-image-management.md`
- Agent design: `docs/superpowers/specs/2026-06-26-advertisement-management-design.md`

## Preflight Decisions

- Use `webook-media` for both R2 bucket and Worker name.
- Use advertisement keys under `advertisements/`.
- Use `*.workers.dev` first.
- Default max upload size: 10 MB per image. Change this before implementation if the product requirement needs another limit.
- Do not install dependencies without user approval. If Wrangler is not available, ask before adding:

```bash
npm install -D wrangler @cloudflare/workers-types
```

## File Map

- Create: `supabase/migrations/<generated>_advertisement_management.sql`
  Database schema, indexes, grants, and RLS policies.
- Create: `lib/advertisement-image-url.ts`
  Validate advertisement image keys and build display URLs.
- Create: `tests/advertisement-image-url.test.ts`
  Regression tests for R2 key validation and URL building.
- Create: `server/services/advertisements.ts`
  Pure rules: title validation, image count validation, order normalization, key generation.
- Create: `tests/advertisements.test.ts`
  Pure tests for advertisement rules.
- Create: `server/repositories/advertisements.ts`
  Supabase reads and writes for advertisements and images.
- Create: `server/storage/advertisement-images.ts`
  Server-only Worker upload/delete adapter.
- Create: `tests/advertisement-storage.test.ts`
  Adapter tests with fake `fetch`.
- Create: `app/admin/advertisements/page.tsx`
  Server-rendered list page.
- Create: `app/admin/advertisements/new/page.tsx`
  New advertisement page.
- Create: `app/admin/advertisements/[id]/page.tsx`
  Detail/edit page.
- Create: `app/admin/advertisements/actions.ts`
  Server actions for create, update, and delete image.
- Create: `components/admin/advertisements/advertisement-list.tsx`
  Mobile-first list/table UI.
- Create: `components/admin/advertisements/advertisement-form.tsx`
  Client draft-file form for create/edit.
- Create: `components/admin/advertisements/advertisement-image-preview-dialog.tsx`
  Preview dialog with button trigger.
- Create: `components/admin/advertisements/delete-advertisement-image-button.tsx`
  Confirm dialog for immediate image delete.
- Create: `workers/media/src/index.ts`
  Worker for public GET and secret-protected PUT/DELETE.
- Create: `workers/media/wrangler.jsonc`
  Worker config with R2 binding.
- Modify: `components/layout/admin-desktop-sidebar.tsx`
  Add advertisement nav item.
- Modify: `lib/env.ts`
  Add server env helper for advertisement image Worker config.
- Modify: `README.md`
  Document env vars and Worker/R2 setup.
- Modify: `docs/architecture.md`
  Add advertisement media flow.
- Modify: `.env.example`
  Add required env vars. Create it if missing.

---

## Task 1: Supabase Schema And RLS

**Files:**
- Create: `supabase/migrations/<generated>_advertisement_management.sql`
- Test: `tests/advertisement-migration.test.ts`

- [ ] **Step 1: Create the migration file with Supabase CLI**

Run:

```bash
supabase migration new advertisement_management
```

Expected: Supabase prints a generated SQL path like `supabase/migrations/<timestamp>_advertisement_management.sql`. Use that generated file. Do not hand-invent the timestamp.

- [ ] **Step 2: Write the migration SQL**

Add this SQL to the generated migration:

```sql
create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advertisement_images (
  id uuid primary key default gen_random_uuid(),
  advertisement_id uuid not null references public.advertisements(id) on delete cascade,
  image_name text not null,
  image_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisement_images_order_unique unique (advertisement_id, image_order),
  constraint advertisement_images_order_range check (image_order between 1 and 2)
);

create index advertisement_images_advertisement_id_idx
  on public.advertisement_images (advertisement_id);

create index advertisements_active_updated_idx
  on public.advertisements (is_active desc, updated_at desc);

alter table public.advertisements enable row level security;
alter table public.advertisement_images enable row level security;

grant select on public.advertisements to anon, authenticated;
grant select on public.advertisement_images to anon, authenticated;
grant insert, update, delete on public.advertisements to authenticated;
grant insert, update, delete on public.advertisement_images to authenticated;

create policy "Public can read active advertisements"
  on public.advertisements
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can read active advertisement images"
  on public.advertisement_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.advertisements
      where advertisements.id = advertisement_images.advertisement_id
        and advertisements.is_active = true
    )
  );

create policy "Administrators can manage advertisements"
  on public.advertisements
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.users
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );

create policy "Administrators can manage advertisement images"
  on public.advertisement_images
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.users
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );
```

- [ ] **Step 3: Add a migration text regression test**

Create `tests/advertisement-migration.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function advertisementMigrationSql() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((name) => name.endsWith("_advertisement_management.sql"));
  assert.ok(file, "advertisement migration exists");
  return readFileSync(join(dir, file), "utf8");
}

describe("advertisement migration", () => {
  it("creates the required tables and RLS policies", () => {
    const sql = advertisementMigrationSql();

    assert.match(sql, /create table public\.advertisements/);
    assert.match(sql, /create table public\.advertisement_images/);
    assert.match(sql, /advertisement_images_order_range check \(image_order between 1 and 2\)/);
    assert.match(sql, /alter table public\.advertisements enable row level security/);
    assert.match(sql, /Public can read active advertisements/);
    assert.match(sql, /Public can read active advertisement images/);
    assert.match(sql, /Administrators can manage advertisements/);
  });
});
```

- [ ] **Step 4: Run the migration test**

Run:

```bash
npm run test -- tests/advertisement-migration.test.ts
```

Expected: PASS.

---

## Task 2: Advertisement Image URL Helper

**Files:**
- Create: `lib/advertisement-image-url.ts`
- Create: `tests/advertisement-image-url.test.ts`
- Modify: `lib/env.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/advertisement-image-url.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdvertisementImageUrl,
  validateAdvertisementImageName,
} from "../lib/advertisement-image-url.ts";

describe("advertisement image URLs", () => {
  it("builds Worker URLs from safe advertisement image names", () => {
    assert.equal(
      buildAdvertisementImageUrl(
        "advertisements/3f6b9f41-9999-4bbb-8888-5812de2db111/1.webp",
        "https://webook-media.example.workers.dev",
      ),
      "https://webook-media.example.workers.dev/advertisements/3f6b9f41-9999-4bbb-8888-5812de2db111/1.webp",
    );
  });

  it("rejects unsafe image names", () => {
    assert.throws(() => validateAdvertisementImageName("../secret.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("houses/1.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("https://x.test/1.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("advertisements/id/1.svg"), /Invalid image extension/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/advertisement-image-url.test.ts
```

Expected: FAIL because `lib/advertisement-image-url.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/advertisement-image-url.ts`:

```ts
const ADVERTISEMENT_IMAGE_PREFIX = "advertisements/";
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function decodeImageName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid image name");
  }
}

export function validateAdvertisementImageName(value: string): string {
  const trimmed = value.trim();
  const decoded = decodeImageName(trimmed).replace(/\\/g, "/");
  const segments = decoded.split("/");

  if (
    !trimmed ||
    trimmed.startsWith("//") ||
    decoded.includes("://") ||
    !decoded.startsWith(ADVERTISEMENT_IMAGE_PREFIX) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid image name");
  }

  if (!ALLOWED_EXTENSIONS.some((extension) => decoded.toLowerCase().endsWith(extension))) {
    throw new Error("Invalid image extension");
  }

  return decoded;
}

export function encodeImagePath(imageName: string): string {
  return validateAdvertisementImageName(imageName)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildAdvertisementImageUrl(imageName: string, baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing advertisement image base URL");

  return `${base}/${encodeImagePath(imageName)}`;
}
```

- [ ] **Step 4: Add server env helper**

Modify `lib/env.ts`:

```ts
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { anonKey, url };
}

export function getAdvertisementImageEnv() {
  const workerSecret = process.env.ADVERTISEMENT_IMAGE_WORKER_SECRET;
  const workerUrl = process.env.ADVERTISEMENT_IMAGE_WORKER_URL;

  if (!workerSecret || !workerUrl) {
    throw new Error("Missing advertisement image environment variables");
  }

  return { workerSecret, workerUrl };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/advertisement-image-url.test.ts
```

Expected: PASS.

---

## Task 3: Advertisement Domain Rules

**Files:**
- Create: `server/services/advertisements.ts`
- Create: `tests/advertisements.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/advertisements.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdvertisementImageName,
  normalizeAdvertisementImages,
  validateAdvertisementImageCount,
  validateAdvertisementTitle,
} from "../server/services/advertisements.ts";

describe("advertisement rules", () => {
  it("validates title and image count", () => {
    assert.equal(validateAdvertisementTitle("  Summer Promo  "), "Summer Promo");
    assert.throws(() => validateAdvertisementTitle(" "), /Advertisement title is required/);
    assert.throws(() => validateAdvertisementImageCount(0), /at least 1 image/);
    assert.throws(() => validateAdvertisementImageCount(3), /at most 2 images/);
  });

  it("normalizes image order to 1 and 2", () => {
    assert.deepEqual(
      normalizeAdvertisementImages([
        { id: "b", image_name: "advertisements/ad/2.webp", image_order: 9 },
        { id: "a", image_name: "advertisements/ad/1.webp", image_order: 3 },
      ]),
      [
        { id: "a", image_name: "advertisements/ad/1.webp", image_order: 1 },
        { id: "b", image_name: "advertisements/ad/2.webp", image_order: 2 },
      ],
    );
  });

  it("builds deterministic R2 image names", () => {
    assert.equal(
      buildAdvertisementImageName("ad-1", 2, "image/jpeg"),
      "advertisements/ad-1/2.jpg",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/advertisements.test.ts
```

Expected: FAIL because `server/services/advertisements.ts` does not exist.

- [ ] **Step 3: Implement domain rules**

Create `server/services/advertisements.ts`:

```ts
export const ADVERTISEMENT_MIN_IMAGES = 1;
export const ADVERTISEMENT_MAX_IMAGES = 2;

export interface AdvertisementImageItem {
  id: string;
  image_name: string;
  image_order: number;
}

const extensionByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAdvertisementTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error("Advertisement title is required");
  return title;
}

export function validateAdvertisementImageCount(count: number): number {
  if (count < ADVERTISEMENT_MIN_IMAGES) {
    throw new Error("Advertisement requires at least 1 image");
  }
  if (count > ADVERTISEMENT_MAX_IMAGES) {
    throw new Error("Advertisement supports at most 2 images");
  }
  return count;
}

export function buildAdvertisementImageName(
  advertisementId: string,
  imageOrder: number,
  mimeType: string,
): string {
  const extension = extensionByMimeType[mimeType];
  if (!extension) throw new Error("Unsupported image type");
  if (!Number.isInteger(imageOrder) || imageOrder < 1 || imageOrder > ADVERTISEMENT_MAX_IMAGES) {
    throw new Error("Invalid image order");
  }
  return `advertisements/${advertisementId}/${imageOrder}.${extension}`;
}

export function normalizeAdvertisementImages<T extends AdvertisementImageItem>(images: T[]): T[] {
  validateAdvertisementImageCount(images.length);
  return [...images]
    .sort((a, b) => a.image_order - b.image_order || a.id.localeCompare(b.id))
    .map((image, index) => ({ ...image, image_order: index + 1 }));
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/advertisements.test.ts
```

Expected: PASS.

---

## Task 4: Cloudflare Worker And R2

**Files:**
- Create: `workers/media/src/index.ts`
- Create: `workers/media/wrangler.jsonc`

- [ ] **Step 1: Confirm Wrangler setup**

Run:

```bash
npx wrangler --version
```

Expected: Wrangler prints a version. If this fails because Wrangler is not available, ask the user before installing dev dependencies.

- [ ] **Step 2: Add Worker config**

Create `workers/media/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "webook-media",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-26",
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "webook-media"
    }
  ]
}
```

- [ ] **Step 3: Add Worker implementation**

Create `workers/media/src/index.ts`:

```ts
interface Env {
  ADVERTISEMENT_IMAGE_WORKER_SECRET: string;
  MEDIA_BUCKET: R2Bucket;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function keyFromRequest(request: Request): string {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, "")).replace(/\\/g, "/");
  const parts = key.split("/");

  if (
    !key.startsWith("advertisements/") ||
    key.includes("://") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid image name");
  }

  return key;
}

function requireBearer(request: Request, secret: string): Response | null {
  return request.headers.get("authorization") === `Bearer ${secret}`
    ? null
    : new Response("Unauthorized", { status: 401 });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    let key: string;
    try {
      key = keyFromRequest(request);
    } catch {
      return new Response("Invalid image name", { status: 400, headers: corsHeaders() });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404, headers: corsHeaders() });

      const headers = new Headers(corsHeaders());
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");

      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    const authError = requireBearer(request, env.ADVERTISEMENT_IMAGE_WORKER_SECRET);
    if (authError) return authError;

    if (request.method === "PUT") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return new Response("Unsupported media type", { status: 415, headers: corsHeaders() });
      }

      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return new Response("Image too large", { status: 413, headers: corsHeaders() });
      }

      const object = await env.MEDIA_BUCKET.put(key, bytes, {
        httpMetadata: { contentType },
      });

      return Response.json({ key: object?.key ?? key }, { headers: corsHeaders() });
    }

    if (request.method === "DELETE") {
      await env.MEDIA_BUCKET.delete(key);
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  },
};
```

- [ ] **Step 4: Create bucket and secret**

Run after user confirms Cloudflare account/subdomain:

```bash
npx wrangler r2 bucket create webook-media
npx wrangler secret put ADVERTISEMENT_IMAGE_WORKER_SECRET --config workers/media/wrangler.jsonc
```

Expected: bucket exists and secret is saved.

- [ ] **Step 5: Deploy Worker**

Run:

```bash
npx wrangler deploy --config workers/media/wrangler.jsonc
```

Expected: Worker deploys and prints a `*.workers.dev` URL.

---

## Task 5: Server Storage Adapter

**Files:**
- Create: `server/storage/advertisement-images.ts`
- Create: `tests/advertisement-storage.test.ts`

- [ ] **Step 1: Write adapter tests**

Create `tests/advertisement-storage.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteAdvertisementImageObject,
  uploadAdvertisementImageObject,
} from "../server/storage/advertisement-images.ts";

describe("advertisement image storage adapter", () => {
  it("uploads with bearer auth", async () => {
    const calls: Array<{ headers: Record<string, string>; method: string; url: string }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        headers: init?.headers as Record<string, string>,
        method: init?.method ?? "GET",
        url: String(url),
      });
      return new Response("{}", { status: 200 });
    };

    await uploadAdvertisementImageObject({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      fetchImpl,
      imageName: "advertisements/ad-1/1.webp",
      workerSecret: "secret",
      workerUrl: "https://webook-media.example.workers.dev",
    });

    assert.equal(calls[0]?.method, "PUT");
    assert.equal(calls[0]?.headers.authorization, "Bearer secret");
  });

  it("throws when delete fails", async () => {
    await assert.rejects(
      () =>
        deleteAdvertisementImageObject({
          fetchImpl: async () => new Response("boom", { status: 500 }),
          imageName: "advertisements/ad-1/1.webp",
          workerSecret: "secret",
          workerUrl: "https://webook-media.example.workers.dev",
        }),
      /Failed to delete advertisement image/,
    );
  });
});
```

- [ ] **Step 2: Implement adapter**

Create `server/storage/advertisement-images.ts`:

```ts
import { buildAdvertisementImageUrl } from "../../lib/advertisement-image-url";

interface WorkerConfig {
  fetchImpl?: typeof fetch;
  imageName: string;
  workerSecret: string;
  workerUrl: string;
}

export async function uploadAdvertisementImageObject({
  body,
  contentType,
  fetchImpl = fetch,
  imageName,
  workerSecret,
  workerUrl,
}: WorkerConfig & {
  body: BodyInit;
  contentType: string;
}) {
  const response = await fetchImpl(buildAdvertisementImageUrl(imageName, workerUrl), {
    body,
    headers: {
      authorization: `Bearer ${workerSecret}`,
      "content-type": contentType,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("Failed to upload advertisement image");
  }
}

export async function deleteAdvertisementImageObject({
  fetchImpl = fetch,
  imageName,
  workerSecret,
  workerUrl,
}: WorkerConfig) {
  const response = await fetchImpl(buildAdvertisementImageUrl(imageName, workerUrl), {
    headers: {
      authorization: `Bearer ${workerSecret}`,
    },
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete advertisement image");
  }
}
```

- [ ] **Step 3: Run adapter tests**

Run:

```bash
npm run test -- tests/advertisement-storage.test.ts
```

Expected: PASS.

---

## Task 6: Repositories And Server Actions

**Files:**
- Create: `server/repositories/advertisements.ts`
- Create: `app/admin/advertisements/actions.ts`
- Test: `tests/advertisements.test.ts`

- [ ] **Step 1: Add repository functions**

Create `server/repositories/advertisements.ts` with these exported functions:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdvertisementImageRow {
  id: string;
  advertisement_id: string;
  image_name: string;
  image_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdvertisementRow {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  advertisement_images?: AdvertisementImageRow[];
}

export async function getAdvertisements(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("advertisements")
    .select("id,title,is_active,created_at,updated_at,advertisement_images(id,advertisement_id,image_name,image_order,created_at,updated_at)")
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdvertisementRow[];
}

export async function getAdvertisementById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("advertisements")
    .select("id,title,is_active,created_at,updated_at,advertisement_images(id,advertisement_id,image_name,image_order,created_at,updated_at)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AdvertisementRow | null;
}
```

Add small write helpers in the same file as implementation needs them:

- `insertAdvertisementWithImages`
- `updateAdvertisement`
- `insertAdvertisementImages`
- `deleteAdvertisementImageById`
- `updateAdvertisementImageOrder`

Keep each helper a thin Supabase call and throw `new Error(error.message)` on error, following existing repository style.

- [ ] **Step 2: Add server actions**

Create `app/admin/advertisements/actions.ts`.

The actions must:

- call `requireAdmin()`
- reject when `isAuthorized` is false
- validate title and final image count
- upload new files before inserting image rows
- best-effort delete newly uploaded files when Supabase write fails
- redirect to `/admin/advertisements` or detail after success

Core action names:

```ts
"use server";

export async function createAdvertisementAction(formData: FormData) {}
export async function updateAdvertisementAction(id: string, formData: FormData) {}
export async function deleteAdvertisementImageAction(imageId: string) {}
```

- [ ] **Step 3: Add action-level pure helpers if needed**

If file parsing becomes bulky, create pure helpers in `server/services/advertisements.ts`:

```ts
export function getImageFiles(formData: FormData, fieldName: string): File[] {
  return formData
    .getAll(fieldName)
    .filter((value): value is File => value instanceof File && value.size > 0);
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run typecheck
npm run test -- tests/advertisements.test.ts
```

Expected: PASS.

---

## Task 7: Admin Navigation And List Page

**Files:**
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Create: `app/admin/advertisements/page.tsx`
- Create: `components/admin/advertisements/advertisement-list.tsx`
- Test: `tests/advertisements-ui.test.ts`

- [ ] **Step 1: Add a UI source test**

Create `tests/advertisements-ui.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("advertisement admin UI", () => {
  it("adds the advertisement admin route and sidebar entry", () => {
    assert.ok(existsSync(new URL("../app/admin/advertisements/page.tsx", import.meta.url)));

    const sidebar = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );
    assert.match(sidebar, /\/admin\/advertisements/);
  });

  it("renders list UI with active status and image count", () => {
    const source = readFileSync(
      new URL("../components/admin/advertisements/advertisement-list.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /is_active/);
    assert.match(source, /advertisement_images/);
    assert.match(source, /\/admin\/advertisements\/new/);
  });
});
```

- [ ] **Step 2: Create list component**

Create `components/admin/advertisements/advertisement-list.tsx`.

Use existing patterns from `components/admin/houses/house-list.tsx`:

- mobile cards under `md:hidden`
- desktop `Card` + `Table`
- `Badge` for active/inactive
- `Button asChild` + `Link` for detail and create

- [ ] **Step 3: Create list page**

Create `app/admin/advertisements/page.tsx`.

It must:

- call `requireAdmin()`
- call `getAdvertisements(supabase)`
- render title and create button
- render `AdvertisementList`
- show `Empty` when no ads exist

- [ ] **Step 4: Add sidebar nav**

Modify `components/layout/admin-desktop-sidebar.tsx`:

- import `MegaphoneIcon` from `lucide-react`
- add a second `SidebarMenuItem`
- link to `/admin/advertisements`
- use tooltip text `โฆษณา`

- [ ] **Step 5: Run UI source test**

Run:

```bash
npm run test -- tests/advertisements-ui.test.ts
```

Expected: PASS.

---

## Task 8: New And Detail UI

**Files:**
- Create: `app/admin/advertisements/new/page.tsx`
- Create: `app/admin/advertisements/[id]/page.tsx`
- Create: `components/admin/advertisements/advertisement-form.tsx`
- Create: `components/admin/advertisements/advertisement-image-preview-dialog.tsx`
- Create: `components/admin/advertisements/delete-advertisement-image-button.tsx`

- [ ] **Step 1: Create preview dialog**

Create `components/admin/advertisements/advertisement-image-preview-dialog.tsx`.

Use existing `Dialog` and a normal `<img>` instead of `next/image`; the Worker domain is env-driven and should not require `next.config.ts` changes.

- [ ] **Step 2: Create delete confirm button**

Create `components/admin/advertisements/delete-advertisement-image-button.tsx`.

Use existing `Dialog`, `DialogContent`, `DialogFooter`, and `Button`.
On confirm, submit a form action that calls `deleteAdvertisementImageAction(imageId)`.

- [ ] **Step 3: Create advertisement form**

Create `components/admin/advertisements/advertisement-form.tsx`.

This is a client component. It must:

- keep selected `File[]` in local state
- create preview URLs with `URL.createObjectURL`
- revoke preview URLs on cleanup
- prevent selecting more than 2 total images
- render existing images and draft images
- include hidden/default form fields for title and active state
- submit to `createAdvertisementAction` or `updateAdvertisementAction`

- [ ] **Step 4: Create new page**

Create `app/admin/advertisements/new/page.tsx`.

It must render `AdvertisementForm` in create mode with no existing images.

- [ ] **Step 5: Create detail page**

Create `app/admin/advertisements/[id]/page.tsx`.

It must:

- call `requireAdmin()`
- call `getAdvertisementById(supabase, id)`
- call `notFound()` if no record
- render `AdvertisementForm` in edit mode

- [ ] **Step 6: Run checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

---

## Task 9: Environment And Documentation

**Files:**
- Create or modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/api.md`

- [ ] **Step 1: Add env example**

Ensure `.env.example` contains:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
```

- [ ] **Step 2: Update README**

Add:

- current focus includes advertisement management MVP
- `webook-media` Worker/R2 setup
- `ADVERTISEMENT_IMAGE_WORKER_URL`
- `ADVERTISEMENT_IMAGE_WORKER_SECRET`

- [ ] **Step 3: Update architecture docs**

Add a short section:

```md
## Advertisement Media Flow

Admin pages write advertisement metadata through server actions and Supabase repositories.
Advertisement files are uploaded/deleted through the server-only Worker adapter.
Supabase stores `image_name` keys only.
External systems read active advertisements through Supabase API and build image URLs from `{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_name}`.
```

- [ ] **Step 4: Update API docs**

Add public read shape:

```text
advertisements?select=id,title,advertisement_images(image_name,image_order)&is_active=eq.true
```

---

## Task 10: Final Verification

**Files:**
- All files changed by previous tasks.

- [ ] **Step 1: Run full checks**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all pass.

- [ ] **Step 2: Manual verification**

Verify in browser:

- `/admin/advertisements` loads for Administrator.
- non-admin sees unauthorized state.
- create page requires title and at least one image.
- selected draft image previews before save.
- save uploads image and creates rows.
- detail page shows existing image preview.
- delete image asks for confirmation.
- deleting last image is blocked.
- public Supabase API returns active advertisements only.

- [ ] **Step 3: Commit only if requested**

Do not commit unless the user asks. If requested, use focused commits by task, for example:

```bash
git add -- supabase/migrations tests/advertisement-migration.test.ts
git commit -m "feat: add advertisement tables"
```

---

## Self-Review

- Spec coverage: database, RLS, active-only public reads, R2 Worker, image key validation, admin list/new/detail, draft add, immediate delete, preview, docs, and verification are covered.
- Placeholder scan: no placeholder markers and no unspecified file paths except the Supabase CLI-generated migration timestamp.
- Type consistency: table names are `advertisements` and `advertisement_images`; image key field is `image_name`; order field is `image_order`; env names are `ADVERTISEMENT_IMAGE_WORKER_URL` and `ADVERTISEMENT_IMAGE_WORKER_SECRET`.
