import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteAwsHouseImageObject,
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
      /ลบรูปบ้านพักไม่สำเร็จ \(status 500\): boom/,
    );
  });

  it("treats missing R2 house images as already deleted", async () => {
    await assert.doesNotReject(() =>
      deleteHouseImageObject({
        fetchImpl: async () => new Response("missing", { status: 404 }),
        objectKey: "houses/181/missing.webp",
        workerSecret: "secret",
        workerUrl: "https://webook-media.example.workers.dev",
      }),
    );
  });

  it("deletes AWS house images directly from S3 with signed requests", async () => {
    const calls: Array<{ headers: Record<string, string>; method: string; url: string }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        headers: (init?.headers ?? {}) as Record<string, string>,
        method: init?.method ?? "GET",
        url: String(url),
      });
      return new Response("{}", { status: calls.length === 1 ? 200 : 404 });
    };

    await deleteAwsHouseImageObject({
      accessKeyId: "access-key",
      bucket: "poolvillas.co.ltd",
      fetchImpl,
      imageName: "villa-01.webp",
      region: "ap-southeast-1",
      secretAccessKey: "secret-key",
    });

    assert.equal(calls[0]?.method, "DELETE");
    assert.equal(calls[0]?.url, "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/villa-01.webp");
    assert.match(calls[0]?.headers.authorization ?? "", /^AWS4-HMAC-SHA256 Credential=access-key\//);
    assert.equal(calls[1]?.method, "HEAD");
    assert.equal(calls[1]?.url, "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/villa-01.webp");
    assert.match(calls[1]?.headers.authorization ?? "", /^AWS4-HMAC-SHA256 Credential=access-key\//);
  });

  it("uses the S3 object key from image_url when it includes the bucket path", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? "GET",
        url: String(url),
      });
      return new Response(null, { status: calls.length === 1 ? 204 : 404 });
    };

    await deleteAwsHouseImageObject({
      accessKeyId: "access-key",
      bucket: "poolvillas.co.ltd",
      fetchImpl,
      imageName: "wrong-name.jpg",
      imageUrl: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/20260222205910_63fe3bcbc8.jpg",
      region: "ap-southeast-1",
      secretAccessKey: "secret-key",
    });

    assert.deepEqual(calls, [
      {
        method: "DELETE",
        url: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/20260222205910_63fe3bcbc8.jpg",
      },
      {
        method: "HEAD",
        url: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/20260222205910_63fe3bcbc8.jpg",
      },
    ]);
  });

  it("throws when AWS image still exists after delete", async () => {
    await assert.rejects(
      () =>
        deleteAwsHouseImageObject({
          accessKeyId: "access-key",
          bucket: "poolvillas.co.ltd",
          fetchImpl: async (_url, init) =>
            new Response(init?.method === "DELETE" ? null : "{}", {
              headers: { "content-type": "image/webp" },
              status: init?.method === "DELETE" ? 204 : 200,
            }),
          imageName: "villa-01.webp",
          region: "ap-southeast-1",
          secretAccessKey: "secret-key",
        }),
      /ยังลบรูป AWS ไม่สำเร็จ เพราะตรวจพบว่ารูปยังอยู่ใน S3 หลังลบ \(DELETE 204 image\/webp, verify HEAD 200 image\/webp\)/,
    );
  });

  it("treats missing AWS house images as already deleted", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? "GET",
        url: String(url),
      });
      return new Response("missing", { status: 404 });
    };

    await deleteAwsHouseImageObject({
      accessKeyId: "access-key",
      bucket: "poolvillas.co.ltd",
      fetchImpl,
      imageName: "missing.webp",
      region: "ap-southeast-1",
      secretAccessKey: "secret-key",
    });

    assert.deepEqual(calls, [
      {
        method: "DELETE",
        url: "https://s3.ap-southeast-1.amazonaws.com/poolvillas.co.ltd/missing.webp",
      },
    ]);
  });
});
