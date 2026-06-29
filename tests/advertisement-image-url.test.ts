import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdvertisementImageUrl,
  validateAdvertisementImageName,
} from "../lib/advertisement-image-url.ts";

describe("advertisement image URLs", () => {
  it("builds Worker URLs from safe advertisement image names", () => {
    assert.equal(
      buildAdvertisementImageUrl(
        "advertisements/3f6b9f41-9999-4bbb-8888-5812de2db111/1.webp",
        "https://webook-media.example.workers.dev",
      ),
      "https://webook-media.example.workers.dev/advertisements/3f6b9f41-9999-4bbb-8888-5812de2db111/1.webp",
    );
  });

  it("rejects unsafe image names", () => {
    assert.throws(() => validateAdvertisementImageName("../secret.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("houses/1.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("https://x.test/1.webp"), /Invalid image name/);
    assert.throws(() => validateAdvertisementImageName("advertisements/id/1.svg"), /Invalid image extension/);
  });
});
