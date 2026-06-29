import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/images/image-zone-viewer.tsx", import.meta.url),
  "utf8",
);
const sharedCardPath = new URL(
  "../components/admin/image-asset-card.tsx",
  import.meta.url,
);
const sharedCardSource = existsSync(sharedCardPath)
  ? readFileSync(sharedCardPath, "utf8")
  : "";
const loadingSource = readFileSync(
  new URL("../app/admin/houses/[propertyId]/images/loading.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../app/admin/houses/[propertyId]/images/page.tsx", import.meta.url),
  "utf8",
);

describe("house image mobile UI", () => {
  it("bounds the mobile zones scroller and keeps image cards compact", () => {
    assert.match(source, /grid min-w-0 overflow-hidden/);
    assert.match(source, /aside className="min-w-0/);
    assert.match(source, /<ScrollArea className="w-full min-w-0(?: [^"]*)?"/);
    assert.match(source, /<nav\s+className="flex w-max min-w-full/);
    assert.match(source, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.match(source, /items-start justify-center gap-3 p-3/);
    assert.match(source, /AdminImageCard/);
    assert.match(sharedCardSource, /max-w-36/);
    assert.match(sharedCardSource, /CardContent className="flex min-h-16 flex-col gap-1 p-2"/);
    assert.match(sharedCardSource, /text-\[10px\]/);
    assert.match(sharedCardSource, /<AspectRatio className="bg-muted" ratio=\{4 \/ 3\}>/);
    assert.doesNotMatch(source, /grid grid-cols-2 gap-3 p-3/);
    assert.match(loadingSource, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.match(loadingSource, /aspect-\[4\/3\]/);
    assert.doesNotMatch(loadingSource, /h-64/);
    assert.doesNotMatch(loadingSource, /h-40 rounded-lg/);
  });

  it("keeps the image manager bounded and scrolls only the image grid", () => {
    assert.match(pageSource, /className="flex h-\[calc\(100dvh-6\.5rem\)\] min-h-0 flex-col gap-4"/);
    assert.match(
      source,
      /className="grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-\[auto_minmax\(0,1fr\)\] rounded-xl border bg-background lg:grid-cols-\[220px_1fr\] lg:grid-rows-1"/,
    );
    assert.match(
      source,
      /aside className="min-w-0 min-h-0 border-b bg-muted\/20 lg:grid lg:grid-rows-\[auto_minmax\(0,1fr\)\] lg:border-b-0 lg:border-r"/,
    );
    assert.match(
      source,
      /section className="grid min-h-0 min-w-0 grid-rows-\[auto_minmax\(0,1fr\)\]"/,
    );
    assert.match(
      source,
      /className="grid min-h-0 min-w-0 grid-rows-\[minmax\(0,1fr\)\] gap-3 p-2"/,
    );
    assert.match(source, /className="min-h-0 overflow-y-auto overscroll-contain rounded-lg"/);
    assert.doesNotMatch(source, /grid-rows-\[minmax\(0,1fr\)_auto\]/);
    assert.doesNotMatch(source, /border-t bg-background px-2 pt-3/);
    assert.doesNotMatch(source, /sticky bottom-0/);
  });

  it("keeps the image count in the header details and moves upload to the far right", () => {
    assert.match(source, /import \{ Button, buttonVariants \} from "\.\.\/\.\.\/ui\/button";/);
    assert.match(source, /buttonVariants\(\{ variant: "outline", size: "sm" \}\)/);
    assert.match(
      source,
      /<p className="text-xs text-muted-foreground">\s*\{visibleImages\.length\} รูป · Zone Order: \{orderRangeLabel\(selectedGroup\)\}\s*<\/p>/,
    );
    assert.match(
      source,
      /<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">[\s\S]*<Label[\s\S]*htmlFor="house-images-upload"[\s\S]*<UploadCloudIcon[\s\S]*<input[\s\S]*id="house-images-upload"[\s\S]*name="images"[\s\S]*type="file"[\s\S]*<\/div>/,
    );
    assert.doesNotMatch(source, /visibleImages\.length \+ previews\.length/);
    assert.doesNotMatch(source, /<Badge variant="secondary">\{visibleImages\.length \+ previews\.length\} รูป<\/Badge>/);
    assert.doesNotMatch(source, /flex flex-wrap items-center gap-2 text-xs text-muted-foreground/);
    assert.doesNotMatch(source, /border border-dashed bg-muted\/20/);
    assert.doesNotMatch(source, /min-h-28 cursor-pointer flex-col/);
  });

  it("changes zones with Next Link so sidebar state is not reset by a full reload", () => {
    assert.match(source, /import Link from "next\/link"/);
    assert.match(source, /<Link[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
    assert.doesNotMatch(source, /<a\b[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
  });

  it("scrolls the selected mobile zone chip into view without reordering zones", () => {
    assert.match(source, /const activeZoneRef = useRef<HTMLAnchorElement>\(null\);/);
    assert.match(source, /window\.matchMedia\("\(max-width: 1023px\)"\)\.matches/);
    assert.match(
      source,
      /activeZone\.scrollIntoView\(\{\s*behavior: "smooth",\s*block: "nearest",\s*inline: "start",\s*\}\);/,
    );
    assert.match(source, /\}, \[selectedGroup\.zone\]\);/);
    assert.match(source, /ref=\{isActive \? activeZoneRef : undefined\}/);
  });

  it("keeps the house list return URL through the image page and zone changes", () => {
    assert.match(pageSource, /searchParams: Promise<\{ zone\?: string; returnTo\?: string \}>/);
    assert.match(pageSource, /value === "\/admin\/houses"/);
    assert.match(pageSource, /value\??\.startsWith\("\/admin\/houses\?"\)/);
    assert.match(pageSource, /const safeReturnTo = getSafeReturnTo\(returnTo\);/);
    assert.match(pageSource, /const backHref = safeReturnTo \?\? "\/admin\/houses";/);
    assert.match(pageSource, /<Link href=\{backHref\}>/);
    assert.match(pageSource, /returnTo=\{safeReturnTo \?\? undefined\}/);
    assert.match(source, /function imageZoneHref\(propertyId: string, zone: string, returnTo\?: string\)/);
    assert.match(source, /if \(returnTo\) params\.set\("returnTo", returnTo\);/);
    assert.match(source, /href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
  });

  it("opens a larger read-only preview by clicking each valid image card", () => {
    assert.match(source, /import \{ AdminImageCard/);
    assert.doesNotMatch(source, /ImagePreviewDialog/);
    assert.match(sharedCardSource, /relative w-full max-w-36/);
    assert.match(sharedCardSource, /DialogTrigger asChild/);
    assert.match(sharedCardSource, /className="absolute inset-0/);
    assert.match(sharedCardSource, /DialogContent/);
    assert.match(sharedCardSource, /DialogTitle/);
    assert.match(sharedCardSource, /max-w-7xl/);
    assert.match(sharedCardSource, /max-h-\[82dvh\]/);
    assert.match(sharedCardSource, /<img/);
    assert.doesNotMatch(sharedCardSource, /EyeIcon/);
    assert.doesNotMatch(sharedCardSource, /size="icon-xs"/);
    assert.doesNotMatch(sharedCardSource, /title="ดูรูป"/);
  });

  it("wires immediate upload and confirmed delete actions into the image manager", () => {
    assert.match(pageSource, /uploadHouseImagesAction/);
    assert.match(pageSource, /deleteHouseImageAction/);
    assert.match(pageSource, /deleteHouseImagesAction/);
    assert.match(pageSource, /uploadAction=\{uploadHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.match(pageSource, /deleteAction=\{deleteHouseImageAction\.bind\(null, propertyId\)\}/);
    assert.match(pageSource, /bulkDeleteAction=\{deleteHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.doesNotMatch(pageSource, /updateHouseImagesAction/);
    assert.doesNotMatch(pageSource, /action=\{updateHouseImagesAction\.bind\(null, propertyId\)\}/);
  });

  it("removes the staged save and draft preview flow", () => {
    assert.doesNotMatch(source, /SaveIcon/);
    assert.doesNotMatch(source, /DraftPreview/);
    assert.doesNotMatch(source, /DraftImageCard/);
    assert.doesNotMatch(source, /deletedImageIds/);
    assert.doesNotMatch(source, /isDirty/);
    assert.doesNotMatch(source, /resetDraft/);
    assert.doesNotMatch(source, /name="deleted_image_ids"/);
    assert.doesNotMatch(source, /function appendPreviews/);
  });

  it("queues selected files immediately and refreshes the grid after processing", () => {
    assert.match(source, /import \{ toast \} from "sonner";/);
    assert.match(source, /useRouter/);
    assert.match(source, /const router = useRouter\(\);/);
    assert.match(source, /uploadAction: \(formData: FormData\) => Promise<\{ uploadedCount: number \}>/);
    assert.match(source, /function onFilesChange\(event: ChangeEvent<HTMLInputElement>\)/);
    assert.match(source, /void uploadSelectedFiles\(Array\.from\(event\.currentTarget\.files \?\? \[\]\)\)/);
    assert.match(source, /const items = queueItemsForFiles\(files\)/);
    assert.match(source, /await processUploadQueueItem\(item\)/);
    assert.match(source, /await uploadAction\(formData\)/);
    assert.match(source, /formData\.append\("image_zone", selectedGroup\.zone\)/);
    assert.match(source, /formData\.append\("images", resized\.file\)/);
    assert.match(source, /accept="image\/avif,image\/jpeg,image\/png,image\/webp"/);
    assert.match(source, /toast\.success/);
    assert.match(source, /toast\.warning/);
    assert.match(source, /router\.refresh\(\)/);
  });

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

  it("bulk deletes selected images from the current zone only after confirmation", () => {
    assert.match(source, /isBulkSelecting/);
    assert.match(source, /selectedBulkDeleteIds/);
    assert.match(
      source,
      /const deletableImages = visibleImages\.filter\(\(image\) =>\s*isHouseImageFileOperationAllowed\(image\.image_url, "delete"\),\s*\);/,
    );
    assert.match(source, /function toggleSelectAllInCurrentZone\(checked: boolean\)/);
    assert.match(source, /new Set\(deletableImages\.map\(\(image\) => image\.id\)\)/);
    assert.match(source, /function toggleBulkDeleteImage\(imageId: number, checked: boolean\)/);
    assert.match(source, /const selectedBulkDeleteIdsArray = selectedBulkDeleteImages\.map\(\(image\) => image\.id\);/);
    assert.match(source, /bulkDeleteAction\(selectedBulkDeleteIdsArray\)/);
    assert.match(source, /checked=\{allCurrentZoneImagesSelected\}/);
    assert.match(source, /checked=\{selectedBulkDeleteIds\.has\(image\.id\)\}/);
    assert.match(source, /ยืนยันลบรูปที่เลือก/);
    assert.match(source, /selectedBulkDeleteImages\.map/);
    assert.match(source, /setSelectedBulkDeleteIds\(new Set\(\)\)/);
  });

  it("uses provider policy before showing existing image delete controls", () => {
    assert.match(source, /isHouseImageFileOperationAllowed\(image\.image_url, "delete"\)/);
  });

  it("labels image_move as zone order instead of global house order", () => {
    assert.match(source, /Zone Order/);
    assert.doesNotMatch(source, /Global Order/);
  });

  it("uses image_url only for R2 display and keeps AWS/S3 display on the Lambda path", () => {
    assert.match(source, /provider === "r2" && image\.image_url/);
    assert.doesNotMatch(source, /provider === "aws-s3" \|\| provider === "r2"/);
    assert.match(source, /buildAwsImageUrl\(image\.image_name\)/);
  });
});
