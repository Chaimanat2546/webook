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
    assert.match(source, /SearchIcon/);
    assert.match(source, /SlidersHorizontalIcon/);
    assert.match(source, /is_active/);
    assert.match(source, /advertisement_images/);
    assert.match(source, /\/admin\/advertisements\/new/);
    assert.match(source, /ใช้งานอยู่/);
    assert.match(source, /ปิดใช้งาน/);
    assert.match(source, /md:hidden/);
    assert.match(source, /md:block/);
  });

  it("adds create and detail forms with draft previews and delete confirmation", () => {
    assert.ok(existsSync(new URL("../app/admin/advertisements/new/page.tsx", import.meta.url)));
    assert.ok(existsSync(new URL("../app/admin/advertisements/[id]/page.tsx", import.meta.url)));

    const formSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-form.tsx", import.meta.url),
      "utf8",
    );
    assert.match(formSource, /Card/);
    assert.match(formSource, /AspectRatio/);
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
    assert.match(formSource, /replacePreviews\(resizedFiles,\s*true\)/);
    assert.match(formSource, /1080px/);
    const imagesInputBlock =
      formSource.match(/<(?:Input|input)[\s\S]*?name="images"[\s\S]*?type="file"[\s\S]*?\/>/)?.[0] ?? "";
    assert.match(imagesInputBlock, /^<input/);
    assert.match(imagesInputBlock, /className="sr-only"/);
    assert.match(formSource, /name="images"/);
    assert.match(formSource, /className="grid min-w-0 gap-5/);
    assert.match(formSource, /lg:grid-cols-\[minmax\(18rem,26rem\)_minmax\(0,1fr\)\]/);
    assert.match(formSource, /<div className="min-w-0 flex-1">/);
    assert.match(formSource, /cursor-pointer/);
    assert.doesNotMatch(formSource, /cursor-zoom-in/);
    assert.match(formSource, /<CardContent className="grid min-w-0 gap-4 p-4"/);
    assert.match(
      formSource,
      /className="grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\] items-start justify-start gap-2 sm:grid-cols-\[repeat\(auto-fill,minmax\(10rem,10rem\)\)\]"/,
    );
    assert.doesNotMatch(formSource, /sm:grid-cols-2/);
    assert.doesNotMatch(formSource, /min-h-44/);
    assert.match(formSource, /pb-20 lg:pb-0/);
    assert.match(formSource, /deleted_image_ids/);
    assert.match(formSource, /deletedImageIds/);
    assert.match(formSource, /Alert/);
    assert.match(formSource, /disabled=\{!isDirty\}/);
    assert.match(
      formSource,
      /<Button\s+className="flex-1 lg:flex-none"\s+disabled=\{!isDirty \|\| isResizingImages\}\s+type="submit"/,
    );
    assert.match(formSource, /Trash2Icon/);
    assert.match(formSource, /<div className="absolute right-2 top-2 z-20">/);
    assert.match(formSource, /<\/CardContent>\s*\{src \? \(\s*<AdvertisementImagePreviewDialog/);
    assert.doesNotMatch(formSource, /DeleteAdvertisementImageButton/);
    assert.match(formSource, /ตั้งค่าโฆษณา/);
    assert.match(formSource, /รูปภาพโฆษณา/);
    assert.match(formSource, /สล๊อตที่\s*\{/);
    assert.doesNotMatch(formSource, /encType=/);
    assert.doesNotMatch(formSource, /method=/);

    const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    assert.match(nextConfigSource, /experimental/);
    assert.match(nextConfigSource, /serverActions/);
    assert.match(nextConfigSource, /bodySizeLimit:\s*"10mb"/);

    const previewSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-image-preview-dialog.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      previewSource,
      /DialogContent className="w-\[calc\(100vw-0\.5rem\)\] max-w-7xl gap-3 p-3 sm:w-\[calc\(100vw-2rem\)\] sm:max-w-7xl sm:p-4"/,
    );
    assert.match(previewSource, /<DialogTrigger asChild>/);
    assert.match(previewSource, /<button/);
    assert.match(previewSource, /className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring\/50"/);
    assert.match(previewSource, /DialogHeader className="min-w-0 pr-8"/);
    assert.match(previewSource, /<div className="min-w-0 overflow-hidden rounded-lg bg-muted">/);
    assert.match(previewSource, /<img/);
    assert.match(previewSource, /className="h-auto max-h-\[82dvh\] w-full object-contain"/);
    assert.doesNotMatch(previewSource, /EyeIcon/);
    assert.doesNotMatch(previewSource, /<Button/);
    assert.doesNotMatch(previewSource, /next\/image/);

    const actionsSource = readFileSync(
      new URL("../app/admin/advertisements/actions.ts", import.meta.url),
      "utf8",
    );
    assert.match(actionsSource, /deleted_image_ids/);
    assert.match(actionsSource, /validateAdvertisementImageEditCount/);
    assert.match(actionsSource, /getAvailableAdvertisementImageOrders/);
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
    assert.match(actionsSource, /created=1/);
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
