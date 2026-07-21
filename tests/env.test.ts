import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAwsS3ImageEnv, getQuotationPublicOrigin } from "../lib/env.ts";

describe("environment helpers", () => {
  it("loads the AWS S3 image delete environment", () => {
    const previous = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      bucket: process.env.AWS_BUCKET,
      region: process.env.AWS_REGION,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
    process.env.AWS_ACCESS_KEY_ID = "access-key";
    process.env.AWS_BUCKET = "poolvillas.co.ltd";
    process.env.AWS_REGION = "ap-southeast-1";
    process.env.AWS_SECRET_ACCESS_KEY = "secret-key";

    try {
      assert.deepEqual(getAwsS3ImageEnv(), {
        accessKeyId: "access-key",
        bucket: "poolvillas.co.ltd",
        region: "ap-southeast-1",
        secretAccessKey: "secret-key",
      });
    } finally {
      restoreEnv("AWS_ACCESS_KEY_ID", previous.accessKeyId);
      restoreEnv("AWS_BUCKET", previous.bucket);
      restoreEnv("AWS_REGION", previous.region);
      restoreEnv("AWS_SECRET_ACCESS_KEY", previous.secretAccessKey);
    }
  });

  it("requires the AWS S3 image delete environment", () => {
    const previousBucket = process.env.AWS_BUCKET;
    delete process.env.AWS_BUCKET;

    try {
      assert.throws(getAwsS3ImageEnv, /AWS_BUCKET/);
    } finally {
      restoreEnv("AWS_BUCKET", previousBucket);
    }
  });

  it("loads only a canonical HTTPS quotation Public origin", () => {
    const previousOrigin = process.env.QUOTATION_PUBLIC_ORIGIN;
    delete process.env.QUOTATION_PUBLIC_ORIGIN;

    try {
      assert.equal(getQuotationPublicOrigin(), null);
      process.env.QUOTATION_PUBLIC_ORIGIN = "https://quotes.example.com/";
      assert.equal(getQuotationPublicOrigin(), "https://quotes.example.com");
    } finally {
      restoreEnv("QUOTATION_PUBLIC_ORIGIN", previousOrigin);
    }

    for (const invalid of [
      "",
      "http://quotes.example.com",
      "https://user:secret@quotes.example.com",
      "https://quotes.example.com/app",
      "https://quotes.example.com/?from=admin",
      "https://quotes.example.com/#document",
      "not-a-url",
    ]) assert.equal(getQuotationPublicOrigin(invalid), null);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
