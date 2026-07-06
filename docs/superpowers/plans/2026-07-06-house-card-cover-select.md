# House Card Cover Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only cover selection mode that saves house card display image order in `public.images.cover_select`.

**Architecture:** Keep the existing house image manager as the default route experience and add `mode=cover-select` to render a separate `CoverSelectViewer`. Store the card display order only in `images.cover_select`; keep `image_move` zone-scoped and untouched. Reuse existing repositories, server actions, image card UI, zone helpers, and add dnd-kit only for selected-strip reordering.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind/shadcn UI, Supabase, `@dnd-kit/react`, `@dnd-kit/helpers`, node:test.

---

## File Structure

- Modify: `package.json`
  - Keep the already-installed `@dnd-kit/react` and `@dnd-kit/helpers` dependencies.
- Modify: `package-lock.json`
  - Keep the lockfile updates from installing dnd-kit.
- Modify: `server/services/images.ts`
  - Add `cover_select` to `HouseImageItem`.
  - Add small cover-select constants and helpers.
- Modify: `tests/house-images.test.ts`
  - Add behavior tests for cover-select normalization and id validation.
- Modify: `server/repositories/images.ts`
  - Select `cover_select`.
  - Add the smallest repository helper to reset and set cover selection.
- Modify: `app/admin/houses/[propertyId]/images/actions.ts`
  - Add `saveHouseCoverSelectAction`.
- Modify: `tests/house-image-actions.test.ts`
  - Add source-level coverage for the new action and repository helper.
- Create: `components/admin/images/cover-select-viewer.tsx`
  - New client component for cover selection, zone filtering, selected strip, dnd reorder, save/cancel.
- Modify: `app/admin/houses/[propertyId]/images/page.tsx`
  - Read `mode`, render `CoverSelectViewer` in cover-select mode.
- Modify: `tests/house-images-ui.test.ts`
  - Add source-level UI wiring coverage.
- Modify: `docs/image-management.md`
  - Document `cover_select` behavior.
- Modify: `docs/architecture.md`
  - Document that `cover_select` is independent from `image_move`.

---

### Task 1: Lock In Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Verify dnd-kit dependencies are present**

Run:

```powershell
Select-String -Path package.json -Pattern '"@dnd-kit/react"|"@dnd-kit/helpers"'
Select-String -Path package-lock.json -Pattern '"node_modules/@dnd-kit/react"|"node_modules/@dnd-kit/helpers"'
```

Expected: both commands show entries for `@dnd-kit/react` and `@dnd-kit/helpers`.

- [ ] **Step 2: Run dependency-aware typecheck smoke**

Run:

```powershell
npm run typecheck
```

Expected: TypeScript may still pass or may fail only because implementation is not present yet. If it fails due to dependency resolution, stop and fix installation before continuing.

- [ ] **Step 3: Commit dependency files**

Run:

```powershell
git add -- package.json package-lock.json
git commit -m "chore: add dnd kit dependencies"
```

Expected: commit succeeds and includes only `package.json` and `package-lock.json`.

---

### Task 2: Add Cover-Select Service Helpers

**Files:**
- Modify: `server/services/images.ts`
- Test: `tests/house-images.test.ts`

- [ ] **Step 1: Write failing service tests**

In `tests/house-images.test.ts`, extend the import from `../server/services/images.ts`:

```ts
import {
  HOUSE_COVER_SELECT_MAX,
  HOUSE_COVER_SELECT_MIN,
  UNASSIGNED_IMAGE_ZONE,
  buildHouseImageName,
  formatImageMoveLabel,
  formatThaiImageDateTime,
  getHouseCoverSelectedImages,
  getImageFiles,
  getImageZoneMeta,
  getNextHouseImageMove,
  getSelectedImageZoneGroup,
  groupImagesByZone,
  validateHouseCoverSelectIds,
  validateHouseImageFile,
  validateHouseImageZone,
} from "../server/services/images.ts";
```

Add these tests inside `describe("house image grouping", () => { ... })` after the existing zone label tests:

```ts
  it("normalizes selected card cover images across every image zone", () => {
    const selected = getHouseCoverSelectedImages([
      { id: 1, cover_select: 2, image_move: 9, image_name: "inside.webp", image_zone: "inside" },
      { id: 2, cover_select: 0, image_move: 1, image_name: "cover.webp", image_zone: "cover" },
      { id: 3, cover_select: 1, image_move: 4, image_name: "outside.webp", image_zone: "outside" },
      { id: 4, cover_select: 11, image_move: 2, image_name: "bedroom.webp", image_zone: "bedroom" },
      { id: 1, cover_select: 3, image_move: 9, image_name: "inside-duplicate.webp", image_zone: "inside" },
    ]);

    assert.deepEqual(selected.map((image) => image.id), [3, 1]);
    assert.deepEqual(selected.map((image) => image.image_zone), ["outside", "inside"]);
  });
```

Add this test inside `describe("house image mutation rules", () => { ... })`:

```ts
  it("validates card cover selection ids", () => {
    assert.equal(HOUSE_COVER_SELECT_MIN, 3);
    assert.equal(HOUSE_COVER_SELECT_MAX, 10);
    assert.deepEqual(validateHouseCoverSelectIds([3, 5, 7]), [3, 5, 7]);
    assert.throws(() => validateHouseCoverSelectIds([1, 2]), /Select at least 3 images/);
    assert.throws(
      () => validateHouseCoverSelectIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      /Select at most 10 images/,
    );
    assert.throws(() => validateHouseCoverSelectIds([1, 2, 2]), /Duplicate image id/);
    assert.throws(() => validateHouseCoverSelectIds([1, 2, 0]), /Invalid image id/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/house-images.test.ts
```

Expected: FAIL because `HOUSE_COVER_SELECT_MIN`, `HOUSE_COVER_SELECT_MAX`, `getHouseCoverSelectedImages`, and `validateHouseCoverSelectIds` do not exist.

- [ ] **Step 3: Implement minimal service helpers**

In `server/services/images.ts`, update `HouseImageItem`:

```ts
export interface HouseImageItem {
  cover_select?: number | null;
  created_at?: string | null;
  id: number;
  image_move: number | null;
  image_name: string | null;
  image_url?: string | null;
  image_zone: string | null;
  updated_at?: string | null;
}
```

Add these constants near the image file constants:

```ts
export const HOUSE_COVER_SELECT_MIN = 3;
export const HOUSE_COVER_SELECT_MAX = 10;
```

Add these helpers near `moveValue`:

```ts
function coverSelectValue(image: HouseImageItem): number {
  return typeof image.cover_select === "number" && Number.isFinite(image.cover_select)
    ? image.cover_select
    : 0;
}

function coverSelectSortValue(image: HouseImageItem): number {
  const value = coverSelectValue(image);
  return value >= 1 && value <= HOUSE_COVER_SELECT_MAX ? value : Number.MAX_SAFE_INTEGER;
}
```

Add these exports before `getImageFiles`:

```ts
export function getHouseCoverSelectedImages(images: HouseImageItem[]): HouseImageItem[] {
  const seenIds = new Set<number>();

  return [...images]
    .filter((image) => {
      const value = coverSelectValue(image);
      if (value < 1 || value > HOUSE_COVER_SELECT_MAX) return false;
      if (seenIds.has(image.id)) return false;
      seenIds.add(image.id);
      return true;
    })
    .sort((a, b) => coverSelectSortValue(a) - coverSelectSortValue(b) || a.id - b.id)
    .slice(0, HOUSE_COVER_SELECT_MAX);
}

export function validateHouseCoverSelectIds(imageIds: number[]): number[] {
  if (imageIds.length < HOUSE_COVER_SELECT_MIN) {
    throw new Error(`Select at least ${HOUSE_COVER_SELECT_MIN} images`);
  }

  if (imageIds.length > HOUSE_COVER_SELECT_MAX) {
    throw new Error(`Select at most ${HOUSE_COVER_SELECT_MAX} images`);
  }

  const seenIds = new Set<number>();
  for (const id of imageIds) {
    if (!Number.isInteger(id) || id < 1) throw new Error("Invalid image id");
    if (seenIds.has(id)) throw new Error("Duplicate image id");
    seenIds.add(id);
  }

  return imageIds;
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm run test -- tests/house-images.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit service helpers**

Run:

```powershell
git add -- server/services/images.ts tests/house-images.test.ts
git commit -m "feat: add house cover select helpers"
```

Expected: commit succeeds with only service helper and test changes.

---

### Task 3: Add Repository Save And Server Action

**Files:**
- Modify: `server/repositories/images.ts`
- Modify: `app/admin/houses/[propertyId]/images/actions.ts`
- Test: `tests/house-image-actions.test.ts`

- [ ] **Step 1: Write failing action/repository source tests**

In `tests/house-image-actions.test.ts`, add these assertions inside the existing test:

```ts
    assert.match(actionsSource, /export interface HouseCoverSelectSaveResult/);
    assert.match(actionsSource, /export async function saveHouseCoverSelectAction/);
    assert.match(actionsSource, /validateHouseCoverSelectIds/);
    assert.match(actionsSource, /updateHouseCoverSelect/);
    assert.match(actionsSource, /getListingByPropertyId\(supabase, propertyId\)/);
    assert.match(actionsSource, /Image does not belong to this house/);
    assert.match(repositorySource, /cover_select/);
    assert.match(repositorySource, /export async function updateHouseCoverSelect/);
    assert.match(repositorySource, /\.update\(\{ cover_select: 0/);
    assert.match(repositorySource, /cover_select: index \+ 1/);
```

Add this check near the end of the test:

```ts
    const updateCoverSelectSource = repositorySource.slice(
      repositorySource.indexOf("export async function updateHouseCoverSelect"),
    );
    assert.doesNotMatch(updateCoverSelectSource, /image_move/);
```

- [ ] **Step 2: Run action tests to verify they fail**

Run:

```powershell
npm run test -- tests/house-image-actions.test.ts
```

Expected: FAIL because the new action and repository helper do not exist yet.

- [ ] **Step 3: Update repository selection and helper**

In `server/repositories/images.ts`, update `houseImageSelect`:

```ts
const houseImageSelect =
  "id,property_id,cover_select,image_name,image_url,image_zone,image_move,created_at,updated_at";
```

Add this helper after `deleteHouseImageById`:

```ts
export async function updateHouseCoverSelect(
  supabase: SupabaseClient,
  propertyId: string,
  imageIds: number[],
) {
  const now = new Date().toISOString();

  const { error: resetError } = await supabase
    .from("images")
    .update({ cover_select: 0, updated_at: now })
    .eq("property_id", propertyId);

  if (resetError) throw new Error(resetError.message);

  for (const [index, id] of imageIds.entries()) {
    const { error } = await supabase
      .from("images")
      .update({ cover_select: index + 1, updated_at: now })
      .eq("property_id", propertyId)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Add server action**

In `app/admin/houses/[propertyId]/images/actions.ts`, add `updateHouseCoverSelect` to the repository imports:

```ts
  updateHouseCoverSelect,
```

Add `validateHouseCoverSelectIds` to the service imports:

```ts
  validateHouseCoverSelectIds,
```

Add this interface after `HouseImageBulkDeleteResult`:

```ts
export interface HouseCoverSelectSaveResult {
  savedCount: number;
}
```

Add this action after `deleteHouseImagesAction`:

```ts
export async function saveHouseCoverSelectAction(
  propertyId: string,
  imageIds: number[],
): Promise<HouseCoverSelectSaveResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const selectedIds = validateHouseCoverSelectIds(imageIds);
  const images = await getHouseImagesByIds(supabase, selectedIds);

  if (images.length !== selectedIds.length) {
    throw new Error("Some selected images were not found");
  }

  for (const image of images) {
    assertImageBelongsToProperty(image, propertyId);
  }

  await updateHouseCoverSelect(supabase, propertyId, selectedIds);
  revalidateHouseImagePaths(propertyId);

  return { savedCount: selectedIds.length };
}
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
npm run test -- tests/house-image-actions.test.ts tests/house-images.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit repository/action changes**

Run:

```powershell
git add -- server/repositories/images.ts app/admin/houses/[propertyId]/images/actions.ts tests/house-image-actions.test.ts
git commit -m "feat: save house cover selection"
```

Expected: commit succeeds.

---

### Task 4: Wire Cover-Select Mode Into The Page

**Files:**
- Modify: `app/admin/houses/[propertyId]/images/page.tsx`
- Create: `components/admin/images/cover-select-viewer.tsx`
- Test: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing page wiring tests**

In `tests/house-images-ui.test.ts`, add this path near the existing source constants:

```ts
const coverSelectSource = readFileSync(
  new URL("../components/admin/images/cover-select-viewer.tsx", import.meta.url),
  "utf8",
);
```

Add this test near the existing page wiring tests:

```ts
  it("switches to a cover-select mode on the existing house image route", () => {
    assert.match(pageSource, /import \{ CoverSelectViewer \}/);
    assert.match(pageSource, /saveHouseCoverSelectAction/);
    assert.match(pageSource, /searchParams: Promise<\{ zone\?: string; returnTo\?: string; mode\?: string \}>/);
    assert.match(pageSource, /const isCoverSelectMode = mode === "cover-select";/);
    assert.match(pageSource, /isCoverSelectMode \? \(/);
    assert.match(pageSource, /<CoverSelectViewer/);
    assert.match(pageSource, /saveAction=\{saveHouseCoverSelectAction\.bind\(null, propertyId\)\}/);
    assert.match(source, /mode: "cover-select"/);
  });
```

Add an existence test for the new component:

```ts
  it("adds a dedicated cover selection viewer component", () => {
    assert.match(coverSelectSource, /export function CoverSelectViewer/);
  });
```

- [ ] **Step 2: Create a minimal component shell**

Create `components/admin/images/cover-select-viewer.tsx`:

```tsx
"use client";

import type { ImageZoneGroup } from "../../../server/services/images";

interface CoverSelectViewerProps {
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  saveAction: (imageIds: number[]) => Promise<{ savedCount: number }>;
  selectedZone?: string;
}

export function CoverSelectViewer({
  groups,
  propertyId,
  returnTo,
  saveAction,
  selectedZone,
}: CoverSelectViewerProps) {
  void groups;
  void propertyId;
  void returnTo;
  void saveAction;
  void selectedZone;

  return <div>Cover select</div>;
}
```

- [ ] **Step 3: Wire page mode switch**

In `app/admin/houses/[propertyId]/images/page.tsx`, add imports:

```ts
import { CoverSelectViewer } from "../../../../../components/admin/images/cover-select-viewer";
```

Update action imports:

```ts
import {
  deleteHouseImageAction,
  saveHouseCoverSelectAction,
  uploadHouseImagesAction,
} from "./actions";
```

Update the page props type:

```ts
searchParams: Promise<{ zone?: string; returnTo?: string; mode?: string }>;
```

Update search param destructuring:

```ts
const { mode, returnTo, zone } = await searchParams;
```

Add after `groups`:

```ts
const isCoverSelectMode = mode === "cover-select";
```

Replace the `<ImageZoneViewer ... />` block with:

```tsx
      {isCoverSelectMode ? (
        <CoverSelectViewer
          groups={groups}
          propertyId={propertyId}
          returnTo={safeReturnTo ?? undefined}
          saveAction={saveHouseCoverSelectAction.bind(null, propertyId)}
          selectedZone={zone}
        />
      ) : (
        <ImageZoneViewer
          deleteAction={deleteHouseImageAction.bind(null, propertyId)}
          groups={groups}
          propertyId={propertyId}
          returnTo={safeReturnTo ?? undefined}
          selectedZone={zone}
          uploadAction={uploadHouseImagesAction.bind(null, propertyId)}
        />
      )}
```

- [ ] **Step 4: Add entry link from normal image manager**

In `components/admin/images/image-zone-viewer.tsx`, update `imageZoneHref` to accept mode:

```ts
function imageZoneHref(propertyId: string, zone: string, returnTo?: string): string {
  const params = new URLSearchParams({ zone });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function coverSelectHref(propertyId: string, returnTo?: string): string {
  const params = new URLSearchParams({ mode: "cover-select" });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}
```

Add this link next to the existing upload/delete controls in the non-bulk-select header branch, before the delete/select button:

```tsx
                <Button asChild disabled={isBusy} size="sm" type="button" variant="outline">
                  <Link href={coverSelectHref(propertyId, returnTo)}>จัดลำดับรูปแสดง</Link>
                </Button>
```

- [ ] **Step 5: Run UI tests to verify wiring**

Run:

```powershell
npm run test -- tests/house-images-ui.test.ts
```

Expected: PASS for route wiring and component shell.

- [ ] **Step 6: Commit page wiring**

Run:

```powershell
git add -- app/admin/houses/[propertyId]/images/page.tsx components/admin/images/image-zone-viewer.tsx components/admin/images/cover-select-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: add cover select mode"
```

Expected: commit succeeds.

---

### Task 5: Build CoverSelectViewer UI And DnD Reorder

**Files:**
- Modify: `components/admin/images/cover-select-viewer.tsx`
- Test: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Add failing UI implementation tests**

In `tests/house-images-ui.test.ts`, extend the `adds a dedicated cover selection viewer component` test:

```ts
    assert.match(coverSelectSource, /import \{ DragDropProvider \} from "@dnd-kit\/react"/);
    assert.match(coverSelectSource, /import \{ move \} from "@dnd-kit\/helpers"/);
    assert.match(coverSelectSource, /import \{ useSortable \} from "@dnd-kit\/react\/sortable"/);
    assert.match(coverSelectSource, /getHouseCoverSelectedImages/);
    assert.match(coverSelectSource, /HOUSE_COVER_SELECT_MIN/);
    assert.match(coverSelectSource, /HOUSE_COVER_SELECT_MAX/);
    assert.match(coverSelectSource, /selectedIds/);
    assert.match(coverSelectSource, /DragDropProvider/);
    assert.match(coverSelectSource, /onDragEnd/);
    assert.match(coverSelectSource, /move\(ids, event\)/);
    assert.match(coverSelectSource, /selected strip/i);
    assert.match(coverSelectSource, /saveAction\(selectedIds\)/);
    assert.match(coverSelectSource, /getSelectedImageZoneGroup/);
    assert.match(coverSelectSource, /mode: "cover-select"/);
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```powershell
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because `CoverSelectViewer` is still a shell.

- [ ] **Step 3: Replace the component shell with the full implementation**

Replace `components/admin/images/cover-select-viewer.tsx` with:

```tsx
"use client";

/* eslint-disable @next/next/no-img-element */

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import { cn } from "../../../lib/utils";
import {
  HOUSE_COVER_SELECT_MAX,
  HOUSE_COVER_SELECT_MIN,
  getHouseCoverSelectedImages,
  getHouseImageStorageProvider,
  getImageZoneMeta,
  getSelectedImageZoneGroup,
  type HouseImageItem,
  type ImageZoneGroup,
} from "../../../server/services/images";
import { AdminImageCard } from "../image-asset-card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

const allZonesKey = "__all__";

function displayUrl(image: HouseImageItem): string | null {
  const provider = getHouseImageStorageProvider(image.image_url);
  if (provider === "r2" && image.image_url) return image.image_url;
  if (!image.image_name) return null;

  try {
    return buildAwsImageUrl(image.image_name);
  } catch {
    return null;
  }
}

function coverSelectHref(propertyId: string, zone?: string, returnTo?: string): string {
  const params = new URLSearchParams({ mode: "cover-select" });
  if (zone && zone !== allZonesKey) params.set("zone", zone);
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function normalImageHref(propertyId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return `/admin/houses/${encodeURIComponent(propertyId)}/images${query ? `?${query}` : ""}`;
}

function selectedCountLabel(count: number): string {
  return `${count}/${HOUSE_COVER_SELECT_MAX} รูป`;
}

function SortableSelectedImage({
  canMoveLeft,
  canMoveRight,
  image,
  index,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: {
  canMoveLeft: boolean;
  canMoveRight: boolean;
  image: HouseImageItem;
  index: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}) {
  const { isDragging, ref } = useSortable({
    group: "cover-select",
    id: image.id,
    index,
  });

  return (
    <div
      className={cn("w-36 shrink-0 sm:w-40", isDragging && "opacity-60")}
      data-dnd-kit-sortable
      ref={ref}
    >
      <AdminImageCard
        action={
          <Button
            className="size-7 bg-background/90"
            onClick={onRemove}
            size="icon"
            title="เอาออกจากรูปแสดง"
            type="button"
            variant="outline"
          >
            <XIcon data-icon="inline-start" />
            <span className="sr-only">เอาออกจากรูปแสดง</span>
          </Button>
        }
        alt={image.image_name ?? "house image"}
        imageName={image.image_name ?? "-"}
        orderLabel={`# ${index + 1}`}
        previewEnabled={false}
        secondaryLabel={getImageZoneMeta(image.image_zone ?? "").label}
        src={displayUrl(image)}
      />
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Button disabled={!canMoveLeft} onClick={onMoveLeft} size="sm" type="button" variant="outline">
          <ArrowLeftIcon data-icon="inline-start" />
          <span className="sr-only">เลื่อนไปซ้าย</span>
        </Button>
        <Button disabled={!canMoveRight} onClick={onMoveRight} size="sm" type="button" variant="outline">
          <ArrowRightIcon data-icon="inline-start" />
          <span className="sr-only">เลื่อนไปขวา</span>
        </Button>
      </div>
    </div>
  );
}

interface CoverSelectViewerProps {
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  saveAction: (imageIds: number[]) => Promise<{ savedCount: number }>;
  selectedZone?: string;
}

export function CoverSelectViewer({
  groups,
  propertyId,
  returnTo,
  saveAction,
  selectedZone,
}: CoverSelectViewerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allImages = useMemo(() => groups.flatMap((group) => group.images), [groups]);
  const initialSelectedIds = useMemo(
    () => getHouseCoverSelectedImages(allImages).map((image) => image.id),
    [allImages],
  );
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const imageById = useMemo(() => new Map(allImages.map((image) => [image.id, image])), [allImages]);
  const selectedImages = selectedIds
    .map((id) => imageById.get(id))
    .filter((image): image is HouseImageItem => Boolean(image));
  const selectedGroup = selectedZone
    ? getSelectedImageZoneGroup(groups, selectedZone)
    : null;
  const visibleImages = selectedGroup ? selectedGroup.images : allImages;
  const canSave =
    selectedIds.length >= HOUSE_COVER_SELECT_MIN &&
    selectedIds.length <= HOUSE_COVER_SELECT_MAX &&
    !isPending;

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  function toggleImage(image: HouseImageItem) {
    setSelectedIds((ids) => {
      if (ids.includes(image.id)) return ids.filter((id) => id !== image.id);

      if (ids.length >= HOUSE_COVER_SELECT_MAX) {
        toast.warning(`เลือกได้สูงสุด ${HOUSE_COVER_SELECT_MAX} รูป`);
        return ids;
      }

      return [...ids, image.id];
    });
  }

  function removeSelectedImage(imageId: number) {
    setSelectedIds((ids) => ids.filter((id) => id !== imageId));
  }

  function moveSelectedImage(fromIndex: number, toIndex: number) {
    setSelectedIds((ids) => {
      if (toIndex < 0 || toIndex >= ids.length) return ids;
      const next = [...ids];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }

  function saveSelection() {
    if (selectedIds.length < HOUSE_COVER_SELECT_MIN) {
      toast.error(`ต้องเลือกอย่างน้อย ${HOUSE_COVER_SELECT_MIN} รูป`);
      return;
    }

    if (selectedIds.length > HOUSE_COVER_SELECT_MAX) {
      toast.error(`เลือกได้สูงสุด ${HOUSE_COVER_SELECT_MAX} รูป`);
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          await saveAction(selectedIds);
          toast.success("บันทึกลำดับรูปแสดงแล้ว");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "บันทึกลำดับรูปแสดงไม่สำเร็จ");
        }
      })();
    });
  }

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background lg:grid-cols-[220px_1fr] lg:grid-rows-1">
      <aside className="min-h-0 min-w-0 border-b bg-muted/20 lg:grid lg:grid-rows-[auto_minmax(0,1fr)] lg:border-b-0 lg:border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Zones</h2>
        </div>
        <ScrollArea className="w-full min-w-0 lg:h-full">
          <nav className="flex w-max min-w-full gap-2 p-3 lg:w-auto lg:min-w-0 lg:flex-col" aria-label="Cover select image zones">
            <Link
              className={cn(
                "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                !selectedZone && "bg-primary text-primary-foreground hover:bg-primary",
              )}
              href={coverSelectHref(propertyId, allZonesKey, returnTo)}
            >
              <span className="font-medium">ทั้งหมด</span>
              <Badge className="shrink-0" variant={!selectedZone ? "secondary" : "outline"}>
                {allImages.length} รูป
              </Badge>
            </Link>
            {groups.map((group) => {
              const isActive = group.zone === selectedZone;
              const meta = getImageZoneMeta(group.zone);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  href={coverSelectHref(propertyId, group.zone, returnTo)}
                  key={group.zone}
                  title={group.zone}
                >
                  <span className="block min-w-0 truncate font-medium">{meta.label}</span>
                  <Badge className="shrink-0" variant={isActive ? "secondary" : "outline"}>
                    {group.images.length} รูป
                  </Badge>
                </Link>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">จัดลำดับรูปแสดง</h2>
            <p className="text-xs text-muted-foreground">
              เลือก {HOUSE_COVER_SELECT_MIN}-{HOUSE_COVER_SELECT_MAX} รูป · {selectedCountLabel(selectedIds.length)}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button asChild disabled={isPending} size="sm" type="button" variant="outline">
              <Link href={normalImageHref(propertyId, returnTo)}>ยกเลิก</Link>
            </Button>
            <Button disabled={!canSave} onClick={saveSelection} size="sm" type="button">
              {isPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              บันทึก
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-2">
          <section className="rounded-lg border bg-muted/20 p-3" aria-label="selected strip">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">รูปที่เลือก</p>
              <Badge variant={canSave ? "secondary" : "outline"}>{selectedCountLabel(selectedIds.length)}</Badge>
            </div>
            {selectedImages.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed bg-background text-sm text-muted-foreground">
                ยังไม่ได้เลือกรูป
              </div>
            ) : (
              <DragDropProvider
                onDragEnd={(event) => {
                  if (event.canceled) return;
                  setSelectedIds((ids) => move(ids, event) as number[]);
                }}
              >
                <ScrollArea className="w-full">
                  <div className="flex w-max gap-3 pb-3">
                    {selectedImages.map((image, index) => (
                      <SortableSelectedImage
                        canMoveLeft={index > 0}
                        canMoveRight={index < selectedImages.length - 1}
                        image={image}
                        index={index}
                        key={image.id}
                        onMoveLeft={() => moveSelectedImage(index, index - 1)}
                        onMoveRight={() => moveSelectedImage(index, index + 1)}
                        onRemove={() => removeSelectedImage(image.id)}
                      />
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </DragDropProvider>
            )}
          </section>

          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-lg">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-center gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
              {visibleImages.map((image, index) => {
                const selectedIndex = selectedIds.indexOf(image.id);
                const isSelected = selectedIndex !== -1;
                const zoneMeta = getImageZoneMeta(image.image_zone ?? "");

                return (
                  <AdminImageCard
                    alt={image.image_name ?? "house image"}
                    imageName={image.image_name ?? "-"}
                    key={image.id}
                    loading={index === 0 ? "eager" : "lazy"}
                    onSelect={() => toggleImage(image)}
                    orderLabel={isSelected ? `# ${selectedIndex + 1}` : undefined}
                    previewEnabled={false}
                    secondaryLabel={zoneMeta.label}
                    selected={isSelected}
                    selectionLabel={`${isSelected ? "เอาออก" : "เลือก"} ${image.image_name ?? image.id}`}
                    src={displayUrl(image)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run UI tests**

Run:

```powershell
npm run test -- tests/house-images-ui.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck for dnd-kit typing**

Run:

```powershell
npm run typecheck
```

Expected: PASS. If `move(ids, event)` has a type mismatch, keep the behavior and narrow the cast at the call site rather than adding a wrapper abstraction.

- [ ] **Step 6: Commit viewer implementation**

Run:

```powershell
git add -- components/admin/images/cover-select-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: build cover selection viewer"
```

Expected: commit succeeds.

---

### Task 6: Update Documentation

**Files:**
- Modify: `docs/image-management.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update image management docs**

In `docs/image-management.md`, add these bullets under `Current Admin Flow`:

```md
- `/admin/houses/[propertyId]/images?mode=cover-select` lets admins choose the house-card display images.
- House-card display order is stored in `images.cover_select` and is independent from `image_move`.
- Cover selection counts across all image zones. The zone sidebar acts only as a filter while choosing images.
- Saving cover selection requires 3-10 selected images, resets unselected images for that house to `cover_select = 0`, and does not change physical image files.
```

- [ ] **Step 2: Update architecture docs**

In `docs/architecture.md`, add this paragraph near the existing house image ordering notes:

```md
House card display images use `public.images.cover_select`. This value is independent from zone-scoped `image_move`: `image_move` controls order within an image zone, while `cover_select` controls the 1-10 cross-zone image order used by house cards. Admins edit `cover_select` through `/admin/houses/[propertyId]/images?mode=cover-select`; saving resets unselected images for that house to `0`.
```

- [ ] **Step 3: Run docs-related source tests**

Run:

```powershell
npm run test -- tests/house-images-ui.test.ts tests/house-images.test.ts tests/house-image-actions.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit documentation**

Run:

```powershell
git add -- docs/image-management.md docs/architecture.md
git commit -m "docs: document house cover selection"
```

Expected: commit succeeds.

---

### Task 7: Full Verification

**Files:**
- No code edits unless verification exposes a bug.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```powershell
npm run test
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: no unintended files. Only planned files should be modified since the last commit.

- [ ] **Step 5: Handle any verification failures**

If verification exposes a bug, return to the task that owns the failing file, make the smallest fix there, rerun the failing command, and use that task's commit step. If every verification command passed, no action is needed here.

Expected: no uncommitted verification-only changes remain.

---

## Self-Review

Spec coverage:

- Existing route with `mode=cover-select`: Task 4.
- Separate `CoverSelectViewer`: Tasks 4 and 5.
- `cover_select` read/write: Tasks 2 and 3.
- 3-10 validation: Tasks 2, 3, and 5.
- Reset unselected images to `0`: Task 3.
- Do not touch `image_move`: Task 3 tests.
- Cross-zone global selection with zone filtering: Task 5.
- dnd-kit selected-strip reorder: Task 5.
- Save/cancel and error toast behavior: Task 5.
- Docs updates: Task 6.
- Final checks: Task 7.

Unfinished-marker scan:

- No unfinished markers or unspecified implementation steps remain.

Type consistency:

- Action name is consistently `saveHouseCoverSelectAction`.
- Result type is consistently `HouseCoverSelectSaveResult`.
- Repository helper is consistently `updateHouseCoverSelect`.
- Service helpers are consistently `getHouseCoverSelectedImages` and `validateHouseCoverSelectIds`.
