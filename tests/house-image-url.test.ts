import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHouseImageUrl,
  validateHouseImageName,
} from "../lib/house-image-url.ts";

describe("house image URLs", () => {
  it("builds Worker URLs from safe house image names", () => {
    assert.equal(
      buildHouseImageUrl(
        "houses/181/3f6b9f41-9999-4bbb-8888-5812de2db111.webp",
        "https://webook-media.example.workers.dev",
      ),
      "https://webook-media.example.workers.dev/houses/181/3f6b9f41-9999-4bbb-8888-5812de2db111.webp",
    );
  });

  it("rejects unsafe house image names", () => {
    assert.throws(() => validateHouseImageName("../secret.webp"), /Invalid image name/);
    assert.throws(() => validateHouseImageName("advertisements/id/1.webp"), /Invalid image name/);
    assert.throws(() => validateHouseImageName("https://x.test/1.webp"), /Invalid image name/);
    assert.throws(() => validateHouseImageName("houses/181/1.svg"), /Invalid image extension/);
  });
});
