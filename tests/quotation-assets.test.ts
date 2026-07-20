import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
  validateQuotationAssetFile,
  validateQuotationAssetObjectKey,
  validateQuotationAssetUrl,
} from "../lib/quotation-assets.ts";
import { resizeQuotationImageToMax } from "../lib/quotation-image-resize.ts";
import { uploadQuotationAssetObject } from "../server/storage/quotation-assets.ts";
import worker from "../workers/media/src/index.ts";

function workerEnv() {
  return {
    ADVERTISEMENT_IMAGE_WORKER_SECRET: "secret",
    MEDIA_BUCKET: {
      async delete() {},
      async get() { return null; },
      async put(key: string) { return { key }; },
    },
  };
}

describe("quotation assets", () => {
  it("keeps every built-in bank icon lightweight and vector-only", () => {
    const icons = [
      "baac.svg", "bay.svg", "bbl.svg", "cimbt.svg", "generic-bank.svg", "ghb.svg",
      "gsb.svg", "ibank.svg", "kbank.svg", "kkp.svg", "ktb.svg", "lh.svg", "scb.svg",
      "tcrb.svg", "tisco.svg", "ttb.svg", "uobt.svg",
    ];

    for (const icon of icons) {
      const svg = readFileSync(`public/quotation/banks/${icon}`, "utf8");
      assert.match(svg, /viewBox="0 0 48 48"/, icon);
      assert.doesNotMatch(
        svg,
        /<(?:image|linearGradient|radialGradient|filter)\b|data:image|base64|(?:href|src)=["']https?:\/\//i,
        icon,
      );
    }
  });

  it("creates and validates random WebP keys under the quotation prefix", () => {
    const key = buildQuotationAssetObjectKey(() => "123e4567-e89b-42d3-a456-426614174000");
    assert.equal(key, "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp");
    assert.equal(validateQuotationAssetObjectKey(key), key);
    assert.throws(() => validateQuotationAssetObjectKey("quotations/assets/../secret.webp"));
    assert.throws(() => validateQuotationAssetObjectKey("https://example.com/logo.webp"));
  });

  it("encodes a trusted object key into a Worker URL", () => {
    assert.equal(
      buildQuotationAssetUrl("quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", "https://media.example/"),
      "https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
    );
    assert.equal(
      validateQuotationAssetUrl("https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", "https://media.example"),
      "https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
    );
    assert.throws(() => validateQuotationAssetUrl("https://tracker.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", "https://media.example"));
  });

  it("accepts PNG, JPEG, and WebP sources no larger than 10 MB", () => {
    for (const [name, type] of [["logo.png", "image/png"], ["logo.jpg", "image/jpeg"], ["logo.webp", "image/webp"]]) {
      const valid = new File([new Uint8Array([1])], name, { type });
      assert.equal(validateQuotationAssetFile(valid), valid);
    }
    assert.throws(() => validateQuotationAssetFile(new File(["x"], "logo.svg", { type: "image/svg+xml" })), /WEBP/);
    assert.throws(() => validateQuotationAssetFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /10 MB/);
  });

  it("limits the largest image side to 1600 pixels", () => {
    assert.deepEqual(resizeQuotationImageToMax(3200, 1600), { height: 800, width: 1600 });
    assert.deepEqual(resizeQuotationImageToMax(400, 300), { height: 300, width: 400 });
  });

  it("allows a UUID WebP quotation key in the Media Worker", async () => {
    const response = await worker.fetch(new Request("https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", {
      body: new Uint8Array([1]), headers: { authorization: "Bearer secret", "content-type": "image/webp" }, method: "PUT",
    }), workerEnv());
    assert.equal(response.status, 200);
  });

  it("rejects non-UUID quotation keys for Worker PUT and DELETE", async () => {
    const bucket = { deleted: false, async delete() { this.deleted = true; }, async get() { return null; }, async put(key: string) { return { key }; } };
    const env = { ADVERTISEMENT_IMAGE_WORKER_SECRET: "secret", MEDIA_BUCKET: bucket };
    for (const method of ["PUT", "DELETE"]) {
      const response = await worker.fetch(new Request("https://media.example/quotations/assets/logo.webp", {
        body: method === "PUT" ? new Uint8Array([1]) : undefined,
        headers: { authorization: "Bearer secret", "content-type": "image/webp" }, method,
      }), env);
      assert.equal(response.status, 400);
    }
    assert.equal(bucket.deleted, false);
  });

  it("uses bearer auth and preserves a useful Worker error", async () => {
    const calls: RequestInit[] = [];
    await uploadQuotationAssetObject({
      body: new Uint8Array([1]), contentType: "image/webp", fetchImpl: async (_url, init) => { calls.push(init ?? {}); return new Response("{}", { status: 200 }); },
      objectKey: "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", workerSecret: "secret", workerUrl: "https://media.example",
    });
    assert.equal((calls[0]?.headers as Record<string, string>).authorization, "Bearer secret");
    await assert.rejects(() => uploadQuotationAssetObject({
      body: new Uint8Array([1]), contentType: "image/webp", fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
      objectKey: "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp", workerSecret: "wrong", workerUrl: "https://media.example",
    }), /Failed to upload quotation asset \(401\): Unauthorized/);
  });

  it("validates trusted logo URLs before saving quotations", () => {
    const source = readFileSync("app/admin/quotations/actions.ts", "utf8");
    assert.ok(source.indexOf("validateQuotationAssetUrl") < source.indexOf("saveQuotation(supabase"));
  });

  it("normalizes selected logo files before upload", () => {
    const source = readFileSync("components/admin/quotations/company-profile-form.tsx", "utf8");
    assert.match(source, /validateQuotationAssetFile\(file\)/);
    assert.match(source, /createImageBitmap\(file\)/);
    assert.match(source, /resizeQuotationImageToMax\(bitmap\.width, bitmap\.height\)/);
    assert.match(source, /canvas\.toBlob/);
    assert.match(source, /"image\/webp"/);
  });

  it("keeps quotation logo uploads optional for the seller profile", () => {
    const source = readFileSync("app/admin/quotations/actions.ts", "utf8");
    assert.match(source, /const logo = value instanceof File && value\.size > 0/);
    assert.ok(source.indexOf("if (logo)") < source.indexOf("saveQuotationCompanyProfile(supabase, seller"));
  });
});
