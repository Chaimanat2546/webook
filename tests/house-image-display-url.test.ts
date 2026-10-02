import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHouseImageDisplayUrl } from "../lib/house-image-display-url.ts";

describe("buildHouseImageDisplayUrl", () => {
  it("routes a legacy S3 image through the legacy image proxy", () => {
    assert.equal(
      buildHouseImageDisplayUrl({
        imageName: "legacy-villa.webp",
        imageUrl: "https://s3.ap-southeast-1.amazonaws.com/example-bucket/legacy-villa.webp",
      }),
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/legacy-villa.webp",
    );
  });

  it("keeps a managed R2 house image URL unchanged", () => {
    assert.equal(
      buildHouseImageDisplayUrl({
        imageName: "houses/101/new-villa.webp",
        imageUrl: "https://webook-media.poolvilla.workers.dev/houses/101/new-villa.webp",
      }),
      "https://webook-media.poolvilla.workers.dev/houses/101/new-villa.webp",
    );
  });

  it("does not mistake a virtual-hosted S3 path for a managed R2 URL", () => {
    assert.equal(
      buildHouseImageDisplayUrl({
        imageName: "legacy-villa.webp",
        imageUrl: "https://example-bucket.s3.ap-southeast-1.amazonaws.com/houses/101/legacy-villa.webp",
      }),
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/legacy-villa.webp",
    );
  });

  it("does not render a legacy URL when no usable image name exists", () => {
    assert.equal(
      buildHouseImageDisplayUrl({ imageName: null, imageUrl: "https://images.example/first-house-image.jpg" }),
      null,
    );
  });
});
