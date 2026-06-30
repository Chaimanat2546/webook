import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sharedCardPath = new URL("../components/admin/image-asset-card.tsx", import.meta.url);

describe("shared admin image card", () => {
  it("centralizes reusable admin image card UI and preview behavior", () => {
    assert.ok(existsSync(sharedCardPath));

    const source = readFileSync(sharedCardPath, "utf8");
    assert.match(source, /export interface AdminImageCardMetaRow/);
    assert.match(source, /export function AdminImageCard/);
    assert.match(source, /<AspectRatio className="bg-muted" ratio=\{4 \/ 3\}>/);
    assert.match(source, /CardContent className="flex flex-col gap-1 p-2"/);
    assert.match(source, /DialogTrigger asChild/);
    assert.match(source, /max-h-\[82dvh\]/);
    assert.match(source, /previewEnabled = true/);
    assert.match(source, /onSelect/);
    assert.match(source, /aria-pressed=\{selected\}/);
    assert.match(source, /previewEnabled && src/);
  });

  it("is used by both house images and advertisement images", () => {
    const houseSource = readFileSync(
      new URL("../components/admin/images/image-zone-viewer.tsx", import.meta.url),
      "utf8",
    );
    const advertisementSource = readFileSync(
      new URL("../components/admin/advertisements/advertisement-form.tsx", import.meta.url),
      "utf8",
    );

    assert.match(houseSource, /import \{ AdminImageCard/);
    assert.match(advertisementSource, /import \{ AdminImageCard/);
    assert.doesNotMatch(houseSource, /ImagePreviewDialog/);
    assert.doesNotMatch(advertisementSource, /AdvertisementImagePreviewDialog/);
    assert.doesNotMatch(advertisementSource, /function ImageSlotCard/);
  });
});
