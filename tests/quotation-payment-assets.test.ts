import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildQuotationPaymentAssetObjectKey,
  buildQuotationPaymentAssetUrl,
  validateQuotationPaymentAssetFile,
  validateQuotationPaymentAssetObjectKey,
  validateQuotationPaymentAssetUrl,
} from "../lib/quotation-assets.ts";
import { uploadQuotationAssetObject } from "../server/storage/quotation-assets.ts";

describe("quotation payment assets", () => {
  const key = "quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png";

  it("creates and validates random PNG payment keys", () => {
    assert.equal(buildQuotationPaymentAssetObjectKey(() => "123e4567-e89b-42d3-a456-426614174000"), key);
    assert.equal(validateQuotationPaymentAssetObjectKey(key), key);
    assert.throws(() => validateQuotationPaymentAssetObjectKey("quotations/payment-assets/../payment.png"));
    assert.equal(
      buildQuotationPaymentAssetUrl(key, "https://media.example/"),
      "https://media.example/quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png",
    );
    assert.equal(
      validateQuotationPaymentAssetUrl("https://media.example/quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png", "https://media.example"),
      "https://media.example/quotations/payment-assets/123e4567-e89b-42d3-a456-426614174000.png",
    );
  });

  it("accepts PNG, JPEG, and WebP payment sources up to 2 MB", () => {
    for (const [name, type] of [["payment.png", "image/png"], ["payment.jpg", "image/jpeg"], ["payment.webp", "image/webp"]]) {
      const file = new File([new Uint8Array([1])], name, { type });
      assert.equal(validateQuotationPaymentAssetFile(file), file);
    }
    assert.throws(() => validateQuotationPaymentAssetFile(new File(["x"], "payment.svg", { type: "image/svg+xml" })), /PNG/);
    assert.throws(() => validateQuotationPaymentAssetFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /2 MB/);
  });

  it("gives an actionable error when a normalized PNG exceeds 2 MB", () => {
    assert.throws(
      () => validateQuotationPaymentAssetFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "normalized.png", { type: "image/png" })),
      /2 MB/,
    );
  });

  it("uploads normalized payment files with explicit PNG content type", async () => {
    const calls: RequestInit[] = [];
    await uploadQuotationAssetObject({
      body: new Uint8Array([1]), contentType: "image/png",
      fetchImpl: async (_url, init) => { calls.push(init ?? {}); return new Response("{}", { status: 200 }); },
      objectKey: key, workerSecret: "secret", workerUrl: "https://media.example",
    });
    assert.equal((calls[0]?.headers as Record<string, string>)["content-type"], "image/png");
  });

  it("normalizes quotation images to PNG in the browser", () => {
    const source = readFileSync("components/admin/quotations/quotation-png-image-input.tsx", "utf8");
    assert.match(source, /validateQuotationPaymentAssetFile\(file\)/);
    assert.match(source, /createImageBitmap\(file\)/);
    assert.match(source, /canvas\.width = bitmap\.width/);
    assert.match(source, /canvas\.height = bitmap\.height/);
    assert.match(source, /canvas\.toBlob/);
    assert.match(source, /"image\/png"/);
    assert.match(source, /return validateQuotationPaymentAssetFile\(new File\(\[blob\]/);
    assert.match(source, /URL\.revokeObjectURL/);
  });
});
