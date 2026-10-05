import assert from "node:assert/strict";
import { test } from "node:test";
import { stagingPublicEnvironment } from "../scripts/run-staging-cloudflare.mjs";

test("staging CI public values take precedence over the local environment file", () => {
  const environment = stagingPublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: "https://sxvkhzhqtrpxgzumsswl.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key",
  });

  assert.deepEqual(environment, {
    NEXT_PUBLIC_SUPABASE_URL: "https://sxvkhzhqtrpxgzumsswl.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key",
  });
});
