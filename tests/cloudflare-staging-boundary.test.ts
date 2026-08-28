import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("webook Staging Cloudflare boundary", () => {
  it("pins the only allowed account, Worker, and cache without retired service bindings", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8"));
    assert.equal(config.account_id, "0df55f166fa309dcc904e992c43f86db");
    assert.equal(config.name, "webook-staging");
    assert.equal(config.workers_dev, true);
    assert.deepEqual(config.r2_buckets, [{ binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "webook-staging-next-cache" }]);
    assert.equal(Object.hasOwn(config, "services"), false);
    assert.equal(Object.hasOwn(config, "routes"), false);
  });

  it("runs a target guard before every staging upload/deploy", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.match(packageJson.scripts["upload:cf:staging"], /^node scripts\/assert-staging-cloudflare-target\.mjs/);
    assert.match(packageJson.scripts["deploy:cf:staging"], /^node scripts\/assert-staging-cloudflare-target\.mjs/);
    const guard = readFileSync(new URL("../scripts/assert-staging-cloudflare-target.mjs", import.meta.url), "utf8");
    const runner = readFileSync(new URL("../scripts/run-staging-cloudflare.mjs", import.meta.url), "utf8");
    assert.match(guard, /Object\.hasOwn\(config, "services"\)/);
    assert.match(runner, /\[command, "-c", "wrangler\.staging\.jsonc", "--keep-vars"\]/);
  });
});
