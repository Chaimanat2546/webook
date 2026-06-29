import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteAdvertisementImageObject,
  uploadAdvertisementImageObject,
} from "../server/storage/advertisement-images.ts";

describe("advertisement image storage adapter", () => {
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

    await uploadAdvertisementImageObject({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      fetchImpl,
      objectKey: "advertisements/ad-1/20260109220657_60b5a9a545.webp",
      workerSecret: "secret",
      workerUrl: "https://webook-media.example.workers.dev",
    });

    assert.equal(calls[0]?.method, "PUT");
    assert.equal(calls[0]?.headers.authorization, "Bearer secret");
    assert.equal(
      calls[0]?.url,
      "https://webook-media.example.workers.dev/advertisements/ad-1/20260109220657_60b5a9a545.webp",
    );
  });

  it("throws when delete fails", async () => {
    await assert.rejects(
      () =>
        deleteAdvertisementImageObject({
          fetchImpl: async () => new Response("boom", { status: 500 }),
          objectKey: "advertisements/ad-1/20260109220657_60b5a9a545.webp",
          workerSecret: "secret",
          workerUrl: "https://webook-media.example.workers.dev",
        }),
      /Failed to delete advertisement image/,
    );
  });

  it("includes Worker status and response body when upload fails", async () => {
    await assert.rejects(
      () =>
        uploadAdvertisementImageObject({
          body: new Uint8Array([1]),
          contentType: "image/webp",
          fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
          objectKey: "advertisements/ad-1/20260109220657_60b5a9a545.webp",
          workerSecret: "wrong",
          workerUrl: "https://webook-media.example.workers.dev",
        }),
      /Failed to upload advertisement image \(401\): Unauthorized/,
    );
  });
});
