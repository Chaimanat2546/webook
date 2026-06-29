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
    assert.match(source, /<ScrollArea className="w-full min-w-0"/);
    assert.match(source, /<nav\s+className="flex w-max min-w-full/);
    assert.match(source, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.match(source, /items-start justify-start gap-2 p-2/);
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

  it("changes zones with Next Link so sidebar state is not reset by a full reload", () => {
    assert.match(source, /import Link from "next\/link"/);
    assert.match(source, /<Link[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
    assert.doesNotMatch(source, /<a\b[\s\S]*href=\{imageZoneHref\(propertyId, group\.zone, returnTo\)\}/);
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

  it("adds draft upload and pending delete controls like advertisement images", () => {
    assert.match(pageSource, /updateHouseImagesAction/);
    assert.match(pageSource, /action=\{updateHouseImagesAction\.bind\(null, propertyId\)\}/);
    assert.match(source, /"use client"/);
    assert.match(source, /name="images"/);
    assert.match(source, /name="deleted_image_ids"/);
    assert.match(source, /name="image_zone"/);
    assert.match(source, /name="return_to"/);
    assert.match(source, /URL\.createObjectURL/);
    assert.match(source, /URL\.revokeObjectURL/);
    assert.match(source, /function appendPreviews\(files: File\[\]/);
    assert.match(source, /const nextPreviews = \[\.\.\.previewsRef\.current, \.\.\.newPreviews\]/);
    assert.match(source, /appendPreviews\(Array\.from\(event\.currentTarget\.files \?\? \[\]\), true\)/);
    assert.match(source, /syncInputFiles\(nextPreviews\.map\(\(preview\) => preview\.file\)\)/);
    assert.match(source, /UploadCloudIcon/);
    assert.match(source, /SaveIcon/);
    assert.match(source, /Trash2Icon/);
    assert.match(source, /disabled=\{!isDirty\}/);
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
