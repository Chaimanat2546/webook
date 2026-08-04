import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAdvertisementImageEnv,
  getAwsS3ImageEnv,
  getQuotationPublicOrigin,
  getSupabaseServiceRoleEnv,
} from "../lib/env.ts";

describe("environment helpers", () => {
  it("normalizes surrounding whitespace from the advertisement image Worker URL", () => {
    const previous = {
      workerSecret: process.env.ADVERTISEMENT_IMAGE_WORKER_SECRET,
      workerUrl: process.env.ADVERTISEMENT_IMAGE_WORKER_URL,
    };
    process.env.ADVERTISEMENT_IMAGE_WORKER_SECRET = " secret-kept-exact ";
    process.env.ADVERTISEMENT_IMAGE_WORKER_URL = "https://media.example.com\r\n";

    try {
      assert.deepEqual(getAdvertisementImageEnv(), {
        workerSecret: " secret-kept-exact ",
        workerUrl: "https://media.example.com",
      });
    } finally {
      restoreEnv("ADVERTISEMENT_IMAGE_WORKER_SECRET", previous.workerSecret);
      restoreEnv("ADVERTISEMENT_IMAGE_WORKER_URL", previous.workerUrl);
    }
  });

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

  it("removes a byte-order mark from the Supabase service-role key", () => {
    const previous = {
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "\ufeffservice-role-key";

    try {
      assert.deepEqual(getSupabaseServiceRoleEnv(), {
        serviceRoleKey: "service-role-key",
        url: "https://example.supabase.co",
      });
    } finally {
      restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previous.serviceRoleKey);
      restoreEnv("NEXT_PUBLIC_SUPABASE_URL", previous.url);
      restoreEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", previous.anonKey);
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
