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
    const pageSource = readFileSync(new URL("../app/admin/advertisements/page.tsx", import.meta.url), "utf8");

    assert.doesNotMatch(source, /SearchIcon/);
    assert.doesNotMatch(source, /SlidersHorizontalIcon/);
    assert.doesNotMatch(source, /name="q"/);
    assert.match(pageSource, /import \{ SearchIcon \} from "lucide-react"/);
    assert.match(pageSource, /<form className="mb-4 flex gap-2 md:max-w-sm">/);
    assert.match(pageSource, /name="q"/);
    assert.match(pageSource, /<Button className="shrink-0" type="submit">/);
    assert.match(pageSource, /<SearchIcon aria-hidden className="size-4" \/>/);
    assert.match(pageSource, /<Button className="shrink-0" type="submit">[\s\S]*?ค้นหา[\s\S]*?<\/Button>/);
    assert.match(pageSource, /const ADVERTISEMENT_PAGE_SIZE = 8/);
    assert.match(pageSource, /searchParams: Promise<\{ page\?: string; q\?: string \}>/);
    assert.match(pageSource, /const currentPage = normalizePage\(page\)/);
    assert.match(pageSource, /visibleAdvertisements\.slice/);
    assert.match(pageSource, /<Pagination[\s\S]*?basePath="\/admin\/advertisements"/);
    assert.match(source, /is_active/);
    assert.match(source, /advertisement_images/);
    assert.match(pageSource, /\/admin\/advertisements\/new/);
    assert.match(source, /ใช้งานอยู่/);
    assert.match(source, /ปิดใช้งาน/);
    assert.match(source, /md:hidden/);
    assert.match(source, /md:block/);
    assert.match(source, /<TableHead>ID<\/TableHead>/);
  });

  it("adds create and detail forms with immediate edit image operations", () => {
    assert.ok(existsSync(new URL("../app/admin/advertisements/new/page.tsx", import.meta.url)));
    assert.ok(existsSync(new URL("../app/admin/advertisements/[id]/page.tsx", import.meta.url)));

    const formSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-form.tsx", import.meta.url),
      "utf8",
    );
    const detailSource = readFileSync(
      new URL("../app/admin/advertisements/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    const newSource = readFileSync(
      new URL("../app/admin/advertisements/new/page.tsx", import.meta.url),
      "utf8",
    );
    const sharedCardSource = readFileSync(
      new URL("../components/admin/image-asset-card.tsx", import.meta.url),
      "utf8",
    );
    assert.match(formSource, /Card/);
    assert.doesNotMatch(formSource, /AspectRatio/);
    assert.match(formSource, /Separator/);
    assert.match(formSource, /Switch/);
    assert.match(formSource, /UploadCloudIcon/);
    assert.match(formSource, /URL\.createObjectURL/);
    assert.match(formSource, /URL\.revokeObjectURL/);
    assert.match(formSource, /resizeAdvertisementImageFile/);
    assert.match(formSource, /resizeToMax/);
    assert.match(formSource, /document\.createElement\("canvas"\)/);
    assert.match(formSource, /canvas\.toBlob/);
    assert.match(formSource, /isResizingImages/);
    assert.match(formSource, /resizeRunRef/);
    assert.match(formSource, /setIsResizingImages\(true\)/);
    assert.match(formSource, /setIsResizingImages\(false\)/);
    assert.match(formSource, /function appendPreviews\(files: File\[\]/);
    assert.match(formSource, /const nextPreviews = \[\.\.\.previewsRef\.current, \.\.\.newPreviews\]/);
    assert.match(formSource, /appendPreviews\(resizedFiles,\s*true\)/);
    assert.match(formSource, /syncInputFiles\(nextPreviews\.map\(\(preview\) => preview\.file\)\)/);
    const imagesInputBlock =
      formSource.match(/<(?:Input|input)[\s\S]*?name="images"[\s\S]*?type="file"[\s\S]*?\/>/)?.[0] ?? "";
    assert.match(imagesInputBlock, /^<input/);
    assert.match(imagesInputBlock, /className="sr-only"/);
    assert.doesNotMatch(imagesInputBlock, /image\/gif/);
    assert.match(formSource, /name="images"/);
    assert.match(formSource, /className="grid min-w-0 gap-5/);
    assert.match(formSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(18rem,26rem\)\]/);
    assert.match(formSource, /<Card className="min-w-0 h-fit lg:order-2">/);
    assert.match(formSource, /grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-\[auto_minmax\(0,1fr\)\] rounded-xl border bg-background/);
    assert.match(formSource, /lg:order-1/);
    assert.doesNotMatch(formSource, /lg:grid-cols-\[220px_1fr\] lg:grid-rows-1/);
    assert.doesNotMatch(formSource, /<aside className=/);
    assert.doesNotMatch(formSource, /aria-label="Advertisement images"/);
    assert.doesNotMatch(formSource, /ScrollArea className="w-full min-w-0 lg:h-full"/);
    assert.match(formSource, /buttonVariants\(\{ variant: "outline", size: "sm" \}\)/);
    assert.match(formSource, /id="advertisement-images-upload"/);
    assert.match(formSource, /เลือกทั้งหมด/);
    assert.match(formSource, /ลบที่เลือก \(\{selectedBulkDeleteImages\.length\}\)/);
    assert.match(formSource, /import \{ AdminImageCard/);
    assert.match(formSource, /created_at\?: string \| null/);
    assert.match(formSource, /updated_at\?: string \| null/);
    assert.doesNotMatch(formSource, /formatThaiImageDateTime/);
    assert.match(detailSource, /created_at: image\.created_at/);
    assert.match(detailSource, /updated_at: image\.updated_at/);
    assert.match(sharedCardSource, /CardContent className="flex flex-col gap-1 p-2"/);
    assert.doesNotMatch(formSource, /<Card className="relative w-full max-w-36 gap-0 overflow-hidden border-dashed p-0 sm:max-w-40" size="sm">/);
    assert.match(sharedCardSource, /cursor-zoom-in/);
    assert.match(formSource, /<div className="grid min-h-0 min-w-0 grid-rows-\[minmax\(0,1fr\)\] gap-3 p-2">/);
    assert.match(
      formSource,
      /className="grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\] items-start justify-center gap-3 p-3 sm:grid-cols-\[repeat\(auto-fill,minmax\(10rem,10rem\)\)\]"/,
    );
    assert.doesNotMatch(formSource, /sm:grid-cols-2/);
    assert.doesNotMatch(formSource, /min-h-44/);
    assert.match(formSource, /pb-20 lg:pb-0/);
    assert.match(formSource, /import \{ toast \} from "sonner"/);
    assert.match(formSource, /useRouter/);
    assert.match(formSource, /useTransition/);
    assert.match(
      formSource,
      /type AdvertisementUploadQueueStatus =\s*\|\s*"pending-resize"\s*\|\s*"resizing"\s*\|\s*"pending-upload"\s*\|\s*"uploading"\s*\|\s*"uploaded"\s*\|\s*"failed";/,
    );
    assert.match(
      formSource,
      /type AdvertisementBulkDeleteQueueStatus =\s*\|\s*"pending"\s*\|\s*"deleting"\s*\|\s*"deleted"\s*\|\s*"failed";/,
    );
    assert.match(formSource, /failedUploadItems/);
    assert.match(formSource, /createdAdvertisementId/);
    assert.match(formSource, /createUploadAction\?: \(id: string, formData: FormData\) => Promise<\{ uploadedCount: number \}>/);
    assert.match(formSource, /formData\.delete\("images"\)/);
    assert.match(formSource, /createUploadAction\(advertisementId, formData\)/);
    assert.match(formSource, /\/admin\/advertisements\/\$\{encodeURIComponent\(advertisementId\)\}\?created=1/);
    assert.match(formSource, /async function processUploadQueueItem/);
    assert.match(formSource, /await queueUploadAction\(formData\)/);
    assert.match(formSource, /status === "resizing" \? "กำลังเตรียมรูป" : "กำลังอัปโหลด"/);
    assert.match(formSource, /toast\.loading\(`\$\{label\} \$\{current\}\/\$\{total\}`/);
    assert.match(formSource, /function retryFailedUploads/);
    assert.match(formSource, /singleDeleteImage/);
    assert.match(formSource, /DialogTitle>ยืนยันการลบรูปโฆษณา/);
    assert.match(formSource, /bulkDeleteQueue/);
    assert.match(
      formSource,
      /function bulkDeleteStatusLabel\(\s*status: AdvertisementBulkDeleteQueueStatus,\s*\)/,
    );
    assert.match(formSource, /async function processBulkDeleteQueueItem/);
    assert.match(formSource, /await deleteAction\(item\.image\.id\)/);
    assert.match(formSource, /toast\.loading\(`กำลังลบ \$\{current\}\/\$\{total\}`/);
    assert.match(formSource, /function retryFailedBulkDeletes/);
    assert.match(formSource, /onClick=\{\(\) => retryFailedBulkDeletes\(\[item\.id\]\)\}/);
    assert.doesNotMatch(formSource, /bulkDeleteAction/);
    assert.match(formSource, /Alert/);
    assert.match(formSource, /disabled=\{!isDirty \|\| isBusy\}/);
    assert.match(
      formSource,
      /<Button\s+className="flex-1 lg:flex-none"\s+disabled=\{!isDirty \|\| isBusy\}\s+type="submit"\s*>/,
    );
    assert.match(formSource, /Trash2Icon/);
    assert.match(formSource, /CheckIcon/);
    assert.match(sharedCardSource, /absolute right-1 z-20/);
    assert.match(sharedCardSource, /actionPlacement === "top-right"/);
    assert.doesNotMatch(formSource, /AdvertisementImagePreviewDialog/);
    assert.doesNotMatch(formSource, /function ImageSlotCard/);
    assert.doesNotMatch(formSource, /DeleteAdvertisementImageButton/);
    assert.doesNotMatch(formSource, /actionPlacement="top-right"/);
    assert.match(formSource, /ตั้งค่าโฆษณา/);
    assert.match(formSource, /รูปภาพโฆษณา/);
    assert.doesNotMatch(formSource, /สล๊อตที่\s*\{/);
    assert.doesNotMatch(formSource, /โฆษณาต้องมีรูปอย่างน้อย 1 รูป/);
    assert.doesNotMatch(formSource, /โฆษณาต้องเหลือรูปอย่างน้อย 1 รูป/);
    assert.doesNotMatch(formSource, /required=\{mode === "create" && totalImages === 0\}/);
    assert.doesNotMatch(formSource, /encType=/);
    assert.doesNotMatch(formSource, /method=/);

    const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    assert.match(nextConfigSource, /experimental/);
    assert.match(nextConfigSource, /serverActions/);
    assert.match(nextConfigSource, /bodySizeLimit:\s*"10mb"/);

    assert.match(
      sharedCardSource,
      /DialogContent className="w-\[calc\(100vw-0\.5rem\)\] max-w-7xl gap-3 p-3 sm:w-\[calc\(100vw-2rem\)\] sm:max-w-7xl sm:p-4"/,
    );
    assert.match(sharedCardSource, /<DialogTrigger asChild>/);
    assert.match(sharedCardSource, /<button/);
    assert.match(sharedCardSource, /className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring\/50"/);
    assert.match(sharedCardSource, /DialogHeader className="min-w-0 pr-8"/);
    assert.match(sharedCardSource, /<div className="min-w-0 overflow-hidden rounded-lg bg-muted">/);
    assert.match(sharedCardSource, /<img/);
    assert.match(sharedCardSource, /className="h-auto max-h-\[82dvh\] w-full object-contain"/);
    assert.doesNotMatch(sharedCardSource, /EyeIcon/);
    assert.doesNotMatch(sharedCardSource, /<Button/);
    assert.doesNotMatch(sharedCardSource, /next\/image/);

    const actionsSource = readFileSync(
      new URL("../app/admin/advertisements/actions.ts", import.meta.url),
      "utf8",
    );
    assert.match(actionsSource, /export async function uploadAdvertisementImagesAction/);
    assert.match(actionsSource, /uploadedCount/);
    assert.match(actionsSource, /return \{ advertisementId \}/);
    const createActionSource =
      actionsSource.match(/export async function createAdvertisementAction[\s\S]*?export async function updateAdvertisementAction/)?.[0] ?? "";
    assert.doesNotMatch(createActionSource, /getImageFiles/);
    assert.doesNotMatch(createActionSource, /uploadAdvertisementImageObject/);
    assert.doesNotMatch(createActionSource, /redirect/);
    assert.match(actionsSource, /export async function deleteAdvertisementImageAction/);
    assert.match(actionsSource, /deletedId/);
    assert.match(actionsSource, /cleanupWarning/);
    assert.match(actionsSource, /validateAdvertisementImageEditCount/);
    assert.match(actionsSource, /getAvailableAdvertisementImageOrders/);
    assert.doesNotMatch(actionsSource, /deleteAdvertisementImagesAction/);

    assert.match(detailSource, /uploadAdvertisementImagesAction/);
    assert.match(detailSource, /deleteAdvertisementImageAction/);
    assert.match(detailSource, /uploadAction=\{uploadAdvertisementImagesAction\.bind\(null, advertisement\.id\)\}/);
    assert.match(detailSource, /deleteAction=\{deleteAdvertisementImageAction\}/);
    assert.match(newSource, /uploadAdvertisementImagesAction/);
    assert.match(newSource, /createUploadAction=\{uploadAdvertisementImagesAction\}/);
  });

  it("shows a shadcn sonner toast after creating or saving an advertisement", () => {
    assert.ok(
      existsSync(
        new URL("../components/admin/advertisements/advertisement-save-notification.tsx", import.meta.url),
      ),
    );
    assert.ok(existsSync(new URL("../components/ui/sonner.tsx", import.meta.url)));

    const actionsSource = readFileSync(
      new URL("../app/admin/advertisements/actions.ts", import.meta.url),
      "utf8",
    );
    const formSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-form.tsx", import.meta.url),
      "utf8",
    );
    assert.match(formSource, /created=1/);
    assert.match(actionsSource, /saved=1/);

    const detailSource = readFileSync(
      new URL("../app/admin/advertisements/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(detailSource, /searchParams/);
    assert.match(detailSource, /saveToastTitle/);
    assert.match(detailSource, /AdvertisementSaveNotification/);

    const shellSource = readFileSync(
      new URL("../components/layout/admin-shell.tsx", import.meta.url),
      "utf8",
    );
    assert.match(shellSource, /Toaster/);
    assert.match(shellSource, /components\/ui\/sonner|\.\.\/ui\/sonner/);

    const notificationSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-save-notification.tsx", import.meta.url),
      "utf8",
    );
    assert.match(notificationSource, /toast\.success\(title\)/);
    assert.doesNotMatch(notificationSource, /description/);
    assert.doesNotMatch(notificationSource, /id:/);

    const sonnerSource = readFileSync(new URL("../components/ui/sonner.tsx", import.meta.url), "utf8");
    assert.match(sonnerSource, /className="toaster group"/);
    assert.match(sonnerSource, /position="top-center"/);
    assert.doesNotMatch(sonnerSource, /richColors/);
    assert.doesNotMatch(sonnerSource, /toastOptions/);
  });
});
