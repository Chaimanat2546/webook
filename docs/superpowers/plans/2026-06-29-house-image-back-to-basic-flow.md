# House Image Back-to-Basic Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the staged house image save flow with immediate upload, confirmed single delete, and current-zone bulk delete.

**Architecture:** Keep Supabase, R2 storage, auth checks, and provider policy in server actions under `app/admin/houses/[propertyId]/images/actions.ts`. Keep the image manager as a client component, but make it operation-based: call server actions directly, show `sonner` toasts, and refresh the current route with `router.refresh()`. Preserve existing zone grouping, card preview behavior, compact grid layout, and return URL behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, shadcn/ui primitives already present in `components/ui`, Supabase, Cloudflare R2 storage adapter, Node test runner.

---

## File Structure

- Modify `app/admin/houses/[propertyId]/images/actions.ts`
  - Replace the staged `updateHouseImagesAction` export with operation-specific actions:
    - `uploadHouseImagesAction(propertyId: string, formData: FormData): Promise<HouseImageUploadResult>`
    - `deleteHouseImageAction(propertyId: string, imageId: number): Promise<HouseImageDeleteResult>`
    - `deleteHouseImagesAction(propertyId: string, imageIds: number[]): Promise<HouseImageBulkDeleteResult>`
  - Keep auth, permission, property validation, storage upload/delete, cleanup, revalidation, and provider policy server-side.

- Modify `app/admin/houses/[propertyId]/images/page.tsx`
  - Pass the three operation-specific actions to `ImageZoneViewer`.
  - Remove the staged update action import.

- Modify `components/admin/images/image-zone-viewer.tsx`
  - Remove draft preview state, dirty state, save/cancel footer, and staged hidden fields.
  - Add immediate upload handling with pending state and toast feedback.
  - Add select mode, current-zone select all, clear selection, bulk delete dialog, and single delete dialog.
  - Keep zone navigation and existing `AdminImageCard` preview behavior.

- Modify `server/repositories/images.ts`
  - Add read helpers that actions can use without trusting client data:
    - `getHouseImageById(supabase, id)`
    - `getHouseImagesByIds(supabase, ids)`
  - Keep `insertHouseImages` and `deleteHouseImageById`.

- Modify `tests/house-image-actions.test.ts`
  - Assert action exports, helper usage, all-or-nothing upload cleanup intent, provider policy, and operation-specific result shapes.

- Modify `tests/house-images-ui.test.ts`
  - Assert the staged save/draft UI is gone.
  - Assert select mode, current-zone select all, single delete confirmation preview, bulk delete confirmation, immediate upload, `toast`, and `router.refresh()` exist.

- Modify `docs/image-management.md`
  - Update the current behavior summary for operation-based image management.

- Modify `docs/image-management/mvp-4-add-delete-image-records.md`
  - Replace staged save language with immediate upload and confirmed delete behavior.

- Modify `docs/image-management/mvp-5-external-provider-file-crud.md`
  - Clarify R2-only delete remains enforced, bulk delete is confirmed, and AWS/S3 remains display-only.

---

### Task 1: Repository Helpers For Trusted Image Lookup

**Files:**
- Modify: `server/repositories/images.ts`
- Test: `tests/house-image-actions.test.ts`

- [ ] **Step 1: Write the failing repository-helper assertions**

Add these assertions inside the existing house image actions test block in `tests/house-image-actions.test.ts`, after `repositorySource` is defined:

```ts
    assert.match(repositorySource, /export async function getHouseImageById/);
    assert.match(repositorySource, /\.from\("images"\)[\s\S]*\.select\("id,property_id,image_name,image_url,image_zone,image_move,created_at,updated_at"\)[\s\S]*\.eq\("id", id\)[\s\S]*\.maybeSingle\(\)/);
    assert.match(repositorySource, /export async function getHouseImagesByIds/);
    assert.match(repositorySource, /\.from\("images"\)[\s\S]*\.in\("id", ids\)/);
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm run test -- tests/house-image-actions.test.ts
```

Expected: FAIL because `getHouseImageById` and `getHouseImagesByIds` are not exported yet.

- [ ] **Step 3: Implement the repository helpers**

In `server/repositories/images.ts`, add the helpers after `getImagesByPropertyId`:

```ts
const houseImageSelect =
  "id,property_id,image_name,image_url,image_zone,image_move,created_at,updated_at";

export async function getHouseImageById(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase
    .from("images")
    .select(houseImageSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getHouseImagesByIds(supabase: SupabaseClient, ids: number[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("images")
    .select(houseImageSelect)
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
```

Then update `getImagesByPropertyId` to reuse `houseImageSelect`:

```ts
export async function getImagesByPropertyId(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("images")
    .select(houseImageSelect)
    .eq("property_id", propertyId)
    .order("image_move", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
npm run test -- tests/house-image-actions.test.ts
```

Expected: PASS for this test file.

- [ ] **Step 5: Commit**

```bash
git add -- server/repositories/images.ts tests/house-image-actions.test.ts
git commit -m "test: add trusted house image lookup helpers"
```

---

### Task 2: Operation-Specific House Image Server Actions

**Files:**
- Modify: `app/admin/houses/[propertyId]/images/actions.ts`
- Modify: `tests/house-image-actions.test.ts`

- [ ] **Step 1: Replace the action test expectations**

In `tests/house-image-actions.test.ts`, rename the test to:

```ts
  it("uses operation-specific server actions for immediate upload and confirmed delete", () => {
```

Replace the action assertions in that test with:

```ts
    assert.match(actionsSource, /export interface HouseImageUploadResult/);
    assert.match(actionsSource, /export interface HouseImageDeleteResult/);
    assert.match(actionsSource, /export interface HouseImageBulkDeleteResult/);
    assert.match(actionsSource, /export async function uploadHouseImagesAction/);
    assert.match(actionsSource, /export async function deleteHouseImageAction/);
    assert.match(actionsSource, /export async function deleteHouseImagesAction/);
    assert.doesNotMatch(actionsSource, /export async function updateHouseImagesAction/);
    assert.match(actionsSource, /getHouseImageById/);
    assert.match(actionsSource, /getHouseImagesByIds/);
    assert.match(actionsSource, /uploadedObjectKeys/);
    assert.match(actionsSource, /cleanupUploadedImages/);
    assert.match(actionsSource, /cleanupWarning/);
    assert.match(actionsSource, /storageFailed/);
    assert.match(actionsSource, /isHouseImageFileOperationAllowed\(image\.image_url, "delete"\)/);
    assert.match(actionsSource, /canUseAccommodation\(adminUser\)/);
    assert.match(actionsSource, /Admin profile is incomplete/);
    assert.match(actionsSource, /create_by: adminCreateBy/);
    assert.doesNotMatch(actionsSource, /redirect\(/);
    assert.doesNotMatch(actionsSource, /deleted_image_ids/);
```

Keep the repository assertions from Task 1.

- [ ] **Step 2: Run the targeted action test to verify it fails**

Run:

```bash
npm run test -- tests/house-image-actions.test.ts
```

Expected: FAIL because the new exports and result shapes do not exist yet.

- [ ] **Step 3: Replace `actions.ts` imports**

In `app/admin/houses/[propertyId]/images/actions.ts`, remove `redirect` from imports:

```ts
import { revalidatePath } from "next/cache";
```

Update repository imports:

```ts
import {
  deleteHouseImageById,
  getHouseImageById,
  getHouseImagesByIds,
  getImagesByPropertyId,
  insertHouseImages,
  type HouseImageInsert,
} from "../../../../../server/repositories/images";
```

- [ ] **Step 4: Add action result interfaces**

Add these interfaces after the imports:

```ts
export interface HouseImageUploadResult {
  uploadedCount: number;
}

export interface HouseImageDeleteResult {
  deletedId: number;
  cleanupWarning: boolean;
  fileName: string | null;
}

export interface HouseImageBulkDeleteResult {
  deleted: Array<{ id: number; fileName: string | null }>;
  databaseFailed: Array<{ id: number; fileName: string | null; message: string }>;
  storageFailed: Array<{ id: number; fileName: string | null; message: string }>;
  skipped: Array<{ id: number; reason: string }>;
}
```

- [ ] **Step 5: Remove staged-form helpers that are no longer needed**

Delete these functions from `actions.ts`:

```ts
function stringArrayField(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function getSafeReturnTo(value: string): string | null {
  if (value === "/admin/houses" || value.startsWith("/admin/houses?")) return value;
  return null;
}

function imagePageHref(propertyId: string, zone: string, returnTo: string | null): string {
  const params = new URLSearchParams({ saved: "1", zone });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}
```

- [ ] **Step 6: Add shared revalidation and ownership helpers**

Add these helpers after `cleanupUploadedImages`:

```ts
function revalidateHouseImagePaths(propertyId: string) {
  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/images`);
}

function assertImageBelongsToProperty(image: { property_id?: number | string | null }, propertyId: string) {
  if (String(image.property_id) !== propertyId) {
    throw new Error("Image does not belong to this house");
  }
}

function assertImageCanBeDeleted(imageUrl?: string | null) {
  if (!isHouseImageFileOperationAllowed(imageUrl, "delete")) {
    throw new Error("Image provider does not support delete");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
```

- [ ] **Step 7: Replace `updateHouseImagesAction` with immediate upload**

Delete the whole `updateHouseImagesAction` function and add:

```ts
export async function uploadHouseImagesAction(
  propertyId: string,
  formData: FormData,
): Promise<HouseImageUploadResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);
  const adminCreateBy = requireAdminCreateBy(adminUser);

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const numericPropertyId = parsePropertyId(propertyId);
  const imageZone = validateHouseImageZone(requireString(formData, "image_zone") || "inside");
  const files = getImageFiles(formData, "images").map(validateHouseImageFile);
  if (files.length === 0) return { uploadedCount: 0 };

  const existingImages = await getImagesByPropertyId(supabase, propertyId);
  const imageEnv = getHouseImageEnv();
  const uploadedObjectKeys: string[] = [];
  const rows: HouseImageInsert[] = [];
  const now = new Date().toISOString();

  try {
    for (const [index, file] of files.entries()) {
      const imageName = buildHouseImageName(file.type);
      const objectKey = buildHouseImageObjectKey(propertyId, imageName);
      await uploadHouseImageObject({
        body: await file.arrayBuffer(),
        contentType: file.type,
        objectKey,
        workerSecret: imageEnv.workerSecret,
        workerUrl: imageEnv.workerUrl,
      });
      uploadedObjectKeys.push(objectKey);
      rows.push({
        created_at: now,
        create_by: adminCreateBy,
        image_move: getNextHouseImageMove(existingImages, imageZone, index),
        image_name: imageName,
        image_url: buildHouseImageUrl(objectKey, imageEnv.workerUrl),
        image_zone: imageZone,
        property_id: numericPropertyId,
        updated_at: now,
      });
    }

    await insertHouseImages(supabase, rows);
  } catch (error) {
    await cleanupUploadedImages({
      objectKeys: uploadedObjectKeys,
      workerSecret: imageEnv.workerSecret,
      workerUrl: imageEnv.workerUrl,
    });
    throw error;
  }

  revalidateHouseImagePaths(propertyId);
  return { uploadedCount: rows.length };
}
```

- [ ] **Step 8: Add single delete action**

Add this after `uploadHouseImagesAction`:

```ts
export async function deleteHouseImageAction(
  propertyId: string,
  imageId: number,
): Promise<HouseImageDeleteResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);

  const image = await getHouseImageById(supabase, imageId);
  if (!image) throw new Error("Image not found");
  assertImageBelongsToProperty(image, propertyId);
  assertImageCanBeDeleted(image.image_url);

  await deleteHouseImageById(supabase, image.id);

  const imageEnv = getHouseImageEnv();
  let cleanupWarning = false;
  try {
    await deleteHouseImageObject({
      objectKey: resolveHouseImageObjectKey(propertyId, image.image_name ?? ""),
      workerSecret: imageEnv.workerSecret,
      workerUrl: imageEnv.workerUrl,
    });
  } catch {
    cleanupWarning = true;
  }

  revalidateHouseImagePaths(propertyId);
  return {
    cleanupWarning,
    deletedId: image.id,
    fileName: image.image_name ?? null,
  };
}
```

- [ ] **Step 9: Add bulk delete action**

Add this after `deleteHouseImageAction`:

```ts
export async function deleteHouseImagesAction(
  propertyId: string,
  imageIds: number[],
): Promise<HouseImageBulkDeleteResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);

  const uniqueIds = [...new Set(imageIds.filter((id) => Number.isInteger(id) && id > 0))];
  const images = await getHouseImagesByIds(supabase, uniqueIds);
  const imageById = new Map(images.map((image) => [image.id, image]));
  const imageEnv = getHouseImageEnv();
  const result: HouseImageBulkDeleteResult = {
    databaseFailed: [],
    deleted: [],
    skipped: [],
    storageFailed: [],
  };

  for (const imageId of uniqueIds) {
    const image = imageById.get(imageId);
    if (!image) {
      result.skipped.push({ id: imageId, reason: "Image not found" });
      continue;
    }

    if (String(image.property_id) !== propertyId) {
      result.skipped.push({ id: imageId, reason: "Image does not belong to this house" });
      continue;
    }

    if (!isHouseImageFileOperationAllowed(image.image_url, "delete")) {
      result.skipped.push({ id: imageId, reason: "Image provider does not support delete" });
      continue;
    }

    try {
      await deleteHouseImageById(supabase, image.id);
      result.deleted.push({ id: image.id, fileName: image.image_name ?? null });
    } catch (error) {
      result.databaseFailed.push({
        fileName: image.image_name ?? null,
        id: image.id,
        message: errorMessage(error),
      });
      continue;
    }

    try {
      await deleteHouseImageObject({
        objectKey: resolveHouseImageObjectKey(propertyId, image.image_name ?? ""),
        workerSecret: imageEnv.workerSecret,
        workerUrl: imageEnv.workerUrl,
      });
    } catch (error) {
      result.storageFailed.push({
        fileName: image.image_name ?? null,
        id: image.id,
        message: errorMessage(error),
      });
    }
  }

  revalidateHouseImagePaths(propertyId);
  return result;
}
```

- [ ] **Step 10: Run the targeted action test to verify it passes**

Run:

```bash
npm run test -- tests/house-image-actions.test.ts
```

Expected: PASS for this test file.

- [ ] **Step 11: Commit**

```bash
git add -- app/admin/houses/[propertyId]/images/actions.ts tests/house-image-actions.test.ts
git commit -m "feat: split house image actions by operation"
```

---

### Task 3: Wire Page Props To Operation Actions

**Files:**
- Modify: `app/admin/houses/[propertyId]/images/page.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write the failing page wiring assertions**

In `tests/house-images-ui.test.ts`, update the test currently named `adds draft upload and pending delete controls like advertisement images` to this name:

```ts
  it("wires immediate upload and confirmed delete actions into the image manager", () => {
```

Replace the page action assertions in that test with:

```ts
    assert.match(pageSource, /uploadHouseImagesAction/);
    assert.match(pageSource, /deleteHouseImageAction/);
    assert.match(pageSource, /deleteHouseImagesAction/);
    assert.match(pageSource, /uploadAction=\{uploadHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.match(pageSource, /deleteAction=\{deleteHouseImageAction\.bind\(null, propertyId\)\}/);
    assert.match(pageSource, /bulkDeleteAction=\{deleteHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.doesNotMatch(pageSource, /updateHouseImagesAction/);
    assert.doesNotMatch(pageSource, /action=\{updateHouseImagesAction\.bind\(null, propertyId\)\}/);
```

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because `page.tsx` still imports and passes `updateHouseImagesAction`.

- [ ] **Step 3: Update the page import and props**

In `app/admin/houses/[propertyId]/images/page.tsx`, replace:

```ts
import { updateHouseImagesAction } from "./actions";
```

with:

```ts
import {
  deleteHouseImageAction,
  deleteHouseImagesAction,
  uploadHouseImagesAction,
} from "./actions";
```

Replace the `ImageZoneViewer` props:

```tsx
      <ImageZoneViewer
        action={updateHouseImagesAction.bind(null, propertyId)}
        groups={groups}
        propertyId={propertyId}
        returnTo={safeReturnTo ?? undefined}
        selectedZone={zone}
      />
```

with:

```tsx
      <ImageZoneViewer
        bulkDeleteAction={deleteHouseImagesAction.bind(null, propertyId)}
        deleteAction={deleteHouseImageAction.bind(null, propertyId)}
        groups={groups}
        propertyId={propertyId}
        returnTo={safeReturnTo ?? undefined}
        selectedZone={zone}
        uploadAction={uploadHouseImagesAction.bind(null, propertyId)}
      />
```

- [ ] **Step 4: Run the targeted UI test to verify the page wiring assertions pass**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL may continue on component assertions not yet updated, but the page wiring assertions pass.

- [ ] **Step 5: Commit**

```bash
git add -- app/admin/houses/[propertyId]/images/page.tsx tests/house-images-ui.test.ts
git commit -m "feat: wire house image operation actions"
```

---

### Task 4: Immediate Upload UI And Remove Staged Save UI

**Files:**
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing assertions for removing staged UI**

In `tests/house-images-ui.test.ts`, add this test after the page wiring test:

```ts
  it("removes the staged save and draft preview flow", () => {
    assert.doesNotMatch(source, /SaveIcon/);
    assert.doesNotMatch(source, /XIcon/);
    assert.doesNotMatch(source, /DraftPreview/);
    assert.doesNotMatch(source, /DraftImageCard/);
    assert.doesNotMatch(source, /deletedImageIds/);
    assert.doesNotMatch(source, /isDirty/);
    assert.doesNotMatch(source, /resetDraft/);
    assert.doesNotMatch(source, /name="deleted_image_ids"/);
    assert.doesNotMatch(source, /function appendPreviews/);
    assert.doesNotMatch(source, /URL\.createObjectURL/);
    assert.doesNotMatch(source, /URL\.revokeObjectURL/);
    assert.doesNotMatch(source, /บันทึกการเปลี่ยนแปลง/);
    assert.doesNotMatch(source, /ยกเลิก/);
  });
```

Then add immediate upload assertions:

```ts
  it("uploads selected files immediately and refreshes the grid", () => {
    assert.match(source, /import \{ toast \} from "sonner";/);
    assert.match(source, /useRouter/);
    assert.match(source, /const router = useRouter\(\);/);
    assert.match(source, /uploadAction: \(formData: FormData\) => Promise<\{ uploadedCount: number \}>/);
    assert.match(source, /function onFilesChange\(event: ChangeEvent<HTMLInputElement>\)/);
    assert.match(source, /void uploadSelectedFiles\(Array\.from\(event\.currentTarget\.files \?\? \[\]\)\)/);
    assert.match(source, /await uploadAction\(formData\)/);
    assert.match(source, /formData\.append\("image_zone", selectedGroup\.zone\)/);
    assert.match(source, /formData\.append\("images", file\)/);
    assert.match(source, /toast\.success/);
    assert.match(source, /toast\.error/);
    assert.match(source, /router\.refresh\(\)/);
  });
```

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because the staged UI is still present and immediate upload code does not exist.

- [ ] **Step 3: Update imports in `image-zone-viewer.tsx`**

Replace the current import block with this shape:

```ts
import {
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CheckIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleCodeIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
```

Keep the existing project imports below that block. Do not import `SaveIcon`.

- [ ] **Step 4: Replace component props**

Replace the `ImageZoneViewer` prop type:

```ts
export function ImageZoneViewer({
  action,
  groups,
  propertyId,
  returnTo,
  selectedZone,
}: {
  action: (formData: FormData) => void | Promise<void>;
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  selectedZone?: string;
}) {
```

with:

```ts
export function ImageZoneViewer({
  bulkDeleteAction,
  deleteAction,
  groups,
  propertyId,
  returnTo,
  selectedZone,
  uploadAction,
}: {
  bulkDeleteAction: (imageIds: number[]) => Promise<{
    databaseFailed: Array<{ id: number; fileName: string | null; message: string }>;
    deleted: Array<{ id: number; fileName: string | null }>;
    skipped: Array<{ id: number; reason: string }>;
    storageFailed: Array<{ id: number; fileName: string | null; message: string }>;
  }>;
  deleteAction: (imageId: number) => Promise<{
    cleanupWarning: boolean;
    deletedId: number;
    fileName: string | null;
  }>;
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  selectedZone?: string;
  uploadAction: (formData: FormData) => Promise<{ uploadedCount: number }>;
}) {
```

- [ ] **Step 5: Remove draft state and add operation state**

Delete:

```ts
  const formRef = useRef<HTMLFormElement>(null);
  const previewsRef = useRef<DraftPreview[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [previews, setPreviews] = useState<DraftPreview[]>([]);
```

Add:

```ts
  const router = useRouter();
  const [isUploading, startUploadTransition] = useTransition();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [singleDeleteImage, setSingleDeleteImage] = useState<HouseImageItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
```

Delete the preview cleanup effect that calls `URL.revokeObjectURL`.

- [ ] **Step 6: Add immediate upload helpers**

Delete the complete function declarations named:

- `syncInputFiles`
- `replacePreviews`
- `appendPreviews`
- `markDirty`
- `removeDraftFile`
- `markImageDeleted`
- `resetDraft`
- `onSubmit`

Replace `onFilesChange` with:

```ts
  function uploadSelectedFiles(files: File[]) {
    if (files.length === 0) return;

    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append("image_zone", selectedGroup.zone);
      for (const file of files) {
        formData.append("images", file);
      }

      try {
        const result = await uploadAction(formData);
        toast.success(`อัปโหลดรูปแล้ว ${result.uploadedCount} รูป`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadSelectedFiles(Array.from(event.currentTarget.files ?? []));
  }
```

- [ ] **Step 7: Keep visible images simple**

Replace:

```ts
  const visibleImages = selectedGroup.images.filter((image) => !deletedImageIds.includes(String(image.id)));
```

with:

```ts
  const visibleImages = selectedGroup.images;
  const deletableImages = visibleImages.filter((image) =>
    isHouseImageFileOperationAllowed(image.image_url, "delete"),
  );
```

- [ ] **Step 8: Replace the form wrapper with a non-form container**

Replace:

```tsx
    <form
      action={action}
      className="grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] rounded-xl border bg-background lg:grid-cols-[220px_1fr] lg:grid-rows-1"
      onSubmit={onSubmit}
      ref={formRef}
    >
      <input name="image_zone" type="hidden" value={selectedGroup.zone} />
      {returnTo ? <input name="return_to" type="hidden" value={returnTo} /> : null}
      {deletedImageIds.map((imageId) => (
        <input key={imageId} name="deleted_image_ids" type="hidden" value={imageId} />
      ))}
```

with:

```tsx
    <div className="grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] rounded-xl border bg-background lg:grid-cols-[220px_1fr] lg:grid-rows-1">
```

Replace the closing `</form>` with `</div>`.

- [ ] **Step 9: Update upload button pending state**

Replace the upload label content:

```tsx
              <UploadCloudIcon data-icon="inline-start" />
              อัปโหลดรูป
```

with:

```tsx
              {isUploading ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <UploadCloudIcon data-icon="inline-start" />}
              {isUploading ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
```

Add `aria-disabled={isUploading}` to the `Label` and add `disabled={isUploading}` to the `<input>`.

- [ ] **Step 10: Remove the draft card rendering and footer**

Delete the entire JSX block that starts with `{previews.map((preview, index) => (` and renders `DraftImageCard`.

Delete the bottom save/cancel footer:

Delete the entire JSX footer `<div>` whose class starts with `border-t bg-background px-2 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]` and contains the staged cancel/save buttons.

Change the image grid wrapper from:

```tsx
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 p-2">
```

to:

```tsx
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2">
```

- [ ] **Step 11: Run the targeted UI test**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL may continue on selection/delete dialog assertions from later tasks, but the immediate upload and staged-removal assertions pass.

- [ ] **Step 12: Commit**

```bash
git add -- components/admin/images/image-zone-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: upload house images immediately"
```

---

### Task 5: Single Delete Confirmation Dialog

**Files:**
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing single-delete UI assertions**

Add this test to `tests/house-images-ui.test.ts`:

```ts
  it("confirms single image deletion with a preview before calling the delete action", () => {
    assert.match(source, /singleDeleteImage/);
    assert.match(source, /setSingleDeleteImage\(image\)/);
    assert.match(source, /deleteAction\(singleDeleteImage\.id\)/);
    assert.match(source, /ลบรูปนี้/);
    assert.match(source, /ยืนยันการลบรูป/);
    assert.match(source, /displayUrl\(singleDeleteImage\)/);
    assert.match(source, /cleanupWarning/);
    assert.match(source, /toast\.warning/);
    assert.match(source, /router\.refresh\(\)/);
  });
```

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because the single delete dialog is not implemented yet.

- [ ] **Step 3: Import dialog primitives**

Add these imports in `components/admin/images/image-zone-viewer.tsx`:

```ts
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
```

- [ ] **Step 4: Add single delete helper**

Add this function inside `ImageZoneViewer`:

```ts
  function confirmSingleDelete() {
    if (!singleDeleteImage) return;

    startUploadTransition(async () => {
      try {
        const result = await deleteAction(singleDeleteImage.id);
        if (result.cleanupWarning) {
          toast.warning("ลบรายการรูปแล้ว แต่ลบไฟล์ใน storage ไม่ครบ");
        } else {
          toast.success("ลบรูปแล้ว");
        }
        setSingleDeleteImage(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
      }
    });
  }
```

If sharing `isUploading` for delete feels misleading in code, rename the transition state to:

```ts
  const [isMutating, startMutationTransition] = useTransition();
```

Then update upload and delete helpers to use `isMutating` and `startMutationTransition`.

- [ ] **Step 5: Change card delete action to open the dialog**

Replace:

```tsx
                          onClick={() => markImageDeleted(image.id)}
```

with:

```tsx
                          onClick={() => setSingleDeleteImage(image)}
```

Keep the delete button rendered only when `canDelete` is true.

- [ ] **Step 6: Render the single delete dialog**

Add this near the end of the returned JSX, before the top-level closing `</div>`:

```tsx
      <Dialog open={singleDeleteImage !== null} onOpenChange={(open) => !open && setSingleDeleteImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูป</DialogTitle>
            <DialogDescription>ตรวจสอบรูปก่อนยืนยันการลบ รูปที่ลบแล้วจะถูกนำออกจากบ้านพักนี้</DialogDescription>
          </DialogHeader>
          {singleDeleteImage ? (
            <div className="grid gap-3">
              <div className="overflow-hidden rounded-md bg-muted">
                {displayUrl(singleDeleteImage) ? (
                  <img
                    alt={singleDeleteImage.image_name ?? "house image"}
                    className="max-h-80 w-full object-contain"
                    src={displayUrl(singleDeleteImage) ?? undefined}
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                    แสดงรูปไม่ได้
                  </div>
                )}
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {singleDeleteImage.image_name ?? "-"}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button disabled={isMutating} onClick={confirmSingleDelete} type="button" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              ลบรูปนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Run the targeted UI test**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: Single delete assertions pass.

- [ ] **Step 8: Commit**

```bash
git add -- components/admin/images/image-zone-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: confirm single house image delete"
```

---

### Task 6: Current-Zone Bulk Select And Delete

**Files:**
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing bulk-select assertions**

Add this test to `tests/house-images-ui.test.ts`:

```ts
  it("supports current-zone bulk select and confirmed bulk delete", () => {
    assert.match(source, /selectMode/);
    assert.match(source, /selectedImageIds/);
    assert.match(source, /deletableImages/);
    assert.match(source, /function selectAllCurrentZoneImages/);
    assert.match(source, /setSelectedImageIds\(deletableImages\.map\(\(image\) => image\.id\)\)/);
    assert.match(source, /function toggleSelectedImage/);
    assert.match(source, /bulkDeleteAction\(selectedImageIds\)/);
    assert.match(source, /bulkDeleteOpen/);
    assert.match(source, /ลบรูปที่เลือก/);
    assert.match(source, /เลือกทั้งหมด/);
    assert.match(source, /ล้างที่เลือก/);
    assert.match(source, /ออกจากโหมดเลือก/);
    assert.match(source, /checked=\{selectedImageIds\.includes\(image\.id\)\}/);
    assert.match(source, /ลบสำเร็จ/);
    assert.match(source, /ลบไม่สำเร็จ/);
    assert.match(source, /storage cleanup/);
  });
```

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because select mode and bulk delete are not implemented yet.

- [ ] **Step 3: Add bulk selection helpers**

Add these functions inside `ImageZoneViewer`:

```ts
  function selectAllCurrentZoneImages() {
    setSelectedImageIds(deletableImages.map((image) => image.id));
  }

  function clearSelectedImages() {
    setSelectedImageIds([]);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedImageIds([]);
  }

  function toggleSelectedImage(imageId: number) {
    setSelectedImageIds((imageIds) =>
      imageIds.includes(imageId)
        ? imageIds.filter((id) => id !== imageId)
        : [...imageIds, imageId],
    );
  }

  function confirmBulkDelete() {
    if (selectedImageIds.length === 0) return;

    startMutationTransition(async () => {
      try {
        const result = await bulkDeleteAction(selectedImageIds);
        const failedCount = result.databaseFailed.length + result.skipped.length;
        const storageWarningCount = result.storageFailed.length;

        if (failedCount > 0 || storageWarningCount > 0) {
          toast.warning(
            `ลบสำเร็จ ${result.deleted.length} รูป, ลบไม่สำเร็จ ${failedCount} รูป, storage cleanup warning ${storageWarningCount} รูป`,
          );
        } else {
          toast.success(`ลบสำเร็จ ${result.deleted.length} รูป`);
        }

        setBulkDeleteOpen(false);
        exitSelectMode();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "ลบรูปที่เลือกไม่สำเร็จ");
      }
    });
  }
```

- [ ] **Step 4: Update the header controls**

Inside the zone header action area, keep upload in default mode and add select-mode controls:

```tsx
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {selectMode ? (
              <>
                <Button onClick={selectAllCurrentZoneImages} size="sm" type="button" variant="outline">
                  <CheckIcon data-icon="inline-start" />
                  เลือกทั้งหมด
                </Button>
                <Button onClick={clearSelectedImages} size="sm" type="button" variant="outline">
                  ล้างที่เลือก
                </Button>
                <Button
                  disabled={selectedImageIds.length === 0}
                  onClick={() => setBulkDeleteOpen(true)}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2Icon data-icon="inline-start" />
                  ลบรูปที่เลือก
                </Button>
                <Button onClick={exitSelectMode} size="icon" type="button" variant="ghost">
                  <XIcon />
                  <span className="sr-only">ออกจากโหมดเลือก</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={deletableImages.length === 0}
                  onClick={() => setSelectMode(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <CheckIcon data-icon="inline-start" />
                  เลือก
                </Button>
                <Label
                  aria-disabled={isMutating}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer text-foreground",
                    isMutating && "pointer-events-none opacity-50",
                  )}
                  htmlFor="house-images-upload"
                >
                  {isMutating ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <UploadCloudIcon data-icon="inline-start" />}
                  {isMutating ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
                </Label>
                <input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isMutating}
                  id="house-images-upload"
                  multiple
                  name="images"
                  onChange={onFilesChange}
                  ref={inputRef}
                  type="file"
                />
              </>
            )}
          </div>
```

- [ ] **Step 5: Add checkbox overlay for select mode**

In the `visibleImages.map` render, compute:

```ts
                const isSelected = selectedImageIds.includes(image.id);
```

Pass an action that switches by mode:

```tsx
                    action={
                      canDelete ? (
                        selectMode ? (
                          <label className="flex size-7 items-center justify-center rounded-md bg-background/90 shadow-sm">
                            <input
                              aria-label={`เลือกรูป ${image.image_name ?? image.id}`}
                              checked={selectedImageIds.includes(image.id)}
                              className="size-4 accent-primary"
                              onChange={() => toggleSelectedImage(image.id)}
                              type="checkbox"
                            />
                          </label>
                        ) : (
                          <Button
                            className="size-7 bg-background/90"
                            onClick={() => setSingleDeleteImage(image)}
                            size="icon"
                            type="button"
                            variant="destructive"
                          >
                            <Trash2Icon data-icon="inline-start" />
                            <span className="sr-only">ลบรูป</span>
                          </Button>
                        )
                      ) : undefined
                    }
```

- [ ] **Step 6: Render the bulk delete dialog**

Add this near the single delete dialog:

```tsx
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูปที่เลือก</DialogTitle>
            <DialogDescription>
              รูปที่เลือก {selectedImageIds.length} รูปจะถูกลบออกจาก zone นี้หลังยืนยัน
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {visibleImages
              .filter((image) => selectedImageIds.includes(image.id))
              .map((image) => (
                <div className="flex items-center gap-3 rounded-md border p-2" key={image.id}>
                  <div className="size-14 overflow-hidden rounded bg-muted">
                    {displayUrl(image) ? (
                      <img
                        alt={image.image_name ?? "house image"}
                        className="h-full w-full object-cover"
                        src={displayUrl(image) ?? undefined}
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 truncate font-mono text-xs">{image.image_name ?? "-"}</span>
                </div>
              ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button disabled={isMutating || selectedImageIds.length === 0} onClick={confirmBulkDelete} type="button" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              ลบรูปที่เลือก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Reset selection on zone change**

Add this effect after the mobile scroll effect:

```ts
  useEffect(() => {
    setSelectMode(false);
    setSelectedImageIds([]);
  }, [selectedGroup.zone]);
```

- [ ] **Step 8: Run the targeted UI test**

Run:

```bash
npm run test -- tests/house-images-ui.test.ts
```

Expected: PASS for this test file.

- [ ] **Step 9: Commit**

```bash
git add -- components/admin/images/image-zone-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: add house image bulk delete mode"
```

---

### Task 7: Documentation Updates

**Files:**
- Modify: `docs/image-management.md`
- Modify: `docs/image-management/mvp-4-add-delete-image-records.md`
- Modify: `docs/image-management/mvp-5-external-provider-file-crud.md`

- [ ] **Step 1: Update `docs/image-management.md`**

Add this section after `## Storage Provider Policy`:

```md
## Current Admin Flow

- House image management is operation-based, not staged.
- Uploading one or more files starts immediately after file selection and targets the current image zone.
- Upload is all-or-nothing: if any file fails validation, storage upload, or database insert, the batch is not kept.
- Single-image delete requires a confirmation dialog with an image preview.
- Bulk delete requires entering select mode, selecting R2 images in the current zone, and confirming the selected set.
- Select all applies only to deletable R2 images in the current zone.
- AWS/S3 legacy images remain display-only and cannot be selected or deleted.
- Successful operations show a toast and refresh the image grid.
```

- [ ] **Step 2: Update `docs/image-management/mvp-4-add-delete-image-records.md`**

Replace the staged UI bullets under Storage Boundary:

```md
- MVP นี้ใช้ draft UI แบบ advertisement: เลือกรูป/ลบรูปในหน้า แล้วค่อยบันทึกพร้อมกัน
- Upload is exposed as the far-right action in the selected-zone header, while the image count remains in the left detail text; do not use a full-width upload drop zone.
- รูปใหม่ upload ไป Cloudflare R2 ตอน save แล้วเพิ่ม record ใน `images`
```

with:

```md
- House image management uses an operation-based UI instead of a staged save flow.
- Upload is exposed as the far-right action in the selected-zone header, while the image count remains in the left detail text; do not use a full-width upload drop zone.
- รูปใหม่ upload ไป Cloudflare R2 ทันทีหลังเลือกไฟล์ แล้วเพิ่ม record ใน `images`
- การลบรูปเดี่ยวต้องยืนยันพร้อม preview รูปก่อน
- การลบหลายรูปต้องเข้า select mode, เลือกรูปใน zone ปัจจุบัน, แล้วกดยืนยันลบ
```

Replace this rule:

```md
- Delete ต้องมี confirmation ถ้าเกี่ยวข้องกับไฟล์จริง
```

with:

```md
- Delete ต้องมี confirmation ก่อนเสมอ ทั้งลบเดี่ยวและลบหลายรูป
```

- [ ] **Step 3: Update `docs/image-management/mvp-5-external-provider-file-crud.md`**

Add these bullets under `## Provider Policy`:

```md
- Bulk delete is scoped to the current image zone in the admin UI.
- Select all includes only R2-managed images that can be deleted.
- R2 storage cleanup failures after a database delete are reported as warnings to the admin.
```

- [ ] **Step 4: Commit**

```bash
git add -- docs/image-management.md docs/image-management/mvp-4-add-delete-image-records.md docs/image-management/mvp-5-external-provider-file-crud.md
git commit -m "docs: update house image operation flow"
```

---

### Task 8: Full Verification And Polish

**Files:**
- Verify all modified implementation, test, and documentation files.

- [ ] **Step 1: Run house image focused tests**

Run:

```bash
npm run test -- tests/house-image-actions.test.ts tests/house-images-ui.test.ts tests/house-images.test.ts tests/house-image-storage.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Inspect changed files**

Run:

```bash
git diff --stat
```

Expected: Only files related to house image actions, image manager UI, tests, and docs are modified, plus any pre-existing unrelated user changes remain unstaged and untouched.

- [ ] **Step 6: Commit final verification fixes if needed**

If verification required code or test fixes, commit those exact files:

```bash
git add -- app/admin/houses/[propertyId]/images/actions.ts app/admin/houses/[propertyId]/images/page.tsx components/admin/images/image-zone-viewer.tsx server/repositories/images.ts tests/house-image-actions.test.ts tests/house-images-ui.test.ts docs/image-management.md docs/image-management/mvp-4-add-delete-image-records.md docs/image-management/mvp-5-external-provider-file-crud.md
git commit -m "fix: polish house image operation flow"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: upload immediate all-or-nothing is covered in Tasks 2 and 4; single delete confirmation is covered in Tasks 2 and 5; current-zone select all and bulk delete are covered in Task 6; R2-only provider policy is covered in Tasks 2, 5, 6, and 7; toast plus refresh feedback is covered in Tasks 4 through 6.
- Placeholder scan: the plan contains no deferred implementation markers and every code-changing step includes concrete code or exact replacement text.
- Type consistency: action result types in Task 2 match the props and toast handling planned in Tasks 4 through 6.
