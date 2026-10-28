import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertCompleteTestRun,
  integrationEnvironment,
  prepareIntegrationWorkspace,
  integrationFailureSummary,
} from "../scripts/run-ci-integration.mjs";

const localStatus = {
  API_URL: "http://127.0.0.1:57321",
  ANON_KEY: "synthetic-local-anon",
  SERVICE_ROLE_KEY: "synthetic-local-service",
};
const projectId = "webook-ci-integration-1234abcd";
const passingTap = "TAP version 13\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";

test("CI startup diagnostics classify failures without disclosing CLI credentials or raw output", () => {
  const privateValue="synthetic-sensitive-cli-value";
  for (const [output,expected] of [
    [`ANON_KEY=${privateValue}\nfailed to pull image: i/o timeout`,"network"],
    [`SERVICE_ROLE_KEY=${privateValue}\ncontainer supabase_auth_fixture is not ready: unhealthy`,"healthcheck"],
    [`password=${privateValue}\nno space left on device`,"disk-space"],
    [`token=${privateValue}\nport is already allocated`,"port-conflict"],
    [`${privateValue}: an unrecognized failure`,"unclassified"],
  ]) {
    const summary=integrationFailureSummary(output,1);
    assert.ok(summary.includes(expected));
    assert.equal(summary.includes(privateValue),false);
    assert.equal(summary.includes("ANON_KEY"),false);
    assert.equal(summary.includes("SERVICE_ROLE_KEY"),false);
    assert.equal(summary.includes("password="),false);
  }
});

test("CI integration enables every opt-in against only its isolated local target", () => {
  const environment = integrationEnvironment(localStatus, projectId);
  assert.equal(environment.LOCAL_SUPABASE_URL, localStatus.API_URL);
  assert.equal(environment.LOCAL_SUPABASE_ANON_KEY, localStatus.ANON_KEY);
  assert.equal(environment.LOCAL_SUPABASE_SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY);
  assert.equal(environment.SUPABASE_DB_CONTAINER, `supabase_db_${projectId}`);
  for (const flag of ["RUN_BOOKING_DB_TESTS", "RUN_NOTIFICATION_DB_TESTS", "RUN_DASHBOARD_DB_TESTS", "RUN_LOCAL_SUPABASE_TESTS", "RUN_QUOTATION_MIGRATION_UPGRADE_TESTS", "ICAL_DB_INTEGRATION", "ICAL_WORKER_INTEGRATION"] as const) {
    assert.equal(environment[flag], "1");
  }
});

test("CI integration rejects remote targets, missing credentials and foreign containers without exposing values", () => {
  for (const status of [
    undefined,
    { ...localStatus, API_URL: "https://sxvkhzhqtrpxgzumsswl.supabase.co" },
    { ...localStatus, API_URL: "https://rqizfiayvcbozlzuvbok.supabase.co" },
    { ...localStatus, API_URL: "http://127.0.0.1:54321" },
    { ...localStatus, API_URL: "http://remote.example:57321" },
    { ...localStatus, ANON_KEY: "" },
    { ...localStatus, SERVICE_ROLE_KEY: undefined },
  ]) {
    assert.throws(() => integrationEnvironment(status, projectId), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Invalid isolated integration target/);
      assert.equal(error.message.includes(localStatus.ANON_KEY), false);
      assert.equal(error.message.includes(localStatus.SERVICE_ROLE_KEY), false);
      return true;
    });
  }
  assert.throws(() => integrationEnvironment(localStatus, "webook"), /Invalid isolated integration project/);
});

test("CI test gate requires complete successful output with no skipped suites, tests or TODOs", () => {
  assert.doesNotThrow(() => assertCompleteTestRun(passingTap, 0));
  for (const [output, status] of [
    [passingTap, 1],
    [passingTap, null],
    [passingTap.replace("# fail 0", "# fail 1"), 0],
    [passingTap.replace("# cancelled 0", "# cancelled 1"), 0],
    [passingTap.replace("# skipped 0", "# skipped 1"), 0],
    [passingTap.replace("# todo 0", "# todo 1"), 0],
    [passingTap.replace("# pass 2", "# pass 1"), 0],
    [passingTap.replace("# tests 2", "# tests 0"), 0],
    [passingTap.replace("# skipped 0\n", ""), 0],
    [`ok 1 - disabled suite # SKIP\n${passingTap}`, 0],
    [`ok 1 - unfinished suite # TODO\n${passingTap}`, 0],
    ["", 0],
  ] as const) {
    assert.throws(() => assertCompleteTestRun(output, status), /Integration run must pass every test without skips/);
  }
});

test("CI local workspace copies unmodified quotation-era migrations and synthetic seeds only", () => {
  const parent = mkdtempSync(join(tmpdir(), "webook-ci-fixture-test-"));
  const directory = join(parent, "fixture");
  try {
    const prepared = prepareIntegrationWorkspace(directory);
    assert.match(prepared, /^webook-ci-integration-[a-f0-9]{8}$/);
    assert.throws(() => prepareIntegrationWorkspace(directory), /already exists/);
    const config = readFileSync(join(directory, "supabase/config.toml"), "utf8");
    assert.match(config, new RegExp(`project_id = "${prepared}"`));
    assert.match(config, /port = 57321/);
    assert.match(config, /major_version = 17/);
    assert.doesNotMatch(config, /env\(|sxvkhzhqtrpxgzumsswl|rqizfiayvcbozlzuvbok/);
    const names = readdirSync(join(directory, "supabase/migrations"));
    assert.equal(names.length, 45);
    assert.equal(names.sort().at(-1), "20260806173000_save_quotation_layout_snapshot_before_insert.sql");
    for (const name of names) {
      assert.equal(readFileSync(join(directory, "supabase/migrations", name), "utf8"),
        readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    assert.match(readFileSync(join(directory, "supabase/seed.sql"), "utf8"), /insert into public.roles\(id, name\)/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("Staging CI runs the full integration gate and always stops its fixture before build/deploy", () => {
  const workflow = readFileSync(new URL("../.github/workflows/deploy-staging.yml", import.meta.url), "utf8");
  const validation = workflow.split("\n  deploy:")[0];
  assert.match(validation, /npm run typecheck/);
  assert.match(validation, /npm run lint/);
  assert.match(validation, /node scripts\/run-ci-integration\.mjs prepare/);
  assert.match(validation, /node scripts\/run-ci-integration\.mjs test/);
  assert.match(validation, /if: always\(\)\s+run: node scripts\/run-ci-integration\.mjs stop/);
  assert.ok(validation.indexOf(".mjs stop") < validation.indexOf("npm run build"));
  assert.doesNotMatch(validation, /npm run verify|tests\/dashboard-migration\.test\.ts|secrets\./);
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /npm run deploy:cf:staging/);
});
