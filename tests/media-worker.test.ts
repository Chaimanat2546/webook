import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker from "../workers/media/src/index.ts";

function env() {
  const objects = new Map<string, ArrayBuffer>();

  return {
    ADVERTISEMENT_IMAGE_WORKER_SECRET: "secret",
    MEDIA_BUCKET: {
      async delete(key: string) {
        objects.delete(key);
      },
      async get(key: string) {
        const body = objects.get(key);
        if (!body) return null;
        return {
          body,
          httpEtag: "etag",
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", "image/webp");
          },
        };
      },
      async put(key: string, value: ArrayBuffer) {
        objects.set(key, value);
        return { key };
      },
    },
  };
}

describe("media worker", () => {
  it("allows house image keys", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/houses/181/1.webp", {
        body: new Uint8Array([1]),
        headers: {
          authorization: "Bearer secret",
          "content-type": "image/webp",
        },
        method: "PUT",
      }),
      env(),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key: "houses/181/1.webp" });
  });

  it("rejects unknown image key prefixes", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/private/181/1.webp", {
        headers: { authorization: "Bearer secret", "content-type": "image/webp" },
        method: "PUT",
      }),
      env(),
    );

    assert.equal(response.status, 400);
  });
});
