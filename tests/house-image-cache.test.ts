import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUSE_IMAGE_CACHE_MAX_AGE_SECONDS, shouldCacheHouseImageRequest } from "../lib/house-image-cache.ts";

test("house image cache policy allows only approved image hosts and paths", () => {
  assert.equal(HOUSE_IMAGE_CACHE_MAX_AGE_SECONDS, 12 * 60 * 60);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa.webp", method: "GET", destination: "image" }), true);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://webook-media.poolvilla.workers.dev/houses/101/villa.webp", method: "GET", destination: "image" }), true);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://other.workers.dev/houses/101/villa.webp", method: "GET", destination: "image" }), false);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://webook-media.poolvilla.workers.dev/advertisements/1.webp", method: "GET", destination: "image" }), false);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://webook-media.poolvilla.workers.dev/houses/101/villa.webp", method: "POST", destination: "image" }), false);
  assert.equal(shouldCacheHouseImageRequest({ url: "https://webook-media.poolvilla.workers.dev/houses/101/villa.webp", method: "GET", destination: "" }), false);
});
