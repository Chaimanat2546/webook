import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteHouseImageObject,
  uploadHouseImageObject,
} from "../server/storage/house-images.ts";

describe("house image storage adapter", () => {
  it("uploads with bearer auth", async () => {
    const calls: Array<{ headers: Record<string, string>; method: string; url: string }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        headers: init?.headers as Record<string, string>,
        method: init?.method ?? "GET",
        url: String(url),
      });
      return new Response("{}", { status: 200 });
    };

    await uploadHouseImageObject({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      fetchImpl,
      objectKey: "houses/181/20260222205910_63fe3bcbc8.webp",
      workerSecret: "secret",
      workerUrl: "https://webook-media.example.workers.dev",
    });

    assert.equal(calls[0]?.method, "PUT");
    assert.equal(calls[0]?.headers.authorization, "Bearer secret");
    assert.equal(
      calls[0]?.url,
      "https://webook-media.example.workers.dev/houses/181/20260222205910_63fe3bcbc8.webp",
    );
  });

  it("throws when delete fails", async () => {
    await assert.rejects(
      () =>
        deleteHouseImageObject({
          fetchImpl: async () => new Response("boom", { status: 500 }),
          objectKey: "houses/181/20260222205910_63fe3bcbc8.webp",
          workerSecret: "secret",
          workerUrl: "https://webook-media.example.workers.dev",
        }),
      /Failed to delete house image/,
    );
  });
});
