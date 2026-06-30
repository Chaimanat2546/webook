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
