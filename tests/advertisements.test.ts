import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanDeleteAdvertisementImage,
  buildAdvertisementImageName,
  getAvailableAdvertisementImageOrders,
  getImageFiles,
  normalizeAdvertisementImages,
  validateAdvertisementImageEditCount,
  validateAdvertisementImageCount,
  validateAdvertisementImageFile,
  validateAdvertisementTitle,
} from "../server/services/advertisements.ts";
import { resizeToMax } from "../lib/advertisement-image-resize.ts";

describe("advertisement rules", () => {
  it("validates title and image count", () => {
    assert.equal(validateAdvertisementTitle("  Summer Promo  "), "Summer Promo");
    assert.throws(() => validateAdvertisementTitle(" "), /Advertisement title is required/);
    assert.throws(() => validateAdvertisementImageCount(0), /at least 1 image/);
    assert.throws(() => validateAdvertisementImageCount(3), /at most 2 images/);
  });

  it("normalizes image order to 1 and 2", () => {
    assert.deepEqual(
      normalizeAdvertisementImages([
        { id: "b", image_name: "advertisements/ad/2.webp", image_order: 9 },
        { id: "a", image_name: "advertisements/ad/1.webp", image_order: 3 },
      ]),
      [
        { id: "a", image_name: "advertisements/ad/1.webp", image_order: 1 },
        { id: "b", image_name: "advertisements/ad/2.webp", image_order: 2 },
      ],
    );
  });

  it("builds database filenames separately from R2 object keys", async () => {
    const advertisementsModule = await import("../server/services/advertisements.ts");
    assert.equal(typeof advertisementsModule.buildAdvertisementImageObjectKey, "function");
    assert.equal(typeof advertisementsModule.resolveAdvertisementImageObjectKey, "function");
    const buildAdvertisementImageObjectKey = advertisementsModule.buildAdvertisementImageObjectKey as (
      advertisementId: string,
      imageName: string,
    ) => string;
    const resolveAdvertisementImageObjectKey = advertisementsModule.resolveAdvertisementImageObjectKey as (
      advertisementId: string,
      imageName: string,
    ) => string;

    assert.equal(
      buildAdvertisementImageName("image/jpeg", {
        now: new Date("2026-01-09T15:06:57.000Z"),
        randomHex: "60b5a9a545",
      }),
      "20260109220657_60b5a9a545.jpg",
    );
    assert.equal(
      buildAdvertisementImageObjectKey("ad-1", "20260109220657_60b5a9a545.jpg"),
      "advertisements/ad-1/20260109220657_60b5a9a545.jpg",
    );
    assert.equal(
      resolveAdvertisementImageObjectKey("ad-1", "advertisements/ad-1/1.webp"),
      "advertisements/ad-1/1.webp",
    );
  });

  it("scales advertisement images down to a 1920px max side", () => {
    assert.deepEqual(resizeToMax(2000, 1000), { width: 1920, height: 960 });
    assert.deepEqual(resizeToMax(1000, 2000), { width: 960, height: 1920 });
    assert.deepEqual(resizeToMax(3000, 2000), { width: 1920, height: 1280 });
    assert.deepEqual(resizeToMax(800, 600), { width: 800, height: 600 });
  });

  it("filters and validates uploaded image files", () => {
    const formData = new FormData();
    const image = new File([new Uint8Array([1])], "ad.webp", { type: "image/webp" });
    formData.append("images", image);
    formData.append("images", new File([], "empty.webp", { type: "image/webp" }));

    assert.deepEqual(getImageFiles(formData, "images"), [image]);
    assert.equal(validateAdvertisementImageFile(image), image);
    assert.throws(
      () => validateAdvertisementImageFile(new File(["x"], "ad.txt", { type: "text/plain" })),
      /Unsupported image type/,
    );
    assert.throws(
      () => validateAdvertisementImageFile(new File(["gif"], "ad.gif", { type: "image/gif" })),
      /Unsupported image type/,
    );
  });

  it("blocks deleting the last advertisement image", () => {
    assert.equal(assertCanDeleteAdvertisementImage(2), undefined);
    assert.throws(() => assertCanDeleteAdvertisementImage(1), /last advertisement image/);
  });

  it("validates edit drafts after pending deletes and new uploads", () => {
    assert.equal(
      validateAdvertisementImageEditCount({
        deletedImageCount: 1,
        existingImageCount: 2,
        newImageCount: 0,
      }),
      1,
    );
    assert.equal(
      validateAdvertisementImageEditCount({
        deletedImageCount: 2,
        existingImageCount: 2,
        newImageCount: 1,
      }),
      1,
    );
    assert.throws(
      () =>
        validateAdvertisementImageEditCount({
          deletedImageCount: 2,
          existingImageCount: 2,
          newImageCount: 0,
        }),
      /at least 1 image/,
    );
  });

  it("assigns new advertisement images to free order slots", () => {
    assert.deepEqual(
      getAvailableAdvertisementImageOrders(
        [{ id: "b", image_name: "advertisements/ad/2.webp", image_order: 2 }],
        1,
      ),
      [1],
    );
  });
});
