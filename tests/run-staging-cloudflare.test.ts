import assert from "node:assert/strict";
import { test } from "node:test";
import { stagingPublicEnvironment } from "../scripts/run-staging-cloudflare.mjs";
import * as deployment from "../scripts/run-staging-cloudflare.mjs";
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('staging deploy optionally uploads an ignored secret file without build injection',()=>{
  assert.equal(typeof deployment.stagingSecretArguments,'function');
  const directory=mkdtempSync(join(tmpdir(),'webook-staging-secret-test-'));
  try{
    assert.deepEqual(deployment.stagingSecretArguments(directory),[]);
    writeFileSync(join(directory,'.env.ical-staging'),'ICAL_SOURCE_ENCRYPTION_KEY=synthetic');
    assert.deepEqual(deployment.stagingSecretArguments(directory),['--secrets-file',join(directory,'.env.ical-staging')]);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

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

test("staging CI rejects a non-Staging Supabase URL", () => {
  assert.throws(() => stagingPublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://rqizfiayvcbozlzuvbok.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key" }), /Invalid Staging Supabase public URL/);
});
