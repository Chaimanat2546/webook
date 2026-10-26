import assert from "node:assert/strict";
import { test } from "node:test";
import { createECDH } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertProductionTarget, cleanupProductionPushSecrets, prepareProductionPushSecrets } from "../scripts/prepare-production-notifications.mjs";

test("Production release rejects local runs and mismatched database, account or Worker", () => {
  const directory = mkdtempSync(join(tmpdir(), "webook-production-guard-"));
  const target = { account_id: "7c1d945e149fc6fad2124176124d8f33", name: "webook-admin" };
  const environment = { GITHUB_ACTIONS: "true", NEXT_PUBLIC_SUPABASE_URL: "https://rqizfiayvcbozlzuvbok.supabase.co" };
  try {
    writeFileSync(join(directory, "wrangler.jsonc"), JSON.stringify(target));
    assert.doesNotThrow(() => assertProductionTarget(directory, environment));
    assert.throws(() => assertProductionTarget(directory, { ...environment, GITHUB_ACTIONS: "false" }));
    assert.throws(() => assertProductionTarget(directory, { ...environment, NEXT_PUBLIC_SUPABASE_URL: "https://sxvkhzhqtrpxgzumsswl.supabase.co" }));
    for (const invalid of [{ ...target, account_id: "0df55f166fa309dcc904e992c43f86db" }, { ...target, name: "webook-staging" }]) {
      writeFileSync(join(directory, "wrangler.jsonc"), JSON.stringify(invalid));
      assert.throws(() => assertProductionTarget(directory, environment));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("Production Push preparation validates keys, writes only runtime secrets and cleans up", () => {
  const directory = mkdtempSync(join(tmpdir(), "webook-production-push-"));
  const pair = createECDH("prime256v1"); pair.generateKeys();
  const environment = { GITHUB_ACTIONS: "true", NEXT_PUBLIC_SUPABASE_URL: "https://rqizfiayvcbozlzuvbok.supabase.co", VAPID_PUBLIC_KEY: pair.getPublicKey().toString("base64url"), VAPID_PRIVATE_KEY: pair.getPrivateKey().toString("base64url"), VAPID_SUBJECT: "mailto:ops@example.com" };
  const path = join(directory, ".env.production-worker-secrets.json");
  try {
    writeFileSync(join(directory, "wrangler.jsonc"), JSON.stringify({ account_id: "7c1d945e149fc6fad2124176124d8f33", name: "webook-admin" }));
    assert.throws(() => prepareProductionPushSecrets(directory, { ...environment, VAPID_PRIVATE_KEY: "" }));
    assert.equal(existsSync(path), false);
    assert.equal(prepareProductionPushSecrets(directory, environment), path);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { VAPID_PUBLIC_KEY: environment.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: environment.VAPID_PRIVATE_KEY, VAPID_SUBJECT: environment.VAPID_SUBJECT });
    assert.throws(() => prepareProductionPushSecrets(directory, environment));
    cleanupProductionPushSecrets(directory);
    assert.equal(existsSync(path), false);
    cleanupProductionPushSecrets(directory);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
