# House Image Upload Queue And Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-image upload queue that rejects GIF, resizes/compresses house images before upload, uploads one file at a time or in small batches, and shows per-file progress with retry.

**Architecture:** This plan is Phase 2 and should start only after the main house image operation-flow plan is complete. It builds on `uploadHouseImagesAction` from the operation-based flow, but changes the client to queue selected files, resize each image to WebP before upload, and submit one resized file per server action call in the MVP. Server validation remains authoritative and rejects GIF even if the client is bypassed.

**Tech Stack:** Next.js App Router, React 19, TypeScript, browser `createImageBitmap`/`canvas`, `sonner`, existing shadcn/ui primitives, existing house image server actions, Node test runner.

---

## Prerequisites

- The operation-based house image flow is already implemented:
  - `uploadHouseImagesAction(propertyId, formData)` exists.
  - `ImageZoneViewer` uploads immediately without a staged save bar.
  - Toast notifications and `router.refresh()` are already available in the image manager.
- Do not add new npm dependencies for the MVP.
- Do not support animated GIF. GIF upload is removed from both client and server validation.

## Decisions

- GIF is unsupported and must be rejected.
- Admins can select many files at once.
- Files are resized/compressed on the client before upload.
- MVP upload concurrency is `1` file at a time to avoid large combined request bodies.
- Each resized file is uploaded with a separate `uploadHouseImagesAction` call.
- The flow uses partial success:
  - Successful images stay saved.
  - Failed images remain in the queue.
  - Failed images can be retried.
- Resize output:
  - MIME type: `image/webp`
  - Quality: `0.82`
  - Max long edge: `1920px`
- Original input limit:
  - Reject files above `20MB` before resizing.
- Server upload limit:
  - Keep the existing server-side per-file size validation, applied after resize.

## File Structure

- Create `lib/house-image-resize.ts`
  - Browser-only resize helper.
  - Converts accepted image files into WebP `File` objects.
  - Rejects GIF.
  - Reports original size, resized size, width, and height.

- Modify `server/services/images.ts`
  - Remove GIF from supported house image MIME types if GIF is currently accepted through shared helpers.
  - Add or reuse a house-specific accepted MIME list if advertisement images still need a different policy.

- Modify `components/admin/images/image-zone-viewer.tsx`
  - Replace direct immediate multi-file upload with upload queue creation.
  - Resize queue items client-side.
  - Upload each resized file through `uploadHouseImagesAction`.
  - Show per-file status, size reduction, errors, retry, remove, and summary.

- Modify `tests/house-images.test.ts`
  - Assert GIF is rejected for house images.
  - Assert JPEG/PNG/WebP remain accepted.

- Create `tests/house-image-resize.test.ts`
  - Source-level tests for resize helper contract, because Node test runner does not provide browser canvas APIs.

- Modify `tests/house-images-ui.test.ts`
  - Assert queue statuses, retry controls, GIF rejection messaging, one-file upload calls, and resize helper usage.

- Modify `docs/image-management.md`
  - Document the upload queue, resize policy, GIF removal, and partial success behavior.

- Modify `docs/image-management/mvp-4-add-delete-image-records.md`
  - Update upload behavior from immediate batch upload to queued resized upload.

- Modify `docs/image-management/mvp-5-external-provider-file-crud.md`
  - Clarify that resized WebP files are the new upload payload for house images.

---

### Task 1: House Image GIF Rejection Policy

**Files:**
- Modify: `server/services/images.ts`
- Modify: `tests/house-images.test.ts`

- [ ] **Step 1: Write the failing GIF rejection test**

In `tests/house-images.test.ts`, add this assertion inside the existing test named `validates files, zones, and builds R2 image names`, after the unsupported text file assertion:

```ts
    assert.throws(
      () => validateHouseImageFile(new File(["gif"], "animated.gif", { type: "image/gif" })),
      /Unsupported image type/,
    );
```

- [ ] **Step 2: Run the targeted test and verify it fails if GIF is currently accepted**

Run:

```bash
npm.cmd run test -- tests/house-images.test.ts
```

Expected: FAIL if house images currently accept `image/gif`; PASS if GIF was already blocked elsewhere.

- [ ] **Step 3: Update house image MIME validation**

In `server/services/images.ts`, add a house-specific MIME set near `HOUSE_MAX_IMAGE_BYTES`:

```ts
const supportedHouseImageMimeTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
```

Then change `validateHouseImageFile` from:

```ts
export function validateHouseImageFile(file: File): File {
  if (!isSupportedImageMimeType(file.type)) throw new Error("Unsupported image type");
  if (file.size > HOUSE_MAX_IMAGE_BYTES) throw new Error("House image is too large");
  return file;
}
```

to:

```ts
export function validateHouseImageFile(file: File): File {
  if (!supportedHouseImageMimeTypes.has(file.type)) throw new Error("Unsupported image type");
  if (file.size > HOUSE_MAX_IMAGE_BYTES) throw new Error("House image is too large");
  return file;
}
```

Keep `isSupportedImageMimeType` imported if other functions in the file still use it. Remove it from the import list only if it becomes unused.

- [ ] **Step 4: Run the targeted test again**

Run:

```bash
npm.cmd run test -- tests/house-images.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- server/services/images.ts tests/house-images.test.ts
git commit -m "feat: reject gif house image uploads"
```

---

### Task 2: Browser Resize Helper

**Files:**
- Create: `lib/house-image-resize.ts`
- Create: `tests/house-image-resize.test.ts`

- [ ] **Step 1: Write source-level helper tests**

Create `tests/house-image-resize.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../lib/house-image-resize.ts", import.meta.url), "utf8");

describe("house image resize helper", () => {
  it("defines the house image resize policy", () => {
    assert.match(source, /export const HOUSE_IMAGE_MAX_ORIGINAL_BYTES = 20 \* 1024 \* 1024/);
    assert.match(source, /export const HOUSE_IMAGE_RESIZE_MAX_EDGE = 1920/);
    assert.match(source, /export const HOUSE_IMAGE_WEBP_QUALITY = 0\.82/);
    assert.match(source, /image\/webp/);
    assert.match(source, /createImageBitmap/);
    assert.match(source, /canvas\.toBlob/);
  });

  it("rejects gif and unsupported files before resizing", () => {
    assert.match(source, /image\/gif/);
    assert.match(source, /Unsupported image type/);
    assert.match(source, /House image is too large/);
    assert.match(source, /supportedHouseResizeInputTypes/);
  });

  it("returns a resized File with size and dimension metadata", () => {
    assert.match(source, /export interface ResizedHouseImage/);
    assert.match(source, /originalSize/);
    assert.match(source, /resizedSize/);
    assert.match(source, /width/);
    assert.match(source, /height/);
    assert.match(source, /new File\(\[blob\], outputName/);
  });
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npm.cmd run test -- tests/house-image-resize.test.ts
```

Expected: FAIL because `lib/house-image-resize.ts` does not exist.

- [ ] **Step 3: Create the resize helper**

Create `lib/house-image-resize.ts`:

```ts
export const HOUSE_IMAGE_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const HOUSE_IMAGE_RESIZE_MAX_EDGE = 1920;
export const HOUSE_IMAGE_WEBP_QUALITY = 0.82;

const supportedHouseResizeInputTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ResizedHouseImage {
  file: File;
  height: number;
  originalSize: number;
  resizedSize: number;
  width: number;
}

function outputFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "house-image";
  return `${baseName}.webp`;
}

function scaledDimensions(width: number, height: number) {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= HOUSE_IMAGE_RESIZE_MAX_EDGE) return { height, width };

  const scale = HOUSE_IMAGE_RESIZE_MAX_EDGE / maxEdge;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to resize image"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      HOUSE_IMAGE_WEBP_QUALITY,
    );
  });
}

export async function resizeHouseImageFile(file: File): Promise<ResizedHouseImage> {
  if (file.type === "image/gif") throw new Error("Unsupported image type");
  if (!supportedHouseResizeInputTypes.has(file.type)) throw new Error("Unsupported image type");
  if (file.size > HOUSE_IMAGE_MAX_ORIGINAL_BYTES) throw new Error("House image is too large");

  const bitmap = await createImageBitmap(file);
  const { height, width } = scaledDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Failed to resize image");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToWebpBlob(canvas);
  const outputName = outputFileName(file.name);
  const resizedFile = new File([blob], outputName, {
    lastModified: Date.now(),
    type: "image/webp",
  });

  return {
    file: resizedFile,
    height,
    originalSize: file.size,
    resizedSize: resizedFile.size,
    width,
  };
}
```

- [ ] **Step 4: Run the targeted test again**

Run:

```bash
npm.cmd run test -- tests/house-image-resize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- lib/house-image-resize.ts tests/house-image-resize.test.ts
git commit -m "feat: add house image resize helper"
```

---

### Task 3: Upload Queue State And UI

**Files:**
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing queue UI assertions**

Add this test to `tests/house-images-ui.test.ts`:

```ts
  it("shows a per-file upload queue with resize and retry states", () => {
    assert.match(source, /resizeHouseImageFile/);
    assert.match(source, /UploadQueueItem/);
    assert.match(source, /status: "pending-resize"/);
    assert.match(source, /"resizing"/);
    assert.match(source, /"pending-upload"/);
    assert.match(source, /"uploading"/);
    assert.match(source, /"uploaded"/);
    assert.match(source, /"failed"/);
    assert.match(source, /uploadQueue/);
    assert.match(source, /retryFailedUploads/);
    assert.match(source, /removeUploadQueueItem/);
    assert.match(source, /อัปโหลดแล้ว/);
    assert.match(source, /ลองใหม่เฉพาะรูปที่ไม่สำเร็จ/);
    assert.match(source, /ขนาดเดิม/);
    assert.match(source, /หลังแปลง/);
  });
```

- [ ] **Step 2: Run the targeted UI test and verify it fails**

Run:

```bash
npm.cmd run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because the queue UI is not implemented yet.

- [ ] **Step 3: Import resize helper**

In `components/admin/images/image-zone-viewer.tsx`, add:

```ts
import {
  resizeHouseImageFile,
  type ResizedHouseImage,
} from "../../../lib/house-image-resize";
```

- [ ] **Step 4: Add queue types**

Add these types near the top of `components/admin/images/image-zone-viewer.tsx`:

```ts
type UploadQueueStatus =
  | "pending-resize"
  | "resizing"
  | "pending-upload"
  | "uploading"
  | "uploaded"
  | "failed";

interface UploadQueueItem {
  error?: string;
  file: File;
  id: string;
  previewSrc: string;
  resized?: ResizedHouseImage;
  status: UploadQueueStatus;
}
```

- [ ] **Step 5: Add queue state**

Inside `ImageZoneViewer`, add:

```ts
  const queuePreviewsRef = useRef<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
```

Add cleanup:

```ts
  useEffect(() => {
    return () => {
      for (const src of queuePreviewsRef.current) {
        URL.revokeObjectURL(src);
      }
    };
  }, []);
```

- [ ] **Step 6: Add queue helpers**

Add:

```ts
  function updateUploadQueueItem(id: string, updates: Partial<UploadQueueItem>) {
    setUploadQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removeUploadQueueItem(id: string) {
    setUploadQueue((items) => {
      const item = items.find((queueItem) => queueItem.id === id);
      if (item) URL.revokeObjectURL(item.previewSrc);
      queuePreviewsRef.current = queuePreviewsRef.current.filter((src) => src !== item?.previewSrc);
      return items.filter((queueItem) => queueItem.id !== id);
    });
  }

  function queueItemsForFiles(files: File[]) {
    const items = files.map((file) => {
      const previewSrc = URL.createObjectURL(file);
      queuePreviewsRef.current.push(previewSrc);
      return {
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        previewSrc,
        status: "pending-resize" as const,
      };
    });

    setUploadQueue((existing) => [...existing, ...items]);
    return items;
  }
```

- [ ] **Step 7: Render queue panel**

Add this JSX under the image grid container:

```tsx
          {uploadQueue.length > 0 ? (
            <section className="border-t bg-background px-3 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  อัปโหลดแล้ว {uploadQueue.filter((item) => item.status === "uploaded").length}/{uploadQueue.length} รูป
                </p>
                <Button
                  disabled={!uploadQueue.some((item) => item.status === "failed")}
                  onClick={retryFailedUploads}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  ลองใหม่เฉพาะรูปที่ไม่สำเร็จ
                </Button>
              </div>
              <div className="grid gap-2">
                {uploadQueue.map((item) => (
                  <div className="flex items-center gap-3 rounded-md border p-2" key={item.id}>
                    <img alt={item.file.name} className="size-14 rounded object-cover" src={item.previewSrc} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {uploadQueueStatusLabel(item.status)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ขนาดเดิม {formatFileSize(item.file.size)}
                        {item.resized ? ` → หลังแปลง ${formatFileSize(item.resized.resizedSize)}` : ""}
                      </p>
                      {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                    </div>
                    {item.status === "failed" || item.status === "uploaded" ? (
                      <Button onClick={() => removeUploadQueueItem(item.id)} size="sm" type="button" variant="ghost">
                        นำออก
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
```

Add label helper:

```ts
function uploadQueueStatusLabel(status: UploadQueueStatus): string {
  switch (status) {
    case "pending-resize":
      return "รอแปลงรูป";
    case "resizing":
      return "กำลังแปลง";
    case "pending-upload":
      return "รออัปโหลด";
    case "uploading":
      return "กำลังอัปโหลด";
    case "uploaded":
      return "สำเร็จ";
    case "failed":
      return "ไม่สำเร็จ";
  }
}
```

- [ ] **Step 8: Run targeted UI test**

Run:

```bash
npm.cmd run test -- tests/house-images-ui.test.ts
```

Expected: Queue UI assertions pass or fail only on upload orchestration not yet implemented.

- [ ] **Step 9: Commit**

```bash
git add -- components/admin/images/image-zone-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: show house image upload queue"
```

---

### Task 4: Queue Orchestration With One-File Uploads

**Files:**
- Modify: `components/admin/images/image-zone-viewer.tsx`
- Modify: `tests/house-images-ui.test.ts`

- [ ] **Step 1: Write failing orchestration assertions**

Add this test to `tests/house-images-ui.test.ts`:

```ts
  it("resizes then uploads queued files one at a time", () => {
    assert.match(source, /async function processUploadQueueItem/);
    assert.match(source, /await resizeHouseImageFile\(item\.file\)/);
    assert.match(source, /formData\.append\("images", resized\.file\)/);
    assert.match(source, /await uploadAction\(formData\)/);
    assert.match(source, /for \(const item of items\)/);
    assert.doesNotMatch(source, /for \(const file of files\) {\s*formData\.append\("images", file\)/);
    assert.match(source, /status: "uploaded"/);
    assert.match(source, /status: "failed"/);
  });
```

- [ ] **Step 2: Run targeted UI test and verify it fails**

Run:

```bash
npm.cmd run test -- tests/house-images-ui.test.ts
```

Expected: FAIL because queue processing still does not exist.

- [ ] **Step 3: Replace direct upload with queue processing**

Replace the current `uploadSelectedFiles` implementation with:

```ts
  async function processUploadQueueItem(item: UploadQueueItem) {
    try {
      updateUploadQueueItem(item.id, { error: undefined, status: "resizing" });
      const resized = await resizeHouseImageFile(item.file);

      updateUploadQueueItem(item.id, { resized, status: "pending-upload" });

      const formData = new FormData();
      formData.append("image_zone", selectedGroup.zone);
      formData.append("images", resized.file);

      updateUploadQueueItem(item.id, { status: "uploading" });
      await uploadAction(formData);
      updateUploadQueueItem(item.id, { resized, status: "uploaded" });
    } catch (error) {
      updateUploadQueueItem(item.id, {
        error: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ",
        status: "failed",
      });
    }
  }

  function uploadSelectedFiles(files: File[]) {
    if (files.length === 0) return;
    const items = queueItemsForFiles(files);

    startMutationTransition(async () => {
      for (const item of items) {
        await processUploadQueueItem(item);
      }

      const failedCount = items.filter((item) => item.status === "failed").length;
      if (failedCount > 0) {
        toast.warning(`อัปโหลดเสร็จบางส่วน มีรูปไม่สำเร็จ ${failedCount} รูป`);
      } else {
        toast.success(`อัปโหลดรูปแล้ว ${items.length} รูป`);
      }
      router.refresh();
    });
  }
```

Important correction: because `items` is the original array and React state updates are async, compute final failures from queue item ids after processing:

```ts
      let failedCount = 0;
      for (const item of items) {
        await processUploadQueueItem(item).catch(() => {
          failedCount += 1;
        });
      }
```

Use this version of `processUploadQueueItem` if you need thrown errors to count failures:

```ts
  async function processUploadQueueItem(item: UploadQueueItem) {
    try {
      updateUploadQueueItem(item.id, { error: undefined, status: "resizing" });
      const resized = await resizeHouseImageFile(item.file);
      updateUploadQueueItem(item.id, { resized, status: "pending-upload" });

      const formData = new FormData();
      formData.append("image_zone", selectedGroup.zone);
      formData.append("images", resized.file);

      updateUploadQueueItem(item.id, { status: "uploading" });
      await uploadAction(formData);
      updateUploadQueueItem(item.id, { resized, status: "uploaded" });
    } catch (error) {
      updateUploadQueueItem(item.id, {
        error: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ",
        status: "failed",
      });
      throw error;
    }
  }
```

- [ ] **Step 4: Add retry failed uploads**

Add:

```ts
  function retryFailedUploads() {
    const failedItems = uploadQueue.filter((item) => item.status === "failed");
    if (failedItems.length === 0) return;

    startMutationTransition(async () => {
      let failedCount = 0;
      for (const item of failedItems) {
        try {
          await processUploadQueueItem(item);
        } catch {
          failedCount += 1;
        }
      }

      if (failedCount > 0) {
        toast.warning(`ลองใหม่แล้ว ยังมีรูปไม่สำเร็จ ${failedCount} รูป`);
      } else {
        toast.success("อัปโหลดรูปที่ไม่สำเร็จครบแล้ว");
      }
      router.refresh();
    });
  }
```

- [ ] **Step 5: Update file input accept list**

Change:

```tsx
accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
```

to:

```tsx
accept="image/avif,image/jpeg,image/png,image/webp"
```

- [ ] **Step 6: Run targeted UI test**

Run:

```bash
npm.cmd run test -- tests/house-images-ui.test.ts
```

Expected: PASS for queue-related assertions.

- [ ] **Step 7: Commit**

```bash
git add -- components/admin/images/image-zone-viewer.tsx tests/house-images-ui.test.ts
git commit -m "feat: process house image upload queue"
```

---

### Task 5: Documentation Updates

**Files:**
- Modify: `docs/image-management.md`
- Modify: `docs/image-management/mvp-4-add-delete-image-records.md`
- Modify: `docs/image-management/mvp-5-external-provider-file-crud.md`

- [ ] **Step 1: Update `docs/image-management.md`**

Add these bullets under the current admin flow section:

```md
- House image upload uses a client-side queue.
- GIF is not supported for house image upload.
- Selected files are resized to WebP before upload.
- Resize target: max long edge 1920px, WebP quality 0.82.
- Upload requests are sent one file at a time in the MVP to avoid large combined request bodies.
- Upload uses partial success: successful files stay saved, failed files remain in the queue for retry.
```

- [ ] **Step 2: Update `docs/image-management/mvp-4-add-delete-image-records.md`**

Add this under Storage Boundary:

```md
- Multi-file selection is allowed, but the client processes files through an upload queue.
- Each queued file is resized/compressed to WebP before upload.
- The MVP sends one resized file per upload request.
- GIF files are rejected and are not part of the supported house image upload formats.
```

- [ ] **Step 3: Update `docs/image-management/mvp-5-external-provider-file-crud.md`**

Add this under Provider Policy:

```md
- New house image uploads should arrive at the server as resized WebP files from the admin client.
- Server validation remains authoritative and rejects unsupported types, including GIF.
- Upload queue partial failures are shown to the admin and can be retried per failed image.
```

- [ ] **Step 4: Commit**

```bash
git add -- docs/image-management.md docs/image-management/mvp-4-add-delete-image-records.md docs/image-management/mvp-5-external-provider-file-crud.md
git commit -m "docs: document house image upload queue"
```

---

### Task 6: Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm.cmd run test -- tests/house-images.test.ts tests/house-image-resize.test.ts tests/house-images-ui.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm.cmd run test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 5: Commit verification fixes if needed**

If fixes were required, commit only the changed files from this phase:

```bash
git add -- lib/house-image-resize.ts components/admin/images/image-zone-viewer.tsx server/services/images.ts tests/house-images.test.ts tests/house-image-resize.test.ts tests/house-images-ui.test.ts docs/image-management.md docs/image-management/mvp-4-add-delete-image-records.md docs/image-management/mvp-5-external-provider-file-crud.md
git commit -m "fix: polish house image upload queue"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Notes

- GIF removal is covered in Tasks 1, 4, and 5.
- Resize/compress is covered in Task 2 and integrated into the UI in Task 4.
- Multi-select upload with one-file requests is covered in Tasks 3 and 4.
- Partial success and retry are covered in Tasks 3 and 4.
- Documentation is covered in Task 5.
- Verification is covered in Task 6.
