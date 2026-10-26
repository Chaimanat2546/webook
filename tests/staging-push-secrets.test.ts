import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareStagingPushSecrets, cleanupStagingPushSecrets } from "../scripts/prepare-staging-push-secrets.mjs";

const target = { account_id: "0df55f166fa309dcc904e992c43f86db", name: "webook-staging" };
const environment = {
  GITHUB_ACTIONS: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://sxvkhzhqtrpxgzumsswl.supabase.co",
  VAPID_PUBLIC_KEY: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url"),
  VAPID_PRIVATE_KEY: Buffer.alloc(32, 2).toString("base64url"),
  VAPID_SUBJECT: "https://webook-staging.chaymanus2003.workers.dev",
};

test("CI prepares runtime-only VAPID secrets, preserves legacy secrets and never overwrites a file", () => {
  const directory = mkdtempSync(join(tmpdir(), "webook-staging-push-secrets-"));
  try {
    writeFileSync(join(directory, "wrangler.staging.jsonc"), JSON.stringify(target));
    writeFileSync(join(directory, ".env.ical-staging"), "ICAL_SOURCE_ENCRYPTION_KEY=synthetic-legacy");
    const path = prepareStagingPushSecrets(directory, environment);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { ICAL_SOURCE_ENCRYPTION_KEY: "synthetic-legacy", VAPID_PUBLIC_KEY: environment.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: environment.VAPID_PRIVATE_KEY, VAPID_SUBJECT: environment.VAPID_SUBJECT });
    assert.throws(() => prepareStagingPushSecrets(directory, environment), /Staging Push configuration could not be prepared/);
    cleanupStagingPushSecrets(directory);
    assert.equal(existsSync(path), false);
    assert.equal(readFileSync(join(directory, ".env.ical-staging"), "utf8"), "ICAL_SOURCE_ENCRYPTION_KEY=synthetic-legacy");
    cleanupStagingPushSecrets(directory);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("runtime secret preparation rejects local, wrong-account, wrong-database and incomplete configurations", () => {
  const directory = mkdtempSync(join(tmpdir(), "webook-staging-push-guard-"));
  const file = join(directory, ".env.staging-worker-secrets.json");
  try {
    writeFileSync(join(directory, "wrangler.staging.jsonc"), JSON.stringify(target));
    for (const env of [
      { ...environment, GITHUB_ACTIONS: "false" },
      { ...environment, NEXT_PUBLIC_SUPABASE_URL: "https://rqizfiayvcbozlzuvbok.supabase.co" },
      { ...environment, VAPID_PRIVATE_KEY: "" },
      { ...environment, VAPID_SUBJECT: "invalid" },
    ]) {
      assert.throws(() => prepareStagingPushSecrets(directory, env));
      assert.equal(existsSync(file), false);
    }
    writeFileSync(join(directory, "wrangler.staging.jsonc"), JSON.stringify({ ...target, account_id: "7c1d945e149fc6fad2124176124d8f33" }));
    assert.throws(() => prepareStagingPushSecrets(directory, environment));
    assert.equal(existsSync(file), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
