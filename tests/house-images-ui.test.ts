import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/images/image-zone-viewer.tsx", import.meta.url),
  "utf8",
);
const previewDialogPath = new URL(
  "../components/admin/images/image-preview-dialog.tsx",
  import.meta.url,
);
const previewDialogSource = existsSync(previewDialogPath)
  ? readFileSync(previewDialogPath, "utf8")
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
    assert.match(source, /max-w-36/);
    assert.match(source, /text-\[10px\]/);
    assert.doesNotMatch(source, /grid grid-cols-2 gap-3 p-3/);
    assert.match(loadingSource, /grid grid-cols-\[repeat\(auto-fill,minmax\(9rem,9rem\)\)\]/);
    assert.doesNotMatch(loadingSource, /h-64/);
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
    assert.match(source, /import \{ ImagePreviewDialog \}/);
    assert.match(source, /<ImagePreviewDialog/);
    assert.match(source, /relative w-full max-w-36/);
    assert.match(previewDialogSource, /DialogTrigger asChild/);
    assert.match(previewDialogSource, /className="absolute inset-0/);
    assert.match(previewDialogSource, /DialogContent/);
    assert.match(previewDialogSource, /DialogTitle/);
    assert.match(previewDialogSource, /max-w-7xl/);
    assert.match(previewDialogSource, /max-h-\[82dvh\]/);
    assert.match(previewDialogSource, /sizes="\(min-width: 1024px\) 90vw, 96vw"/);
    assert.doesNotMatch(previewDialogSource, /EyeIcon/);
    assert.doesNotMatch(previewDialogSource, /size="icon-xs"/);
    assert.doesNotMatch(previewDialogSource, /title="ดูรูป"/);
  });
});
