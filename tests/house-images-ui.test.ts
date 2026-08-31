import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/images/image-zone-viewer.tsx", import.meta.url),
  "utf8",
);
const coverSelectSource = readFileSync(
  new URL("../components/admin/images/cover-select-viewer.tsx", import.meta.url),
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
const taskHeaderPath = new URL(
  "../components/admin/houses/house-task-header.tsx",
  import.meta.url,
);
const workspaceShellPath = new URL(
  "../components/admin/houses/house-workspace-shell.tsx",
  import.meta.url,
);
const workspaceShellSource = existsSync(workspaceShellPath)
  ? readFileSync(workspaceShellPath, "utf8")
  : "";
const navItemPath = new URL(
  "../components/admin/houses/house-workspace-nav-item.tsx",
  import.meta.url,
);

describe("house image mobile UI", () => {
  it("requires accommodation permission for the image page", () => {
    assert.match(pageSource, /requireAccommodationAdmin\(\)/);
  });

  it("bounds the mobile zones scroller and keeps image cards compact", () => {
    assert.equal(existsSync(workspaceShellPath), true);
    assert.equal(existsSync(navItemPath), true);
    assert.match(source, /HouseWorkspaceShell/);
    assert.match(source, /HouseWorkspaceNavItem/);
    assert.match(source, /<ScrollArea className="w-full min-w-0(?: [^"]*)?"/);
    assert.match(source, /<nav\s+className="flex w-max min-w-full/);
    assert.match(source, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.match(source, /items-start justify-center gap-3 p-3/);
    assert.match(source, /AdminImageCard/);
    assert.match(sharedCardSource, /max-w-36/);
    assert.match(sharedCardSource, /CardContent className="flex flex-col gap-1 p-2"/);
    assert.match(sharedCardSource, /text-\[11px\]/);
    assert.match(sharedCardSource, /<AspectRatio className="bg-muted" ratio=\{4 \/ 3\}>/);
    assert.doesNotMatch(source, /grid grid-cols-2 gap-3 p-3/);
    assert.match(loadingSource, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.match(loadingSource, /aspect-\[4\/3\]/);
    assert.doesNotMatch(loadingSource, /h-64/);
    assert.doesNotMatch(loadingSource, /h-40 rounded-lg/);
  });

  it("keeps the image manager bounded and scrolls only the image grid", () => {
    assert.match(pageSource, /className="flex h-\[calc\(100dvh-6\.5rem\)\] min-h-0 flex-col gap-4"/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle="ทำเล"/);
    assert.match(source, /contentTitle=\{selectedMeta\.label\}/);
    assert.match(source, /contentMeta=\{`\$\{visibleImages\.length\} รูป`\}/);
    assert.match(source, /contentActions=\{contentActions\}/);
    assert.match(
      source,
      /contentClassName="grid min-h-0 min-w-0 grid-rows-\[minmax\(0,1fr\)\] gap-3 p-2 lg:overflow-hidden"/,
    );
    assert.match(source, /className="min-h-0 overflow-y-auto overscroll-contain rounded-lg"/);
    assert.doesNotMatch(source, /lg:grid-cols-\[220px_1fr\]/);
    assert.doesNotMatch(source, /grid-rows-\[minmax\(0,1fr\)_auto\]/);
    assert.doesNotMatch(source, /border-t bg-background px-2 pt-3/);
    assert.doesNotMatch(source, /sticky bottom-0/);
  });

  it("lets mobile content actions wrap within the viewport", () => {
    assert.match(workspaceShellSource, /flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto/);
    assert.doesNotMatch(workspaceShellSource, /ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2/);
  });

  it("shows the current image task under the house name and moves upload to the far right", () => {
    assert.equal(existsSync(taskHeaderPath), true);
    assert.match(source, /import \{ Button, buttonVariants \} from "\.\.\/\.\.\/ui\/button";/);
    assert.match(source, /buttonVariants\(\{ variant: "outline", size: "sm" \}\)/);
    assert.match(pageSource, /import \{ HouseTaskHeader \}/);
    assert.match(pageSource, /const imageTaskLabel = isCoverSelectMode \? "เรียงลำดับรูป" : "จัดการรูป";/);
    assert.match(pageSource, /<HouseTaskHeader/);
    assert.match(pageSource, /subtitle=\{imageTaskLabel\}/);
    assert.doesNotMatch(pageSource, /<p className="hidden text-sm text-muted-foreground lg:block">/);
    assert.doesNotMatch(pageSource, /จัดการรูปภาพบ้านพัก · \{images\.length\} รูป/);
    assert.match(source, /contentIcon=\{<ZoneIcon icon=\{selectedMeta\.icon\} \/>\}/);
    assert.doesNotMatch(source, /Zone Order/);
    assert.doesNotMatch(source, /orderRangeLabel/);
    assert.match(
      source,
      /const contentActions = \([\s\S]*<Label[\s\S]*htmlFor="house-images-upload"[\s\S]*<UploadCloudIcon[\s\S]*<input[\s\S]*id="house-images-upload"[\s\S]*name="images"[\s\S]*type="file"/,
    );
    assert.doesNotMatch(source, /visibleImages\.length \+ previews\.length/);
    assert.doesNotMatch(source, /<Badge variant="secondary">\{visibleImages\.length \+ previews\.length\} รูป<\/Badge>/);
    assert.doesNotMatch(source, /flex flex-wrap items-center gap-2 text-xs text-muted-foreground/);
    assert.doesNotMatch(source, /min-h-28 cursor-pointer flex-col/);
  });

  it("shows empty configured zones as selectable settings destinations", () => {
    assert.match(source, /const sidebarGroups = groups\.length > 0 \? groups : \[fallbackGroup\];/);
    assert.match(source, /badge=\{`\$\{group\.images\.length\} รูป`\}/);
    assert.match(source, /visibleImages\.length === 0 && failedUploadItems\.length === 0/);
    assert.match(source, /โซนนี้ยังไม่มีรูป/);
  });

  it("changes zones with Next Link so sidebar state is not reset by a full reload", () => {
    assert.match(source, /import \{ HouseWorkspaceNavItem \} from "\.\.\/houses\/house-workspace-nav-item";/);
    assert.match(source, /<HouseWorkspaceNavItem[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
    assert.doesNotMatch(source, /<a\b[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
  });

  it("scrolls the selected mobile zone chip into view without reordering zones", () => {
    assert.match(source, /import \{ scrollActiveItemToStart \} from "\.\.\/\.\.\/\.\.\/lib\/scroll-active-item";/);
    assert.match(source, /const activeZoneRef = useRef<HTMLAnchorElement>\(null\);/);
    assert.match(source, /window\.matchMedia\("\(max-width: 1023px\)"\)\.matches/);
    assert.match(source, /scrollActiveItemToStart\(activeZone\);/);
    assert.match(source, /\}, \[selectedGroup\.zone\]\);/);
    assert.match(source, /ref=\{isActive \? activeZoneRef : undefined\}/);
    assert.doesNotMatch(source, /scrollIntoView/);
  });

  it("keeps the house list return URL through the image page and zone changes", () => {
    assert.match(pageSource, /searchParams: Promise<\{ zone\?: string; returnTo\?: string; mode\?: string \}>/);
    assert.match(pageSource, /value === "\/admin\/houses"/);
    assert.match(pageSource, /value\??\.startsWith\("\/admin\/houses\?"\)/);
    assert.match(pageSource, /const safeReturnTo = getSafeReturnTo\(returnTo\);/);
    assert.match(pageSource, /const backHref = safeReturnTo \?\? "\/admin\/houses";/);
    assert.match(pageSource, /backHref=\{backHref\}/);
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
    assert.match(source, /previewEnabled=\{!isBulkSelecting\}/);
    assert.match(sharedCardSource, /DialogContent/);
    assert.match(sharedCardSource, /DialogTitle/);
    assert.match(sharedCardSource, /max-w-7xl/);
    assert.match(sharedCardSource, /max-h-\[82dvh\]/);
    assert.match(sharedCardSource, /<img/);
    assert.doesNotMatch(sharedCardSource, /EyeIcon/);
    assert.doesNotMatch(sharedCardSource, /size="icon-xs"/);
    assert.doesNotMatch(sharedCardSource, /title="ดูรูป"/);
  });

  it("keeps the house card order badge but removes unused dates and zone badges", () => {
    const houseCardSource = source.slice(
      source.indexOf("function ImageCard"),
      source.indexOf("function FailedUploadCard"),
    );

    assert.doesNotMatch(source, /formatThaiImageDateTime/);
    assert.doesNotMatch(houseCardSource, /metaRows=\{\[/);
    assert.match(source, /orderLabel=\{formatImageMoveLabel\(image\.image_move\)\}/);
    assert.doesNotMatch(source, /secondaryLabel=\{zoneMeta\.label\}/);
  });

  it("wires immediate upload and confirmed delete actions into the image manager", () => {
    assert.match(pageSource, /uploadHouseImagesAction/);
    assert.match(pageSource, /deleteHouseImageAction/);
    assert.match(pageSource, /uploadAction=\{uploadHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.match(pageSource, /deleteAction=\{deleteHouseImageAction\.bind\(null, propertyId\)\}/);
    assert.doesNotMatch(pageSource, /deleteHouseImagesAction/);
    assert.doesNotMatch(pageSource, /bulkDeleteAction=/);
    assert.doesNotMatch(pageSource, /updateHouseImagesAction/);
    assert.doesNotMatch(pageSource, /action=\{updateHouseImagesAction\.bind\(null, propertyId\)\}/);
  });

  it("switches to a cover-select mode on the existing house image route", () => {
    assert.match(pageSource, /import \{ CoverSelectViewer \}/);
    assert.match(pageSource, /saveHouseCoverSelectAction/);
    assert.match(pageSource, /searchParams: Promise<\{ zone\?: string; returnTo\?: string; mode\?: string \}>/);
    assert.match(pageSource, /const isCoverSelectMode = mode === "cover-select";/);
    assert.match(pageSource, /isCoverSelectMode \? \(/);
    assert.match(pageSource, /<CoverSelectViewer/);
    assert.match(pageSource, /saveAction=\{saveHouseCoverSelectAction\.bind\(null, propertyId\)\}/);
    assert.match(source, /mode: "cover-select"/);
    assert.match(source, /<ArrowDownUp data-icon="inline-start" \/>[\s\S]*จัดลำดับรูปแสดง/);
  });

  it("adds a dedicated cover selection viewer component", () => {
    assert.match(coverSelectSource, /export function CoverSelectViewer/);
    assert.match(coverSelectSource, /import \{ DragDropProvider \} from "@dnd-kit\/react"/);
    assert.match(coverSelectSource, /import \{ move \} from "@dnd-kit\/helpers"/);
    assert.match(coverSelectSource, /import \{ useSortable \} from "@dnd-kit\/react\/sortable"/);
    assert.match(coverSelectSource, /type ImageZoneIconName/);
    assert.match(coverSelectSource, /satisfies Record<ImageZoneIconName, LucideIcon>/);
    assert.match(coverSelectSource, /function ZoneIcon\(\{ icon \}: \{ icon: ImageZoneIconName \}\)/);
    assert.match(coverSelectSource, /import \{ scrollActiveItemToStart \} from "\.\.\/\.\.\/\.\.\/lib\/scroll-active-item";/);
    assert.match(coverSelectSource, /import \{ HouseWorkspaceNavItem \} from "\.\.\/houses\/house-workspace-nav-item";/);
    assert.match(coverSelectSource, /import \{ HouseWorkspaceShell \} from "\.\.\/houses\/house-workspace-shell";/);
    assert.match(coverSelectSource, /const activeZoneRef = useRef<HTMLAnchorElement>\(null\);/);
    assert.match(coverSelectSource, /scrollActiveItemToStart\(activeZone\);/);
    assert.match(coverSelectSource, /ref=\{!selectedZone \? activeZoneRef : undefined\}/);
    assert.match(coverSelectSource, /ref=\{isActive \? activeZoneRef : undefined\}/);
    assert.match(coverSelectSource, /import \{[\s\S]*Dialog[\s\S]*DialogContent[\s\S]*DialogFooter[\s\S]*DialogHeader[\s\S]*DialogTitle[\s\S]*\} from "\.\.\/\.\.\/ui\/dialog"/);
    assert.match(coverSelectSource, /getHouseCoverSelectedImages/);
    assert.match(coverSelectSource, /HOUSE_COVER_SELECT_MIN/);
    assert.match(coverSelectSource, /HOUSE_COVER_SELECT_MAX/);
    assert.match(coverSelectSource, /selectedIds/);
    assert.match(coverSelectSource, /<HouseWorkspaceShell/);
    assert.match(coverSelectSource, /sidebarTitle="ทำเล"/);
    assert.match(coverSelectSource, /contentTitle="จัดลำดับรูปแสดง"/);
    assert.match(
      coverSelectSource,
      /contentMeta=\{`เลือก \$\{HOUSE_COVER_SELECT_MIN\}-\$\{HOUSE_COVER_SELECT_MAX\} รูป · \$\{selectedCountLabel\(selectedIds\.length\)\}`\}/,
    );
    assert.match(coverSelectSource, /contentActions=\{contentActions\}/);
    assert.match(coverSelectSource, /บันทึก \(\{selectedIds\.length\}\)/);
    assert.match(coverSelectSource, /ArrowLeftRightIcon/);
    assert.match(coverSelectSource, /const canSort = selectedIds\.length > 1 && !isPending;/);
    assert.match(coverSelectSource, /function openSortDialog\(\) \{\s*setIsConfirmDialogOpen\(true\);\s*\}/);
    assert.match(
      coverSelectSource,
      /<Button disabled=\{!canSort\} onClick=\{openSortDialog\} size="sm" type="button" variant="outline">[\s\S]*<ArrowLeftRightIcon data-icon="inline-start" \/>[\s\S]*เรียงรูป[\s\S]*<\/Button>/,
    );
    assert.match(coverSelectSource, /isConfirmDialogOpen/);
    assert.match(coverSelectSource, /setIsConfirmDialogOpen\(true\)/);
    assert.match(coverSelectSource, /function confirmSaveSelection\(\)/);
    assert.match(coverSelectSource, /DragDropProvider/);
    assert.match(coverSelectSource, /onDragEnd/);
    assert.match(coverSelectSource, /move\(ids, event\)/);
    assert.match(
      coverSelectSource,
      /contentClassName="grid min-h-0 min-w-0 grid-rows-\[minmax\(0,1fr\)\] gap-3 p-2 lg:overflow-hidden"/,
    );
    assert.doesNotMatch(coverSelectSource, /selected strip/i);
    assert.doesNotMatch(coverSelectSource, /aria-label="selected strip"/);
    assert.match(coverSelectSource, /<ScrollArea className="w-full min-w-0 overflow-hidden">/);
    assert.match(coverSelectSource, /saveAction\(selectedIds\)/);
    assert.match(coverSelectSource, /<Dialog\s+open=\{isConfirmDialogOpen\}/);
    assert.match(coverSelectSource, /max-h-\[calc\(100dvh-1rem\)\][\s\S]*max-w-7xl[\s\S]*sm:max-w-7xl/);
    assert.match(coverSelectSource, /<DialogTitle>ยืนยันรูปที่เลือก<\/DialogTitle>/);
    assert.match(coverSelectSource, /onClick=\{confirmSaveSelection\}/);
    assert.match(coverSelectSource, /getSelectedImageZoneGroup/);
    assert.match(coverSelectSource, /const selectedMeta = selectedZone \? getImageZoneMeta\(selectedZone\) : null;/);
    assert.match(coverSelectSource, /<HouseWorkspaceNavItem/);
    assert.match(coverSelectSource, /icon=\{<ImageIcon aria-hidden className="size-4" \/>\}/);
    assert.match(coverSelectSource, /icon=\{<ZoneIcon icon=\{meta\.icon\} \/>\}/);
    assert.match(coverSelectSource, /contentIcon=\{\s*selectedMeta \? <ZoneIcon icon=\{selectedMeta\.icon\} \/> : <ImageIcon aria-hidden className="size-4" \/>\s*\}/);
    assert.match(coverSelectSource, /mode: "cover-select"/);
    assert.doesNotMatch(coverSelectSource, /จัดลำดับรูปแสดงใช้บนเดสก์ท็อป/);
    assert.doesNotMatch(source, /className="hidden lg:inline-flex"/);
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

  it("queues selected files immediately, reports upload progress in toast, and refreshes the grid", () => {
    assert.match(source, /import \{ toast \} from "sonner";/);
    assert.match(source, /useRouter/);
    assert.match(source, /const router = useRouter\(\);/);
    assert.match(source, /uploadAction: \(formData: FormData\) => Promise<\{ uploadedCount: number \}>/);
    assert.match(source, /function onFilesChange\(event: ChangeEvent<HTMLInputElement>\)/);
    assert.match(source, /void uploadSelectedFiles\(Array\.from\(event\.currentTarget\.files \?\? \[\]\)\)/);
    assert.match(source, /const items = queueItemsForFiles\(files, selectedGroup\.zone\)/);
    assert.match(source, /function uploadQueueIdSuffix/);
    assert.match(source, /typeof randomUUID === "function"/);
    assert.match(source, /randomUUID\.call\(cryptoProvider\)/);
    assert.match(source, /fallbackUploadQueueIdSuffix\(\)/);
    assert.doesNotMatch(source, /crypto\.randomUUID\(\)/);
    assert.match(source, /await processUploadQueueItem\(\s*item,\s*\(status\) =>/);
    assert.match(source, /await uploadAction\(formData\)/);
    assert.match(source, /formData\.append\("image_zone", item\.zone\)/);
    assert.match(source, /formData\.append\("images", resized\.file\)/);
    assert.match(source, /accept="image\/avif,image\/jpeg,image\/png,image\/webp"/);
    assert.match(source, /รองรับ AVIF, JPEG, PNG หรือ WebP ขนาดไม่เกิน 10 MB ต่อรูป/);
    assert.match(source, /toast\.loading/);
    assert.match(source, /updateUploadProgressToast/);
    assert.match(source, /toast\.dismiss\(uploadToastId\)/);
    assert.match(source, /toast\.success/);
    assert.match(source, /toast\.warning/);
    assert.match(source, /router\.refresh\(\)/);
  });

  it("shows failed uploads as muted grid cards with retry actions instead of a full upload queue panel", () => {
    assert.match(source, /resizeHouseImageFile/);
    assert.match(source, /UploadQueueItem/);
    assert.match(source, /status: "pending-resize"/);
    assert.match(source, /"resizing"/);
    assert.match(source, /"pending-upload"/);
    assert.match(source, /"uploading"/);
    assert.match(source, /"uploaded"/);
    assert.match(source, /"failed"/);
    assert.match(source, /uploadQueue/);
    assert.match(
      source,
      /const failedUploadItems = uploadQueue\.filter\(\s*\(item\) => item\.status === "failed" && item\.zone === selectedGroup\.zone,\s*\)/,
    );
    assert.match(source, /FailedUploadCard/);
    assert.match(source, /failedUploadItems\.length > 0/);
    assert.match(source, /failedUploadItems\.map/);
    assert.match(source, /border-dashed/);
    assert.match(source, /grayscale/);
    assert.match(source, /ยังไม่ถูกบันทึก/);
    assert.match(source, /retryFailedUploads/);
    assert.match(source, /clearFailedUploads/);
    assert.match(source, /removeUploadQueueItem/);
    assert.doesNotMatch(source, /uploadQueue\.map/);
    assert.doesNotMatch(source, /border-t bg-background px-3 py-3/);
  });

  it("resizes then uploads queued files one at a time", () => {
    assert.match(source, /async function processUploadQueueItem/);
    assert.match(source, /await resizeHouseImageFile\(item\.file\)/);
    assert.match(source, /formData\.append\("images", resized\.file\)/);
    assert.match(source, /await uploadAction\(formData\)/);
    assert.match(source, /for \(const \[index, item\] of items\.entries\(\)\)/);
    assert.doesNotMatch(source, /for \(const file of files\) {\s*formData\.append\("images", file\)/);
    assert.match(source, /status: "uploaded"/);
    assert.match(source, /status: "failed"/);
  });

  it("confirms single image deletion with a preview before calling the delete action", () => {
    assert.match(source, /singleDeleteImage/);
    assert.match(source, /setSingleDeleteImage\(image\)/);
    assert.match(source, /const imageToDelete = singleDeleteImage;/);
    assert.match(source, /const deleteToastId = toast\.loading\("กำลังลบรูป"/);
    assert.match(source, /setSingleDeleteImage\(null\);\s*startMutationTransition/);
    assert.match(source, /deleteAction\(imageToDelete\.id\)/);
    assert.match(source, /toast\.dismiss\(deleteToastId\)/);
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
    assert.match(source, /previewEnabled=\{!isBulkSelecting\}/);
    assert.match(source, /const isSelected = selectedBulkDeleteIds\.has\(image\.id\);/);
    assert.match(source, /selected=\{isSelected\}/);
    assert.match(
      source,
      /onSelect=\{\s*isBulkSelecting && canDelete\s*\?\s*\(\) => toggleBulkDeleteImage\(image\.id, !selectedBulkDeleteIds\.has\(image\.id\)\)\s*:\s*undefined\s*\}/,
    );
    assert.match(source, /checked=\{allCurrentZoneImagesSelected\}/);
    assert.match(source, /ยืนยันลบรูปที่เลือก/);
    assert.match(source, /bulkDeleteQueue\.map/);
    assert.match(
      source,
      /<DialogContent className="flex max-h-\[calc\(100dvh-2rem\)\] max-w-5xl flex-col overflow-hidden">/,
    );
    assert.match(source, /<div className="min-h-0 flex-1 overflow-y-auto pr-1">/);
    assert.match(source, /<div className="grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,1fr\)\)\] gap-3">/);
    assert.doesNotMatch(source, /grid max-h-\[70dvh\] grid-cols-\[repeat\(auto-fill,minmax\(9rem,1fr\)\)\]/);
    assert.match(source, /shortImageName\(image\.image_name\)/);
    assert.match(source, /\{ label: "สถานะ", value: <span className=\{statusClassName\}>\{statusLabel\}<\/span> \}/);
    assert.match(source, /\{ label: "สาเหตุ", value: item\.error \}/);
    assert.match(source, /previewDescription="ดูรูปก่อนยืนยันลบ"/);
    assert.doesNotMatch(source, /grid grid-cols-\[4rem_1fr\]/);
    assert.doesNotMatch(source, /Order \{formatImageMoveLabel\(image\.image_move\)\}/);
    assert.match(source, /setSelectedBulkDeleteIds\(new Set\(\)\)/);
    assert.doesNotMatch(source, /bulkDeleteAction\(selectedBulkDeleteIdsArray\)/);
  });

  it("runs bulk deletion as a per-image delete queue with progress and retry", () => {
    assert.match(source, /type BulkDeleteQueueStatus = "pending" \| "deleting" \| "deleted" \| "failed";/);
    assert.match(source, /interface BulkDeleteQueueItem/);
    assert.match(source, /bulkDeleteQueue/);
    assert.match(source, /function bulkDeleteStatusLabel\(status: BulkDeleteQueueStatus\)/);
    assert.match(source, /return "รอลบ"/);
    assert.match(source, /return "กำลังลบ"/);
    assert.match(source, /return "ลบแล้ว"/);
    assert.match(source, /return "ลบไม่สำเร็จ"/);
    assert.match(source, /function queueItemsForBulkDelete\(images: HouseImageItem\[\]\)/);
    assert.match(source, /status: "pending" as const/);
    assert.match(source, /async function processBulkDeleteQueueItem/);
    assert.match(source, /await deleteAction\(item\.image\.id\)/);
    assert.match(source, /updateBulkDeleteQueueItem\(item\.id, \{ status: "deleting"/);
    assert.match(source, /updateBulkDeleteQueueItem\(item\.id, \{\s*status: "deleted"/);
    assert.match(source, /updateBulkDeleteQueueItem\(item\.id, \{\s*error:/);
    assert.match(source, /status: "failed"/);
    assert.match(source, /function updateBulkDeleteProgressToast/);
    assert.match(source, /toast\.loading\(`กำลังลบ \$\{current\}\/\$\{total\}`/);
    assert.match(source, /for \(const \[index, item\] of items\.entries\(\)\)/);
    assert.match(source, /await processBulkDeleteQueueItem\(item/);
    assert.match(source, /toast\.success\(`ลบสำเร็จทั้งหมด \$\{successCount\} รูป`\)/);
    assert.match(source, /toast\.warning\(`ลบสำเร็จ \$\{successCount\} รูป, ลบไม่สำเร็จ \$\{failedCount\} รูป`\)/);
    assert.match(source, /function retryFailedBulkDeletes/);
    assert.match(source, /item\.status === "failed"/);
    assert.match(source, /onClick=\{\(\) => retryFailedBulkDeletes\(\)\}/);
    assert.match(source, /onClick=\{\(\) => retryFailedBulkDeletes\(\[item\.id\]\)\}/);
    assert.doesNotMatch(source, /bulkDeleteAction:/);
    assert.doesNotMatch(source, /bulkDeleteAction\(selectedBulkDeleteIdsArray\)/);
  });

  it("uses provider policy before showing existing image delete controls", () => {
    assert.match(source, /isHouseImageFileOperationAllowed\(image\.image_url, "delete"\)/);
  });

  it("labels image_move as zone order instead of global house order", () => {
    assert.match(source, /orderLabel=\{formatImageMoveLabel\(image\.image_move\)\}/);
    assert.doesNotMatch(source, /Zone Order/);
    assert.doesNotMatch(source, /Global Order/);
  });

  it("uses image_url only for R2 display and keeps AWS/S3 display on the Lambda path", () => {
    assert.match(source, /provider === "r2" && image\.image_url/);
    assert.doesNotMatch(source, /provider === "aws-s3" \|\| provider === "r2"/);
    assert.match(source, /buildAwsImageUrl\(image\.image_name\)/);
  });
});
