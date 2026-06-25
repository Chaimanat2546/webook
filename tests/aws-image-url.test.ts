import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAwsImageUrl } from "../lib/aws-image-url.ts";

describe("buildAwsImageUrl", () => {
  it("builds a Lambda image URL from a safe image name", () => {
    const url = buildAwsImageUrl("villa-01.webp");

    assert.equal(
      url,
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa-01.webp",
    );
  });

  it("rejects path traversal", () => {
    assert.throws(() => buildAwsImageUrl("../secret.webp"), /Invalid image name/);
    assert.throws(() => buildAwsImageUrl("%2e%2e/secret.webp"), /Invalid image name/);
  });

  it("rejects unsupported extensions", () => {
    assert.throws(() => buildAwsImageUrl("villa.svg"), /Invalid image extension/);
  });
});
