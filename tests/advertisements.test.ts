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

  it("builds deterministic R2 image names", () => {
    assert.equal(
      buildAdvertisementImageName("ad-1", 2, "image/jpeg"),
      "advertisements/ad-1/2.jpg",
    );
  });

  it("scales advertisement images down to a 1080px max side", () => {
    assert.deepEqual(resizeToMax(2000, 1000), { width: 1080, height: 540 });
    assert.deepEqual(resizeToMax(1000, 2000), { width: 540, height: 1080 });
    assert.deepEqual(resizeToMax(3000, 2000), { width: 1080, height: 720 });
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
